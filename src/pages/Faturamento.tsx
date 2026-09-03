import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { UploadIcon } from '@/components/icons'
import { SimBadge } from '@/components/SimBadge'
import { Tag, statusTag } from '@/components/dashboard/statusTags'
import { currentMonthValue, formatBRL, formatCompetencia, slugify } from '@/lib/format'
import { simulateEmailSend, simulateNfseEmission, simulateWhatsappSend } from '@/lib/simulation'
import { useSettings, type EligibleServiceType, type EmitterCnpj } from '@/context/SettingsContext'
import { parseSpreadsheet, type ParsedSheet } from '@/lib/spreadsheetParser'
import { ImportPreviewModal } from '@/components/faturamento/ImportPreviewModal'
import { ManualEntryModal } from '@/components/faturamento/ManualEntryModal'
import { mockInvoices } from '@/data/mockInvoices'
import { importHistory as initialImportHistory, lastImportWarnings, type ImportHistoryEntry } from '@/data/mockFaturamento'
import { pendingEmissions as defaultPendingEmissions, totalOf, type PendingEmissionRow } from '@/data/pendingEmissions'
import type { Brand } from '@/types'

type EmitMode = 'consolidado' | 'separado'
type ServiceKey = 'consolidado' | EligibleServiceType
type NfseRowStatus = 'pendente' | 'emitindo' | 'emitida'
type PaymentStatus = 'a_pagar' | 'pago'
type SendStatus = 'nao_enviado' | 'enviando' | 'enviado'

interface EmittedItem {
  serviceType: ServiceKey
  label: string
  value: number
  nfseNumber: string
  emitter: EmitterCnpj | null
}

interface RowState {
  mode: EmitMode
  status: NfseRowStatus
  items: EmittedItem[]
  showNfse: boolean
  boletoFileName: string | null
  payment: PaymentStatus
  send: SendStatus
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
        mode: 'consolidado',
        status: 'pendente',
        items: [],
        showNfse: false,
        boletoFileName: null,
        payment: 'a_pagar',
        send: 'nao_enviado',
      } satisfies RowState,
    ]),
  )

