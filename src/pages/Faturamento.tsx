import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { UploadIcon } from '@/components/icons'
import { Tag, statusTag } from '@/components/dashboard/statusTags'
import { brandFromTenantName, currentMonthValue, formatBRL, formatCompetencia, slugify } from '@/lib/format'
import { simulateEmailSend, simulateWhatsappSend } from '@/lib/simulation'
import { useSettings, type EligibleServiceType, type EmitterMappingEntry } from '@/context/SettingsContext'
import { emitterKey } from '@/lib/liveEmitters'
import { cancelarNfseReal, consultarNfseReal, emitirNfseReal } from '@/lib/emitNfse'
import { fetchUnits } from '@/lib/liveUnits'
import {
  deleteInvoices,
  fetchInvoiceRows,
  markInvoiceSent,
  recordCancellation,
  recordEmissionResult,
  saveQueueRows,
  fetchBoletoDataUrl,
  updateInvoiceBoleto,
  updateInvoicePayment,
  updateInvoiceStatus,
  type LiveInvoiceRow,
} from '@/lib/liveInvoices'
import { parseSpreadsheet, type ParsedSheet } from '@/lib/spreadsheetParser'
import { ImportPreviewModal } from '@/components/faturamento/ImportPreviewModal'
import { rowMatchKey, UnitMatchModal, type UnitMatches } from '@/components/faturamento/UnitMatchModal'
import { type PendingEmissionRow } from '@/data/pendingEmissions'
import type { LiveUnit } from '@/types'

const MAX_BOLETO_BYTES = 3 * 1024 * 1024

const EMPTY_MAPPING: EmitterMappingEntry = { emitterId: null, itemListaServico: null, codigoTributarioMunicipio: null, issRetido: false }
const SERVICE_TYPES: EligibleServiceType[] = ['call_center', 'royalties', 'marketing']

const SERVICE_LABEL: Record<EligibleServiceType, string> = {
  call_center: 'Call Center',
  royalties: 'Royalties',
  marketing: 'Marketing',
}

function hasDadoFiscalCompleto(u: LiveUnit): boolean {
  return !!(u.cnpj && u.razaoSocial && u.logradouro && u.numero && u.bairro && u.cep && u.codigoMunicipio)
}

// Converte o resultado do parser (por aba/marca) em linhas pra gravar na fila
// real, usando o `unitId` já resolvido pelo `UnitMatchModal` (correlação
// automática por nome + ajuste manual do usuário). Unidade "sem cobrança no
// mês" fica de fora (seção 3 do MD) — já apareceu no preview, é só não virar
// fatura.
function toPendingRows(sheets: ParsedSheet[], matches: UnitMatches): PendingEmissionRow[] {
  return sheets.flatMap((sheet, sheetIdx) => {
    const marca = brandFromTenantName(sheet.tenantName)
    return sheet.rows
      .map((r, rowIdx) => ({ r, rowIdx }))
      .filter(({ r }) => !r.hasNoCharge)
      .map(({ r, rowIdx }) => {
        const cleanName = r.unitName.replace(/^The Duck Pizzaria\s*-\s*/i, '').trim()
        const unitName = marca === 'Forneria' ? `Forneria ${cleanName}` : `The Duck ${cleanName}`
        return {
          id: `${slugify(marca)}-${slugify(cleanName)}`,
          unitId: matches[rowMatchKey(sheetIdx, rowIdx)] ?? null,
          unitName,
          marca,
          callCenterValue: r.callCenterValue,
          royaltiesValue: r.royaltiesValue,
          marketingValue: r.marketingValue,
        } satisfies PendingEmissionRow
      })
  })
}

