import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { UploadIcon } from '@/components/icons'
import { Tag, statusTag } from '@/components/dashboard/statusTags'
import { brandFromTenantName, currentMonthValue, formatBRL, formatCompetencia, slugify } from '@/lib/format'
import { simulateEmailSend, simulateWhatsappSend } from '@/lib/simulation'
import { useSettings, type EligibleServiceType, type EmitterCnpj, type EmitterMappingEntry } from '@/context/SettingsContext'
import { emitterKey } from '@/lib/liveEmitters'
import { emitirNfseReal } from '@/lib/emitNfse'
import { fetchUnits } from '@/lib/liveUnits'
import { parseSpreadsheet, type ParsedSheet } from '@/lib/spreadsheetParser'
import { ImportPreviewModal } from '@/components/faturamento/ImportPreviewModal'
import { rowMatchKey, UnitMatchModal, type UnitMatches } from '@/components/faturamento/UnitMatchModal'
import { mockInvoices } from '@/data/mockInvoices'
import { totalOf, type PendingEmissionRow } from '@/data/pendingEmissions'
import type { LiveUnit } from '@/types'

type NfseRowStatus = 'pendente' | 'emitindo' | 'emitida'
type PaymentStatus = 'a_pagar' | 'pago'
type SendStatus = 'nao_enviado' | 'enviando' | 'enviado'

interface EmittedItem {
  serviceType: EligibleServiceType
  label: string
  value: number
  nfseNumber: string | null
  urlDanfse: string | null
  emitter: EmitterCnpj | null
}

interface RowState {
  status: NfseRowStatus
  items: EmittedItem[]
  showNfse: boolean
  boletoFileName: string | null
  payment: PaymentStatus
  send: SendStatus
  lastError: string | null
}

const EMPTY_MAPPING: EmitterMappingEntry = { emitterId: null, itemListaServico: null, codigoTributarioMunicipio: null, issRetido: false }

function hasDadoFiscalCompleto(u: LiveUnit): boolean {
  return !!(u.cnpj && u.razaoSocial && u.logradouro && u.numero && u.bairro && u.cep && u.codigoMunicipio)
}

const SERVICE_LABEL: Record<EligibleServiceType, string> = {
  call_center: 'Call Center',
  royalties: 'Royalties',
  marketing: 'Marketing',
}

const initialRows = (source: PendingEmissionRow[]): Record<string, RowState> =>
  Object.fromEntries(
    source.map((r) => [
      r.id,
      {
        status: 'pendente',
        items: [],
        showNfse: false,
        boletoFileName: null,
        payment: 'a_pagar',
        send: 'nao_enviado',
        lastError: null,
      } satisfies RowState,
    ]),
  )

// Converte o resultado do parser (por aba/marca) na fila de emissão, usando o
// `unitId` já resolvido pelo `UnitMatchModal` (correlação automática por nome
// + ajuste manual do usuário) em vez de tentar casar nome de novo aqui.
// Unidade "sem cobrança no mês" fica de fora da fila (seção 3 do MD) — ela já
// apareceu no preview antes da confirmação, é só não virar fatura.
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

function servicesOf(row: PendingEmissionRow): Array<{ serviceType: EligibleServiceType; label: string; value: number }> {
  return [
    { serviceType: 'call_center', label: SERVICE_LABEL.call_center, value: row.callCenterValue },
    { serviceType: 'royalties', label: SERVICE_LABEL.royalties, value: row.royaltiesValue },
    { serviceType: 'marketing', label: SERVICE_LABEL.marketing, value: row.marketingValue },
  ]
}