// Converte o resultado do parser (por aba/marca) na fila de emissão. Unidade
// "sem cobrança no mês" fica de fora da fila (seção 3 do MD) — ela já
// apareceu no preview antes da confirmação, é só não virar fatura.
function toPendingRows(sheets: ParsedSheet[]): PendingEmissionRow[] {
  return sheets.flatMap((sheet) => {
    const marca: Brand = sheet.tenantName.trim().toLowerCase() === 'the duck' ? 'The Duck' : 'Forneria'
    return sheet.rows
      .filter((r) => !r.hasNoCharge)
      .map((r) => {
        const cleanName = r.unitName.replace(/^The Duck Pizzaria\s*-\s*/i, '').trim()
        const unitName = marca === 'Forneria' ? `Forneria ${cleanName}` : `The Duck ${cleanName}`
        return {
          id: `${slugify(marca)}-${slugify(cleanName)}`,
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
  const [pendingEmissions, setPendingEmissions] = useState<PendingEmissionRow[]>(defaultPendingEmissions)
  const [rows, setRows] = useState<Record<string, RowState>>(() => initialRows(defaultPendingEmissions))
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>(initialImportHistory)
  const [preview, setPreview] = useState<{ fileName: string; sheets: ParsedSheet[] } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [competencia, setCompetencia] = useState(currentMonthValue())
  const [showManualEntry, setShowManualEntry] = useState(false)
  const { serviceEligibility, sendChannel, emitterFor } = useSettings()

  async function handleFileSelected(file: File) {
    setImportError(null)
    try {
      const buffer = await file.arrayBuffer()
      const sheets = parseSpreadsheet(buffer)
      if (sheets.every((s) => s.rows.length === 0)) {
        setImportError('Nenhuma unidade reconhecida nessa planilha — confira se o formato bate com o esperado.')
        return
      }
      setPreview({ fileName: file.name, sheets })
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Falha ao ler a planilha.')
    }
  }

  function confirmImport() {
    if (!preview) return
    const newRows = toPendingRows(preview.sheets)
    setPendingEmissions(newRows)
    setRows(initialRows(newRows))
    const totalRows = preview.sheets.reduce((sum, s) => sum + s.rows.length, 0)
    const totalWarnings = preview.sheets.reduce((sum, s) => sum + s.warnings.length, 0)
    setImportHistory((prev) => [
      {
        id: `import-${Date.now()}`,
        competencia: formatCompetencia(competencia),
        arquivo: preview.fileName,
        importadoEm: new Date().toLocaleString('pt-BR'),
        importadoPor: 'Você',
        unidadesReconhecidas: totalRows,
        alertas: totalWarnings,
        status: 'confirmada',
      },
      ...prev,
    ])
    setPreview(null)
  }

  // Preenchimento manual (alternativa ao upload de planilha) — mesmo
  // destino que `confirmImport`: substitui a fila de emissão e registra no
  // histórico, só que a "origem" fica marcada como preenchimento manual em
  // vez de nome de arquivo.
  function confirmManualEntry(newRows: PendingEmissionRow[], competenciaValue: string) {
    setCompetencia(competenciaValue)
    setPendingEmissions(newRows)
    setRows(initialRows(newRows))
    setImportHistory((prev) => [
      {
        id: `manual-${Date.now()}`,
        competencia: formatCompetencia(competenciaValue),
        arquivo: 'Preenchimento manual',
        importadoEm: new Date().toLocaleString('pt-BR'),
        importadoPor: 'Você',
        unidadesReconhecidas: newRows.length,
        alertas: 0,
        status: 'confirmada',
      },
      ...prev,
    ])
    setShowManualEntry(false)
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

  // "1 nota" só é possível quando todos os serviços elegíveis compartilham o
  // mesmo CNPJ emissor — uma NFS-e não pode sair de dois CNPJs diferentes.
  function canConsolidate(row: PendingEmissionRow) {
    const ids = new Set(eligibleServices(row).map((s) => emitterFor(row.marca, s.serviceType)?.id))
    return ids.size <= 1
  }

  function setMode(id: string, mode: EmitMode) {
    setRows((prev) => (prev[id].status === 'pendente' ? { ...prev, [id]: { ...prev[id], mode } } : prev))
  }

  async function emitRow(row: PendingEmissionRow) {
    if (rows[row.id].status !== 'pendente') return
    const mode = rows[row.id].mode
    const eligible = eligibleServices(row)
    if (eligible.length === 0) return
    if (mode === 'consolidado' && !canConsolidate(row)) return

    setRows((prev) => ({ ...prev, [row.id]: { ...prev[row.id], status: 'emitindo' } }))

    let items: EmittedItem[]
    if (mode === 'consolidado') {
      const result = await simulateNfseEmission({ unitId: row.id, unitName: row.unitName })
      const value = eligible.reduce((sum, s) => sum + s.value, 0)
      const label = eligible.length === 3 ? 'Consolidada' : `Consolidada (${eligible.map((s) => s.label).join(' + ')})`
      const emitter = emitterFor(row.marca, eligible[0].serviceType)
      items = [{ serviceType: 'consolidado', label, value, nfseNumber: result.nfseNumber, emitter }]
    } else {
      const results = await Promise.all(eligible.map(() => simulateNfseEmission({ unitId: row.id, unitName: row.unitName })))
      items = eligible.map((s, i) => ({ ...s, nfseNumber: results[i].nfseNumber, emitter: emitterFor(row.marca, s.serviceType) }))
    }

    setRows((prev) => ({ ...prev, [row.id]: { ...prev[row.id], status: 'emitida', items } }))
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
      <PageHeader title="Faturamento" subtitle="Importar planilha, preencher manualmente, emitir nota, cobrar e enviar — fluxo simulado">
        <div className="flex items-center gap-2 rounded-[11px] border border-line bg-card px-[13px] py-[9px] text-[12.5px] font-semibold text-navy">
          Competência: {formatCompetencia(competencia)}
        </div>
        <button
          onClick={() => setShowManualEntry(true)}
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

      {preview && (
        <ImportPreviewModal fileName={preview.fileName} sheets={preview.sheets} onCancel={() => setPreview(null)} onConfirm={confirmImport} />
      )}

      {showManualEntry && <ManualEntryModal onCancel={() => setShowManualEntry(false)} onConfirm={confirmManualEntry} />}

      <section className="mb-[18px] grid grid-cols-6 gap-3 max-[1080px]:grid-cols-3 max-[560px]:grid-cols-2">
        {statusCounts.map(({ status, count }) => (
          <div key={status} className="animate-rise rounded-card border border-line bg-card p-4 shadow-card">
            <div className="mb-2">
              <Tag tone={statusTag[status].tone} label={statusTag[status].label} />
            </div>
            <div className="num text-[22px] text-navy">{count}</div>
            <div className="text-[11px] text-faint">faturas · Jun/2026</div>
          </div>
        ))}
      </section>

      <section className="mb-[18px] animate-rise overflow-hidden rounded-card border border-line bg-card shadow-card" style={{ animationDelay: '.06s' }}>
        <div className="flex items-center justify-between px-5 pb-[13px] pt-[17px]">
          <div>
            <h3 className="text-[14.5px] font-bold text-navy">Emitir nota fiscal por unidade</h3>
            <p className="mt-0.5 text-[11.5px] text-faint">
              Emite só os serviços habilitados em Configurações · anexe o boleto, marque como pago e envie a cobrança
            </p>
          </div>
          <SimBadge label="NFS-e SIMULADA" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse">
            <thead>
              <tr>
                {['Unidade', 'Call Center', 'Royalties', 'Marketing', 'Total', 'Modo de emissão', 'Ações'].map((h, i) => (
                  <th
                    key={h}
                    className={`border-y border-line bg-[#fafbfc] px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint ${
                      i >= 1 && i <= 4 ? 'text-right' : ''
                    } ${i === 6 ? 'min-w-[280px]' : ''}`}
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
                      <div className="inline-flex overflow-hidden rounded-[9px] border border-line">
                        <button
                          disabled={state.status !== 'pendente' || !canConsolidate(row)}
                          onClick={() => setMode(row.id, 'consolidado')}
                          title={!canConsolidate(row) ? 'Serviços elegíveis usam CNPJs emissores diferentes — só dá pra emitir separado' : undefined}
                          className={`px-[10px] py-[6px] text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
                            state.mode === 'consolidado' ? 'bg-orange text-white' : 'bg-white text-navy'
                          }`}
                        >
                          1 nota
                        </button>
                        <button
                          disabled={state.status !== 'pendente'}
                          onClick={() => setMode(row.id, 'separado')}
                          className={`border-l border-line px-[10px] py-[6px] text-[11px] font-bold disabled:cursor-not-allowed ${
                            state.mode === 'separado' ? 'bg-orange text-white' : 'bg-white text-navy'
                          }`}
                        >
                          até 3 notas
                        </button>
                      </div>
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
                              disabled={eligible.length === 0 || (state.mode === 'consolidado' && !canConsolidate(row))}
                              onClick={() => emitRow(row)}
                              title={
                                eligible.length === 0
                                  ? 'Nenhum serviço elegível (verifique habilitação e CNPJ emissor em Configurações)'
                                  : state.mode === 'consolidado' && !canConsolidate(row)
                                    ? 'Troque para "até 3 notas" — CNPJs emissores diferentes'
                                    : undefined
                              }
                              className="whitespace-nowrap rounded-[7px] bg-orange px-[8px] py-[5px] text-[10.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Emitir
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

                        {state.status === 'emitida' && state.showNfse && (
                          <div className="flex flex-col gap-1 pl-0.5">
                            {state.items.map((it) => (
                              <div key={it.serviceType}>
                                <span className="font-display text-[10.5px] font-bold text-navy">
                                  {state.items.length > 1 && <span className="font-sans font-medium text-faint">{it.label}: </span>}
                                  {it.nfseNumber}
                                </span>
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
      </section>

      <section className="mb-[18px] animate-rise rounded-card border border-line bg-card p-5 shadow-card" style={{ animationDelay: '.1s' }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14.5px] font-bold text-navy">Última importação</h3>
          <SimBadge label="DADOS FICTÍCIOS" />
        </div>
        <div className="grid grid-cols-4 gap-4 max-[900px]:grid-cols-2">
          <Field label="Arquivo" value={importHistory[0].arquivo} />
          <Field label="Importado em" value={importHistory[0].importadoEm} />
          <Field label="Importado por" value={importHistory[0].importadoPor} />
          <Field label="Unidades reconhecidas" value={String(importHistory[0].unidadesReconhecidas)} />
        </div>
        {lastImportWarnings.length > 0 && (
          <div className="mt-4 rounded-[11px] bg-amber-soft p-3 text-[12px] font-medium text-amber">
            {lastImportWarnings.map((w) => (
              <div key={w}>⚠ {w}</div>
            ))}
          </div>
        )}
      </section>

      <section className="animate-rise overflow-hidden rounded-card border border-line bg-card shadow-card" style={{ animationDelay: '.14s' }}>
        <div className="flex items-center justify-between px-5 pb-[13px] pt-[17px]">
          <h3 className="text-[14.5px] font-bold text-navy">Histórico de importações</h3>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Competência', 'Arquivo', 'Importado em', 'Unidades', 'Alertas', 'Status'].map((h) => (
                <th key={h} className="border-y border-line bg-[#fafbfc] px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {importHistory.map((entry) => (
              <tr key={entry.id} className="border-b border-line last:border-none hover:bg-[#fafbfc]">
                <td className="px-5 py-[13px] text-[13px] font-semibold text-navy">{entry.competencia}</td>
                <td className="px-5 py-[13px] text-[12px] text-muted">{entry.arquivo}</td>
                <td className="px-5 py-[13px] text-[12px] text-muted">{entry.importadoEm}</td>
                <td className="px-5 py-[13px] text-[12px] text-muted">{entry.unidadesReconhecidas}</td>
                <td className="px-5 py-[13px] text-[12px] text-muted">{entry.alertas}</td>
                <td className="px-5 py-[13px]">
                  <Tag tone={entry.status === 'confirmada' ? 'g' : 'a'} label={entry.status === 'confirmada' ? 'Confirmada' : 'Processando'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">{label}</div>
      <div className="mt-1 text-[13px] font-semibold text-navy">{value}</div>
    </div>
  )
}