export function Faturamento() {
  const [invoiceRows, setInvoiceRows] = useState<LiveInvoiceRow[]>([])
  const [loadingRows, setLoadingRows] = useState(true)
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({})
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set())
  // Fluxo de importação em 2 passos: primeiro correlaciona cada linha da
  // planilha com uma unidade real (`matches` ainda undefined → mostra
  // UnitMatchModal); só depois de resolvido mostra o preview de confirmação.
  const [importFlow, setImportFlow] = useState<{ fileName: string; sheets: ParsedSheet[]; matches?: UnitMatches } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importNotice, setImportNotice] = useState<string | null>(null)
  const [competencia, setCompetencia] = useState(currentMonthValue())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [units, setUnits] = useState<LiveUnit[]>([])
  const { serviceEligibility, sendChannel, emitterFor, emitterMapping, emitters } = useSettings()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    fetchUnits()
      .then((data) => {
        if (!cancelled) setUnits(data)
      })
      .catch((e) => console.error('Falha ao carregar unidades:', e instanceof Error ? e.message : e))
    return () => {
      cancelled = true
    }
  }, [])

  const unitsById = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units])
  const emittersById = useMemo(() => Object.fromEntries(emitters.map((e) => [e.id, e])), [emitters])

  async function reloadRows(comp: string = competencia) {
    try {
      const data = await fetchInvoiceRows(comp)
      setInvoiceRows(data)
    } catch (e) {
      console.error('Falha ao carregar faturamento:', e instanceof Error ? e.message : e)
    }
  }

  // Fila real, persistida (nf_forneria.invoices/invoice_items) — recarrega
  // sempre que a competência muda. Nada mais vive só em memória do navegador
  // (achado real testando emissão em produção: trocar de página zerava tudo).
  useEffect(() => {
    let cancelled = false
    setLoadingRows(true)
    fetchInvoiceRows(competencia)
      .then((data) => {
        if (!cancelled) setInvoiceRows(data)
      })
      .catch((e) => console.error('Falha ao carregar faturamento:', e instanceof Error ? e.message : e))
      .finally(() => {
        if (!cancelled) setLoadingRows(false)
      })
    return () => {
      cancelled = true
    }
  }, [competencia])

  // "Preencher valores" é página própria agora (`/faturamento/preencher`,
  // mais espaço que modal pras 69 unidades) — ao confirmar lá, ela volta
  // pra cá levando o resultado via `navigate(..., { state })`. Consome uma
  // vez só e limpa o state (senão reaplicaria de novo em qualquer reload
  // desta página).
  useEffect(() => {
    const state = location.state as { manualEntryRows?: PendingEmissionRow[]; manualEntryCompetencia?: string } | null
    if (state?.manualEntryRows) {
      confirmManualEntry(state.manualEntryRows, state.manualEntryCompetencia ?? competencia)
      navigate(location.pathname, { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === invoiceRows.length ? new Set() : new Set(invoiceRows.map((r) => r.id))))
  }

  // Exclusão em massa — pra limpar dados de teste rapidamente, sem
  // depender de status. Apaga de verdade (cascata apaga os invoice_items
  // junto) — útil pra testes, mas não desfaz nenhuma nota já emitida de
  // verdade na Focus (só o registro local).
  async function deleteSelected() {
    const ids = [...selectedIds]
    setSelectedIds(new Set())
    await deleteInvoices(ids)
    await reloadRows()
  }

  async function handleFileSelected(file: File) {
    setImportError(null)
    setImportNotice(null)
    try {
      const buffer = await file.arrayBuffer()
      const sheets = parseSpreadsheet(buffer)
      if (sheets.every((s) => s.rows.length === 0)) {
        setImportError('Nenhuma unidade reconhecida nessa planilha — confira se o formato bate com o esperado.')
        return
      }
      setImportFlow({ fileName: file.name, sheets })
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Falha ao ler a planilha.')
    }
  }

  async function confirmImport() {
    if (!importFlow?.matches) return
    const allRows = toPendingRows(importFlow.sheets, importFlow.matches)
    const withUnit = allRows.filter((r) => r.unitId !== null) as Array<PendingEmissionRow & { unitId: string }>
    await saveQueueRows(competencia, withUnit, importFlow.fileName)
    const skipped = allRows.length - withUnit.length
    setImportNotice(skipped > 0 ? `${skipped} unidade${skipped === 1 ? '' : 's'} não ${skipped === 1 ? 'entrou' : 'entraram'} na fila por falta de correspondência.` : null)
    setImportFlow(null)
    setSelectedIds(new Set())
    await reloadRows()
  }

  // Preenchimento manual (alternativa ao upload de planilha) — mesmo
  // destino que `confirmImport`.
  async function confirmManualEntry(newRows: PendingEmissionRow[], competenciaValue: string) {
    const withUnit = newRows.filter((r) => r.unitId !== null) as Array<PendingEmissionRow & { unitId: string }>
    await saveQueueRows(competenciaValue, withUnit, null)
    setSelectedIds(new Set())
    if (competenciaValue === competencia) {
      await reloadRows()
    } else {
      setCompetencia(competenciaValue) // o useEffect acima recarrega sozinho
    }
  }

  // Cada card conta uma dimensão independente — uma fatura pode ser Emitida
  // + Paga + Enviada ao mesmo tempo, não é "o último status que aconteceu"
  // (status sozinho não dava conta disso: marcar como enviada sobrescrevia
  // o fato de já estar emitida). "Emitida" não confia no campo `status` da
  // fatura (podia ficar travado num valor antigo) — calcula direto dos
  // itens, igual o botão "Emitir"/"Emitida" de cada linha já faz.
  function isFullyEmitted(row: LiveInvoiceRow) {
    const active = row.items.filter((i) => i.nfseStatus !== 'cancelada')
    return active.length > 0 && active.every((i) => i.nfseStatus === 'autorizada')
  }

  const statusCounts: Array<{ status: keyof typeof statusTag; count: number }> = [
    { status: 'paga', count: invoiceRows.filter((r) => r.paymentStatus === 'paga').length },
    { status: 'enviada', count: invoiceRows.filter((r) => r.whatsappSent || r.emailSent).length },
    { status: 'emitida', count: invoiceRows.filter(isFullyEmitted).length },
    { status: 'pendente_emissao', count: invoiceRows.filter((r) => !isFullyEmitted(r)).length },
    { status: 'atraso', count: invoiceRows.filter((r) => r.paymentStatus === 'atraso').length },
    { status: 'falha', count: invoiceRows.filter((r) => r.items.some((i) => i.nfseStatus === 'falha')).length },
  ]

  const pendingCount = invoiceRows.filter((r) => !isFullyEmitted(r)).length

  // Só entra como elegível pra emitir o serviço habilitado, com item
  // pendente/falho salvo (valor > 0 quando a fila foi gravada) e que tenha
  // CNPJ emissor configurado — item já autorizado nunca reaparece aqui
  // (não reemite nota já emitida).
  function eligibleServices(row: LiveInvoiceRow) {
    return SERVICE_TYPES.map((serviceType) => ({
      serviceType,
      label: SERVICE_LABEL[serviceType],
      item: row.items.find((i) => i.serviceType === serviceType),
    })).filter((s) => s.item && s.item.nfseStatus !== 'autorizada' && s.item.nfseStatus !== 'cancelada' && serviceEligibility[s.serviceType] && emitterFor(row.marca, s.serviceType))
  }

  function emitDisabledReason(row: LiveInvoiceRow): string | null {
    const unit = unitsById[row.unitId]
    if (!unit) return 'Unidade não encontrada no cadastro (Franquias) — não é possível emitir.'
    if (!hasDadoFiscalCompleto(unit)) return 'Dado fiscal incompleto (CNPJ/endereço) — complete em Franquias antes de emitir.'
    if (eligibleServices(row).length === 0) return 'Nenhum serviço elegível (verifique habilitação/CNPJ emissor em Configurações).'
    return null
  }

  // Emissão real via Focus NFe (Ambiente Nacional, produção) — sempre 1 nota
  // por serviço elegível, nunca consolidada. Uma NFS-e tem um único código de
  // tributação/discriminação; "juntar" Royalties + Call Center numa nota só
  // produziria uma nota fiscalmente errada (decisão tomada com o usuário).
  // Cada resultado é gravado direto em `invoice_items` (não só em memória).
  async function emitRow(row: LiveInvoiceRow) {
    if (rowBusy[row.id]) return
    const eligible = eligibleServices(row)
    if (eligible.length === 0) return
    const unit = unitsById[row.unitId]
    if (!unit || !hasDadoFiscalCompleto(unit)) return

    setRowBusy((prev) => ({ ...prev, [row.id]: true }))

    await Promise.allSettled(
      eligible.map(async (s) => {
        const itemId = s.item!.id
        try {
          const result = await emitirNfseReal({
            ambiente: 'producao',
            ref: `${row.unitId}-${s.serviceType}-${competencia}`,
            mapping: emitterMapping[emitterKey(row.marca, s.serviceType)] ?? EMPTY_MAPPING,
            unit,
            valor: s.item!.value,
            discriminacao: `${s.label} — ${row.unitName} — ${formatCompetencia(competencia)}`,
          })
          await recordEmissionResult(itemId, {
            nfseStatus: 'autorizada',
            nfseNumber: result.numero ?? null,
            urlDanfse: result.url_danfse ?? null,
            emitterId: emitterFor(row.marca, s.serviceType)?.id ?? null,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Falha desconhecida ao emitir.'
          await recordEmissionResult(itemId, { nfseStatus: 'falha', errorMessage: msg })
        }
      }),
    )

    const refreshed = await fetchInvoiceRows(competencia)
    const updatedRow = refreshed.find((r) => r.id === row.id)
    if (updatedRow && isFullyEmitted(updatedRow) && updatedRow.status !== 'emitida') {
      await updateInvoiceStatus(row.id, 'emitida')
      updatedRow.status = 'emitida'
    }
    setInvoiceRows(refreshed)
    setRowBusy((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
  }

  async function emitLote() {
    const pending = invoiceRows.filter((r) => !isFullyEmitted(r) && emitDisabledReason(r) === null)
    await Promise.all(pending.map((row) => emitRow(row)))
  }

  // Só consulta (não reenvia) — pra resincronizar um item que já foi
  // autorizado de verdade na Focus mas o registro local ficou incompleto
  // (ex: número/URL do DANFSe faltando porque foi corrigido via SQL direto).
  async function syncItem(row: LiveInvoiceRow, serviceType: EligibleServiceType) {
    const item = row.items.find((i) => i.serviceType === serviceType)
    if (!item || syncingIds.has(item.id)) return
    setSyncingIds((prev) => new Set(prev).add(item.id))
    try {
      const result = await consultarNfseReal({
        ambiente: 'producao',
        ref: `${row.unitId}-${serviceType}-${competencia}`,
        mapping: emitterMapping[emitterKey(row.marca, serviceType)] ?? EMPTY_MAPPING,
      })
      if (result.status === 'autorizado') {
        await recordEmissionResult(item.id, {
          nfseStatus: 'autorizada',
          nfseNumber: result.numero ?? item.nfseNumber,
          urlDanfse: result.url_danfse ?? item.urlDanfse,
          emitterId: item.emitterId,
        })
        await reloadRows()
      }
    } catch (e) {
      console.error('Falha ao consultar status na Focus:', e instanceof Error ? e.message : e)
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  // Cancelamento REAL na Focus/prefeitura — exige justificativa (15+ chars,
  // regra da Focus) e confirmação explícita. A ref é a mesma usada na
  // emissão, então uma nota cancelada não pode ser reemitida com ela.
  async function cancelItem(row: LiveInvoiceRow, serviceType: EligibleServiceType) {
    const item = row.items.find((i) => i.serviceType === serviceType)
    if (!item || item.nfseStatus !== 'autorizada' || syncingIds.has(item.id)) return
    const justificativa = window.prompt(
      `Cancelar a NFS-e ${item.nfseNumber ?? ''} (${SERVICE_LABEL[serviceType]} — ${row.unitName})?\n\nIsso cancela a nota de verdade na prefeitura. Informe a justificativa (mínimo 15 caracteres):`,
    )
    if (justificativa === null) return
    if (justificativa.trim().length < 15) {
      setImportError('Justificativa precisa ter pelo menos 15 caracteres.')
      return
    }
    setImportError(null)
    setSyncingIds((prev) => new Set(prev).add(item.id))
    try {
      await cancelarNfseReal({
        ambiente: 'producao',
        ref: `${row.unitId}-${serviceType}-${competencia}`,
        mapping: emitterMapping[emitterKey(row.marca, serviceType)] ?? EMPTY_MAPPING,
        justificativa: justificativa.trim(),
      })
      await recordCancellation(item.id, justificativa.trim())
      await updateInvoiceStatus(row.id, 'pendente_emissao')
      await reloadRows()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Falha ao cancelar a nota.')
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  async function handleBoletoChange(row: LiveInvoiceRow, file: File | null) {
    if (!file) return
    if (file.size > MAX_BOLETO_BYTES) {
      setImportError(`Boleto muito grande (máx. ${Math.round(MAX_BOLETO_BYTES / 1024 / 1024)}MB).`)
      return
    }
    setImportError(null)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'))
        reader.readAsDataURL(file)
      })
      await updateInvoiceBoleto(row.id, file.name, dataUrl)
      await reloadRows()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Falha ao anexar o boleto.')
    }
  }

  // Abre/baixa o boleto guardado. Blob URL (não data URL direto) porque o
  // Chrome bloqueia navegação top-level pra data: URL em nova aba.
  async function openBoleto(row: LiveInvoiceRow, mode: 'view' | 'download') {
    try {
      const dataUrl = await fetchBoletoDataUrl(row.id)
      if (!dataUrl) {
        setImportError('O arquivo desse boleto não foi guardado (anexado antes dessa função existir) — anexe de novo.')
        return
      }
      const blob = await (await fetch(dataUrl)).blob()
      const url = URL.createObjectURL(blob)
      if (mode === 'view') {
        window.open(url, '_blank', 'noopener')
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = row.boletoFileName ?? 'boleto'
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Falha ao abrir o boleto.')
    }
  }

  function toggleShowNfse(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function togglePayment(row: LiveInvoiceRow) {
    await updateInvoicePayment(row.id, row.paymentStatus === 'paga' ? 'pendente' : 'paga')
    await reloadRows()
  }

  async function sendRow(row: LiveInvoiceRow) {
    if (row.whatsappSent || row.emailSent || sendingIds.has(row.id)) return
    setSendingIds((prev) => new Set(prev).add(row.id))
    const dispatch = sendChannel === 'whatsapp' ? simulateWhatsappSend : simulateEmailSend
    await dispatch({ unitId: row.unitId, unitName: row.unitName })
    await markInvoiceSent(row.id, sendChannel)
    setSendingIds((prev) => {
      const next = new Set(prev)
      next.delete(row.id)
      return next
    })
    await reloadRows()
  }

  return (
    <>
      <PageHeader title="Faturamento" subtitle="Importar planilha, preencher manualmente, emitir nota (real, Focus NFe), cobrar e enviar">
        <div className="flex items-center gap-2 rounded-[11px] border border-line bg-card px-[13px] py-[9px] text-[12.5px] font-semibold text-navy">
          Competência: {formatCompetencia(competencia)}
        </div>
        <button
          onClick={() => navigate('/faturamento/preencher')}
          className="inline-flex items-center gap-2 rounded-[11px] border border-line bg-card px-[15px] py-[10px] text-[12.5px] font-bold text-navy"
        >
          Preencher valores
        </button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[11px] border border-line bg-card px-[15px] py-[10px] text-[12.5px] font-bold text-navy">
          <UploadIcon className="h-4 w-4" /> Importar planilha
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) handleFileSelected(file)
            }}
          />
        </label>
        <button
          onClick={emitLote}
          disabled={pendingCount === 0}
          className="inline-flex items-center gap-2 rounded-[11px] bg-orange px-[15px] py-[10px] text-[12.5px] font-bold text-white shadow-[0_6px_14px_rgba(233,78,27,.28)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Emitir lote {pendingCount > 0 && `(${pendingCount})`}
        </button>
      </PageHeader>

      {importError && (
        <div className="mb-[18px] rounded-[11px] bg-red-soft p-3 text-[12.5px] font-semibold text-red">⚠ {importError}</div>
      )}
      {importNotice && (
        <div className="mb-[18px] rounded-[11px] bg-amber-soft p-3 text-[12.5px] font-semibold text-amber">⚠ {importNotice}</div>
      )}

      {importFlow && !importFlow.matches && (
        <UnitMatchModal
          fileName={importFlow.fileName}
          sheets={importFlow.sheets}
          units={units}
          onCancel={() => setImportFlow(null)}
          onConfirm={(matches) => setImportFlow((prev) => (prev ? { ...prev, matches } : prev))}
        />
      )}

      {importFlow?.matches && (
        <ImportPreviewModal fileName={importFlow.fileName} sheets={importFlow.sheets} onCancel={() => setImportFlow(null)} onConfirm={confirmImport} />
      )}

      <section className="mb-[18px] grid grid-cols-6 gap-3 max-[1080px]:grid-cols-3 max-[560px]:grid-cols-2">
        {statusCounts.map(({ status, count }) => (
          <div key={status} className="animate-rise rounded-card border border-line bg-card p-4 shadow-panel">
            <div className="mb-2">
              <Tag tone={statusTag[status].tone} label={statusTag[status].label} />
            </div>
            <div className="num text-[22px] text-navy">{count}</div>
            <div className="text-[11px] text-faint">faturas · {formatCompetencia(competencia)}</div>
          </div>
        ))}
      </section>

      <section className="mb-[18px] animate-rise overflow-hidden rounded-card border border-line bg-card shadow-panel" style={{ animationDelay: '.06s' }}>
        <div className="flex items-center justify-between px-5 pb-[13px] pt-[17px]">
          <div>
            <h3 className="text-[14.5px] font-bold text-navy">Emitir nota fiscal por unidade</h3>
            <p className="mt-0.5 text-[11.5px] text-faint">
              Emite 1 NFS-e real por serviço habilitado (via Focus NFe) · anexe o boleto, marque como pago e envie a cobrança
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={deleteSelected}
                className="whitespace-nowrap rounded-[9px] bg-red px-[12px] py-[7px] text-[11.5px] font-bold text-white"
              >
                Excluir selecionadas ({selectedIds.size})
              </button>
            )}
            <span className="inline-flex items-center gap-1 rounded-[6px] bg-green-soft px-[6px] py-[1px] text-[9.5px] font-bold uppercase tracking-[.08em] text-green">
              Emissão real · Produção
            </span>
          </div>
        </div>
        {loadingRows ? (
          <div className="px-5 py-16 text-center text-[12.5px] text-faint">Carregando…</div>
        ) : invoiceRows.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-5 py-16 text-center">
            <p className="text-[13px] font-semibold text-navy">
              Nenhuma unidade preenchida ou importada pra {formatCompetencia(competencia)} ainda
            </p>
            <p className="text-[12px] text-faint">Use "Preencher valores" ou "Importar planilha" no topo da tela pra começar.</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse">
            <thead>
              <tr>
                <th className="w-[36px] border-y border-line bg-[#fafbfc] px-3 py-[11px]">
                  <input
                    type="checkbox"
                    checked={invoiceRows.length > 0 && selectedIds.size === invoiceRows.length}
                    onChange={toggleSelectAll}
                    className="h-[14px] w-[14px] accent-orange"
                  />
                </th>
                {['Unidade', 'Call Center', 'Royalties', 'Marketing', 'Total', 'Ações'].map((h, i) => (
                  <th
                    key={h}
                    className={`border-y border-line bg-[#fafbfc] px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint ${
                      i >= 1 && i <= 4 ? 'text-right' : ''
                    } ${i === 5 ? 'min-w-[280px]' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoiceRows.map((row) => {
                const eligible = eligibleServices(row)
                const disabledReason = emitDisabledReason(row)
                const busy = !!rowBusy[row.id]
                const sending = sendingIds.has(row.id)
                const sent = row.whatsappSent || row.emailSent
                const hasAutorizada = row.items.some((i) => i.nfseStatus === 'autorizada')
                const hasFalha = row.items.some((i) => i.nfseStatus === 'falha')
                return (
                  <tr key={row.id} className="border-b border-line last:border-none hover:bg-[#fafbfc]">
                    <td className="px-3 py-[13px]">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelected(row.id)}
                        className="h-[14px] w-[14px] accent-orange"
                      />
                    </td>
                    <td className="px-5 py-[13px] text-[13px] font-semibold text-navy">{row.unitName}</td>
                    <td className={`px-5 py-[13px] text-right text-[12px] ${serviceEligibility.call_center ? 'text-muted' : 'text-faint line-through'}`}>
                      {formatBRL(row.callCenterValue)}
                    </td>
                    <td className={`px-5 py-[13px] text-right text-[12px] ${serviceEligibility.royalties ? 'text-muted' : 'text-faint line-through'}`}>
                      {formatBRL(row.royaltiesValue)}
                    </td>
                    <td className={`px-5 py-[13px] text-right text-[12px] ${serviceEligibility.marketing ? 'text-muted' : 'text-faint line-through'}`}>
                      {formatBRL(row.marketingValue)}
                    </td>
                    <td className="px-5 py-[13px] text-right">
                      <span className="font-display font-bold text-navy">{formatBRL(row.totalValue)}</span>
                    </td>
                    <td className="px-5 py-[13px]">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-nowrap items-center gap-[6px]">
                          <label
                            className="cursor-pointer whitespace-nowrap rounded-[7px] border border-line bg-white px-[8px] py-[5px] text-[10.5px] font-bold text-navy"
                            title={row.boletoFileName ?? 'Anexar boleto (upload manual — este app não gera boleto)'}
                          >
                            {row.boletoFileName ? '📎 Boleto' : 'Boleto'}
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              className="hidden"
                              onChange={(e) => handleBoletoChange(row, e.target.files?.[0] ?? null)}
                            />
                          </label>
                          {row.boletoFileName && (
                            <>
                              <button
                                onClick={() => openBoleto(row, 'view')}
                                title="Visualizar boleto"
                                className="whitespace-nowrap rounded-[7px] border border-line bg-white px-[8px] py-[5px] text-[10.5px] font-bold text-navy"
                              >
                                Ver
                              </button>
                              <button
                                onClick={() => openBoleto(row, 'download')}
                                title="Baixar boleto"
                                className="whitespace-nowrap rounded-[7px] border border-line bg-white px-[8px] py-[5px] text-[10.5px] font-bold text-navy"
                              >
                                Baixar
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => togglePayment(row)}
                            className={`whitespace-nowrap rounded-[7px] px-[8px] py-[5px] text-[10.5px] font-bold ${
                              row.paymentStatus === 'paga' ? 'bg-green-soft text-green' : 'bg-amber-soft text-amber'
                            }`}
                          >
                            {row.paymentStatus === 'paga' ? 'Pago ✓' : 'A pagar'}
                          </button>

                          {busy ? (
                            <span className="whitespace-nowrap rounded-[7px] bg-[#eef1f4] px-[8px] py-[5px] text-[10.5px] font-semibold text-faint">
                              Emitindo…
                            </span>
                          ) : (
                            <button
                              disabled={disabledReason !== null}
                              onClick={() => emitRow(row)}
                              title={disabledReason ?? undefined}
                              className="whitespace-nowrap rounded-[7px] bg-orange px-[8px] py-[5px] text-[10.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {hasFalha ? 'Tentar de novo' : eligible.length === 0 && hasAutorizada ? 'Emitida' : 'Emitir'}
                            </button>
                          )}

                          {hasAutorizada && (
                            <button
                              onClick={() => toggleShowNfse(row.id)}
                              className="whitespace-nowrap rounded-[7px] bg-green-soft px-[8px] py-[5px] text-[10.5px] font-bold text-green"
                            >
                              Ver nota fiscal
                            </button>
                          )}

                          {sent ? (
                            <span className="whitespace-nowrap rounded-[7px] bg-blue-soft px-[8px] py-[5px] text-[10.5px] font-bold text-blue">
                              Enviado ✓
                            </span>
                          ) : sending ? (
                            <span className="whitespace-nowrap rounded-[7px] bg-[#eef1f4] px-[8px] py-[5px] text-[10.5px] font-semibold text-faint">
                              Enviando…
                            </span>
                          ) : (
                            <button
                              onClick={() => sendRow(row)}
                              className="whitespace-nowrap rounded-[7px] border border-line bg-white px-[8px] py-[5px] text-[10.5px] font-bold text-navy"
                            >
                              Enviar
                            </button>
                          )}
                        </div>

                        {hasFalha && (
                          <div className="max-w-[260px] text-[10.5px] font-semibold text-red">
                            ⚠{' '}
                            {row.items
                              .filter((i) => i.nfseStatus === 'falha' && i.errorMessage)
                              .map((i) => `${SERVICE_LABEL[i.serviceType]}: ${i.errorMessage}`)
                              .join(' · ')}
                          </div>
                        )}

                        {expandedIds.has(row.id) && row.items.length > 0 && (
                          <div className="flex flex-col gap-1 pl-0.5">
                            {row.items
                              .filter((it) => it.nfseStatus === 'autorizada' || it.nfseStatus === 'cancelada')
                              .map((it) => (
                                <div key={it.id}>
                                  <span className="font-display text-[10.5px] font-bold text-navy">
                                    <span className="font-sans font-medium text-faint">{SERVICE_LABEL[it.serviceType as EligibleServiceType]}: </span>
                                    <span className={it.nfseStatus === 'cancelada' ? 'line-through opacity-60' : ''}>
                                      {it.nfseNumber ?? 'processando…'}
                                    </span>
                                  </span>
                                  {it.nfseStatus === 'cancelada' && (
                                    <span className="ml-1 text-[10px] font-bold text-red-600">Cancelada</span>
                                  )}
                                  {it.nfseStatus === 'autorizada' && (
                                    <button
                                      onClick={() => cancelItem(row, it.serviceType as EligibleServiceType)}
                                      disabled={syncingIds.has(it.id)}
                                      className="ml-1 text-[10px] font-bold text-red-600 underline disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Cancelar
                                    </button>
                                  )}
                                  {it.urlDanfse ? (
                                    <a
                                      href={it.urlDanfse}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="ml-1 text-[10px] font-bold text-orange underline"
                                    >
                                      Ver DANFSe
                                    </a>
                                  ) : (
                                    <button
                                      onClick={() => syncItem(row, it.serviceType)}
                                      disabled={syncingIds.has(it.id)}
                                      className="ml-1 text-[10px] font-bold text-faint underline disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {syncingIds.has(it.id) ? 'Consultando…' : 'Atualizar (buscar PDF)'}
                                    </button>
                                  )}
                                  {it.emitterId && emittersById[it.emitterId] && (
                                    <div className="text-[10px] text-faint">
                                      {emittersById[it.emitterId].razaoSocial} · {emittersById[it.emitterId].cnpj}
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )}
      </section>
    </>
  )
}