// Histórico de importação/fila são fictícios (import fake), mas a fila de
// emissão abaixo usa valores fictícios "com cara de real" (ver
// src/data/pendingEmissions.ts). Boleto é só upload manual — este MVP não
// gera boleto/PIX de verdade (nem simulado). Ver TODO.md → "Inventário de
// dados fixos/fictícios".
export function Faturamento() {
  // A fila começa vazia — só reflete o que foi de fato importado/preenchido
  // pra competência atual (`confirmImport`/`confirmManualEntry`), nunca um
  // exemplo fictício "fantasma" de outro mês (pedido do usuário, 2026-09-03).
  const [pendingEmissions, setPendingEmissions] = useState<PendingEmissionRow[]>([])
  const [rows, setRows] = useState<Record<string, RowState>>({})
  // Fluxo de importação em 2 passos: primeiro correlaciona cada linha da
  // planilha com uma unidade real (`matches` ainda undefined → mostra
  // UnitMatchModal); só depois de resolvido mostra o preview de confirmação.
  const [importFlow, setImportFlow] = useState<{ fileName: string; sheets: ParsedSheet[]; matches?: UnitMatches } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [competencia, setCompetencia] = useState(currentMonthValue())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [units, setUnits] = useState<LiveUnit[]>([])
  const { serviceEligibility, sendChannel, emitterFor, emitterMapping } = useSettings()
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
    setSelectedIds((prev) => (prev.size === pendingEmissions.length ? new Set() : new Set(pendingEmissions.map((r) => r.id))))
  }

  // Exclusão em massa — pra limpar dados de teste rapidamente, sem
  // depender de status (deixa apagar até já emitida/paga, é só a fila
  // local desta competência, não desfaz nada real).
  function deleteSelected() {
    setPendingEmissions((prev) => prev.filter((r) => !selectedIds.has(r.id)))
    setRows((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !selectedIds.has(id))))
    setSelectedIds(new Set())
  }

  async function handleFileSelected(file: File) {
    setImportError(null)
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

  function confirmImport() {
    if (!importFlow?.matches) return
    const newRows = toPendingRows(importFlow.sheets, importFlow.matches)
    setPendingEmissions(newRows)
    setRows(initialRows(newRows))
    setSelectedIds(new Set())
    setImportFlow(null)
  }

  // Preenchimento manual (alternativa ao upload de planilha) — mesmo
  // destino que `confirmImport`: substitui a fila de emissão.
  function confirmManualEntry(newRows: PendingEmissionRow[], competenciaValue: string) {
    setCompetencia(competenciaValue)
    setPendingEmissions(newRows)
    setRows(initialRows(newRows))
    setSelectedIds(new Set())
  }

  const statusCounts = (Object.keys(statusTag) as Array<keyof typeof statusTag>).map((status) => ({
    status,
    count: mockInvoices.filter((inv) => inv.status === status).length,
  }))

  const pendingCount = pendingEmissions.filter((r) => rows[r.id].status === 'pendente').length

  // Só entra na fila de emissão o serviço habilitado, com valor > 0 e que
  // tenha um CNPJ emissor configurado em Configurações — sem CNPJ não dá
  // pra saber quem emite a nota, então fica de fora (igual um serviço
  // desabilitado).
  function eligibleServices(row: PendingEmissionRow) {
    return servicesOf(row).filter((s) => serviceEligibility[s.serviceType] && s.value > 0 && emitterFor(row.marca, s.serviceType))
  }

  // Emissão real via Focus NFe (Ambiente Nacional, produção) — sempre 1 nota
  // por serviço elegível, nunca consolidada. Uma NFS-e tem um único código de
  // tributação/discriminação; "juntar" Royalties + Call Center numa nota só
  // produziria uma nota fiscalmente errada (decisão tomada com o usuário).
  async function emitRow(row: PendingEmissionRow) {
    if (rows[row.id].status !== 'pendente') return
    const eligible = eligibleServices(row)
    if (eligible.length === 0) return

    const unit = row.unitId ? unitsById[row.unitId] : null
    if (!unit) {
      setRows((prev) => ({
        ...prev,
        [row.id]: { ...prev[row.id], lastError: 'Unidade não encontrada no cadastro (Franquias) — não é possível emitir.' },
      }))
      return
    }
    if (!hasDadoFiscalCompleto(unit)) {
      setRows((prev) => ({
        ...prev,
        [row.id]: { ...prev[row.id], lastError: 'Dado fiscal incompleto (CNPJ/endereço) — complete em Franquias antes de emitir.' },
      }))
      return
    }

    setRows((prev) => ({ ...prev, [row.id]: { ...prev[row.id], status: 'emitindo', lastError: null } }))

    const outcomes = await Promise.allSettled(
      eligible.map((s) =>
        emitirNfseReal({
          ambiente: 'producao',
          ref: `${row.id}-${s.serviceType}-${competencia}`,
          mapping: emitterMapping[emitterKey(row.marca, s.serviceType)] ?? EMPTY_MAPPING,
          unit,
          valor: s.value,
          discriminacao: `${s.label} — ${row.unitName} — ${formatCompetencia(competencia)}`,
        }),
      ),
    )

    const items: EmittedItem[] = []
    const errors: string[] = []
    outcomes.forEach((outcome, i) => {
      const s = eligible[i]
      if (outcome.status === 'fulfilled') {
        items.push({
          serviceType: s.serviceType,
          label: s.label,
          value: s.value,
          nfseNumber: outcome.value.numero ?? null,
          urlDanfse: outcome.value.url_danfse ?? null,
          emitter: emitterFor(row.marca, s.serviceType),
        })
      } else {
        const msg = outcome.reason instanceof Error ? outcome.reason.message : 'Falha desconhecida ao emitir.'
        errors.push(`${s.label}: ${msg}`)
      }
    })

    if (errors.length > 0) {
      setRows((prev) => ({ ...prev, [row.id]: { ...prev[row.id], status: 'pendente', lastError: errors.join(' · ') } }))
      return
    }
    setRows((prev) => ({ ...prev, [row.id]: { ...prev[row.id], status: 'emitida', items, lastError: null } }))
  }

  async function emitLote() {
    const pending = pendingEmissions.filter((r) => rows[r.id].status === 'pendente')
    await Promise.all(pending.map((row) => emitRow(row)))
  }

  function handleBoletoChange(id: string, file: File | null) {
    if (!file) return
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], boletoFileName: file.name } }))
  }

  function toggleShowNfse(id: string) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], showNfse: !prev[id].showNfse } }))
  }

  function togglePayment(id: string) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], payment: prev[id].payment === 'pago' ? 'a_pagar' : 'pago' } }))
  }

  async function sendRow(row: PendingEmissionRow) {
    if (rows[row.id].send !== 'nao_enviado') return
    setRows((prev) => ({ ...prev, [row.id]: { ...prev[row.id], send: 'enviando' } }))
    const dispatch = sendChannel === 'whatsapp' ? simulateWhatsappSend : simulateEmailSend
    await dispatch({ unitId: row.id, unitName: row.unitName })
    setRows((prev) => ({ ...prev, [row.id]: { ...prev[row.id], send: 'enviado' } }))
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
            <div className="text-[11px] text-faint">faturas · Jun/2026</div>
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
        {pendingEmissions.length === 0 ? (
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
                    checked={pendingEmissions.length > 0 && selectedIds.size === pendingEmissions.length}
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
              {pendingEmissions.map((row) => {
                const state = rows[row.id]
                const eligible = eligibleServices(row)
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
                      <span className="font-display font-bold text-navy">{formatBRL(totalOf(row))}</span>
                    </td>
                    <td className="px-5 py-[13px]">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-nowrap items-center gap-[6px]">
                          <label
                            className="cursor-pointer whitespace-nowrap rounded-[7px] border border-line bg-white px-[8px] py-[5px] text-[10.5px] font-bold text-navy"
                            title={state.boletoFileName ?? 'Anexar boleto (upload manual — este app não gera boleto)'}
                          >
                            {state.boletoFileName ? '📎 Boleto' : 'Boleto'}
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              className="hidden"
                              onChange={(e) => handleBoletoChange(row.id, e.target.files?.[0] ?? null)}
                            />
                          </label>

                          <button
                            onClick={() => togglePayment(row.id)}
                            className={`whitespace-nowrap rounded-[7px] px-[8px] py-[5px] text-[10.5px] font-bold ${
                              state.payment === 'pago' ? 'bg-green-soft text-green' : 'bg-amber-soft text-amber'
                            }`}
                          >
                            {state.payment === 'pago' ? 'Pago ✓' : 'A pagar'}
                          </button>

                          {state.status === 'pendente' && (
                            <button
                              disabled={eligible.length === 0}
                              onClick={() => emitRow(row)}
                              title={eligible.length === 0 ? 'Nenhum serviço elegível (verifique habilitação e CNPJ emissor em Configurações)' : undefined}
                              className="whitespace-nowrap rounded-[7px] bg-orange px-[8px] py-[5px] text-[10.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {state.lastError ? 'Tentar de novo' : 'Emitir'}
                            </button>
                          )}
                          {state.status === 'emitindo' && (
                            <span className="whitespace-nowrap rounded-[7px] bg-[#eef1f4] px-[8px] py-[5px] text-[10.5px] font-semibold text-faint">
                              Emitindo…
                            </span>
                          )}
                          {state.status === 'emitida' && (
                            <button
                              onClick={() => toggleShowNfse(row.id)}
                              className="whitespace-nowrap rounded-[7px] bg-green-soft px-[8px] py-[5px] text-[10.5px] font-bold text-green"
                            >
                              Ver nota fiscal
                            </button>
                          )}

                          {state.send === 'nao_enviado' && (
                            <button
                              onClick={() => sendRow(row)}
                              className="whitespace-nowrap rounded-[7px] border border-line bg-white px-[8px] py-[5px] text-[10.5px] font-bold text-navy"
                            >
                              Enviar
                            </button>
                          )}
                          {state.send === 'enviando' && (
                            <span className="whitespace-nowrap rounded-[7px] bg-[#eef1f4] px-[8px] py-[5px] text-[10.5px] font-semibold text-faint">
                              Enviando…
                            </span>
                          )}
                          {state.send === 'enviado' && (
                            <span className="whitespace-nowrap rounded-[7px] bg-blue-soft px-[8px] py-[5px] text-[10.5px] font-bold text-blue">
                              Enviado ✓
                            </span>
                          )}
                        </div>

                        {state.lastError && <div className="max-w-[260px] text-[10.5px] font-semibold text-red">⚠ {state.lastError}</div>}

                        {state.status === 'emitida' && state.showNfse && (
                          <div className="flex flex-col gap-1 pl-0.5">
                            {state.items.map((it) => (
                              <div key={it.serviceType}>
                                <span className="font-display text-[10.5px] font-bold text-navy">
                                  <span className="font-sans font-medium text-faint">{it.label}: </span>
                                  {it.nfseNumber ?? 'processando…'}
                                </span>
                                {it.urlDanfse && (
                                  <a
                                    href={it.urlDanfse}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ml-1 text-[10px] font-bold text-orange underline"
                                  >
                                    Ver DANFSe
                                  </a>
                                )}
                                {it.emitter && (
                                  <div className="text-[10px] text-faint">
                                    {it.emitter.razaoSocial} · {it.emitter.cnpj}
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
