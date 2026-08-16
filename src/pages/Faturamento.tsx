import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { UploadIcon } from '@/components/icons'
import { SimBadge } from '@/components/SimBadge'
import { Tag, statusTag } from '@/components/dashboard/statusTags'
import { formatBRL } from '@/lib/format'
import { simulateNfseEmission } from '@/lib/simulation'
import { mockInvoices } from '@/data/mockInvoices'
import { importHistory, lastImportWarnings } from '@/data/mockFaturamento'
import { pendingEmissions, totalOf, type PendingEmissionRow } from '@/data/pendingEmissions'

type EmitMode = 'consolidado' | 'separado'
type ServiceKey = 'consolidado' | 'call_center' | 'royalties' | 'marketing'
type RowStatus = 'pendente' | 'emitindo' | 'emitida'

interface EmittedItem {
  serviceType: ServiceKey
  label: string
  value: number
  nfseNumber: string
}

interface RowState {
  mode: EmitMode
  status: RowStatus
  items: EmittedItem[]
}

const initialRows = (): Record<string, RowState> =>
  Object.fromEntries(pendingEmissions.map((r) => [r.id, { mode: 'consolidado', status: 'pendente', items: [] } satisfies RowState]))

// Histórico de importação/fila são fictícios (import fake), mas a fila de
// emissão abaixo usa valores reais de Junho/2026 (ver src/data/pendingEmissions.ts).
// Ver TODO.md → "Inventário de dados fixos/fictícios".
export function Faturamento() {
  const [rows, setRows] = useState<Record<string, RowState>>(initialRows)

  const statusCounts = (Object.keys(statusTag) as Array<keyof typeof statusTag>).map((status) => ({
    status,
    count: mockInvoices.filter((inv) => inv.status === status).length,
  }))

  const pendingCount = pendingEmissions.filter((r) => rows[r.id].status === 'pendente').length

  function setMode(id: string, mode: EmitMode) {
    setRows((prev) => (prev[id].status === 'pendente' ? { ...prev, [id]: { ...prev[id], mode } } : prev))
  }

  async function emitRow(row: PendingEmissionRow) {
    if (rows[row.id].status !== 'pendente') return
    const mode = rows[row.id].mode
    setRows((prev) => ({ ...prev, [row.id]: { ...prev[row.id], status: 'emitindo' } }))

    let items: EmittedItem[]
    if (mode === 'consolidado') {
      const result = await simulateNfseEmission({ unitId: row.id, unitName: row.unitName })
      items = [{ serviceType: 'consolidado', label: 'Consolidada', value: totalOf(row), nfseNumber: result.nfseNumber }]
    } else {
      const allServices: Array<{ serviceType: ServiceKey; label: string; value: number }> = [
        { serviceType: 'call_center', label: 'Call Center', value: row.callCenterValue },
        { serviceType: 'royalties', label: 'Royalties', value: row.royaltiesValue },
        { serviceType: 'marketing', label: 'Marketing', value: row.marketingValue },
      ]
      const candidates = allServices.filter((c) => c.value > 0)
      const results = await Promise.all(candidates.map(() => simulateNfseEmission({ unitId: row.id, unitName: row.unitName })))
      items = candidates.map((c, i) => ({ ...c, nfseNumber: results[i].nfseNumber }))
    }

    setRows((prev) => ({ ...prev, [row.id]: { ...prev[row.id], status: 'emitida', items } }))
  }

  async function emitLote() {
    const pending = pendingEmissions.filter((r) => rows[r.id].status === 'pendente')
    await Promise.all(pending.map((row) => emitRow(row)))
  }

  return (
    <>
      <PageHeader title="Faturamento" subtitle="Importar planilha e emitir lote — fluxo simulado">
        <div className="flex items-center gap-2 rounded-[11px] border border-line bg-card px-[13px] py-[9px] text-[12.5px] font-semibold text-navy">
          Competência: Junho / 2026
        </div>
        <button className="inline-flex items-center gap-2 rounded-[11px] border border-line bg-card px-[15px] py-[10px] text-[12.5px] font-bold text-navy">
          <UploadIcon className="h-4 w-4" /> Importar planilha
        </button>
        <button
          onClick={emitLote}
          disabled={pendingCount === 0}
          className="inline-flex items-center gap-2 rounded-[11px] bg-orange px-[15px] py-[10px] text-[12.5px] font-bold text-white shadow-[0_6px_14px_rgba(233,78,27,.28)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Emitir lote {pendingCount > 0 && `(${pendingCount})`}
        </button>
      </PageHeader>

      <section className="mb-[18px] grid grid-cols-6 gap-3 max-[1080px]:grid-cols-3 max-[560px]:grid-cols-2">
        {statusCounts.map(({ status, count }) => (
          <div key={status} className="animate-rise rounded-card bg-card p-4 shadow-card">
            <div className="mb-2">
              <Tag tone={statusTag[status].tone} label={statusTag[status].label} />
            </div>
            <div className="num text-[22px] text-navy">{count}</div>
            <div className="text-[11px] text-faint">faturas · Jun/2026</div>
          </div>
        ))}
      </section>

      <section className="mb-[18px] animate-rise overflow-hidden rounded-card bg-card shadow-card" style={{ animationDelay: '.06s' }}>
        <div className="flex items-center justify-between px-5 pb-[13px] pt-[17px]">
          <div>
            <h3 className="text-[14.5px] font-bold text-navy">Emitir nota fiscal por unidade</h3>
            <p className="mt-0.5 text-[11.5px] text-faint">
              Valores reais de Junho/2026 · escolha 1 nota consolidada ou até 3 (por serviço) antes de emitir
            </p>
          </div>
          <SimBadge label="NFS-e SIMULADA" />
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Unidade', 'Call Center', 'Royalties', 'Marketing', 'Total', 'Modo de emissão', 'Nota(s) fiscal(is)', ''].map((h, i) => (
                <th
                  key={h}
                  className={`border-y border-line bg-[#fafbfc] px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint ${
                    i >= 1 && i <= 4 ? 'text-right' : ''
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pendingEmissions.map((row) => {
              const state = rows[row.id]
              return (
                <tr key={row.id} className="border-b border-line last:border-none hover:bg-[#fafbfc]">
                  <td className="px-5 py-[13px] text-[13px] font-semibold text-navy">{row.unitName}</td>
                  <td className="px-5 py-[13px] text-right text-[12px] text-muted">{formatBRL(row.callCenterValue)}</td>
                  <td className="px-5 py-[13px] text-right text-[12px] text-muted">{formatBRL(row.royaltiesValue)}</td>
                  <td className="px-5 py-[13px] text-right text-[12px] text-muted">{formatBRL(row.marketingValue)}</td>
                  <td className="px-5 py-[13px] text-right">
                    <span className="font-display font-bold text-navy">{formatBRL(totalOf(row))}</span>
                  </td>
                  <td className="px-5 py-[13px]">
                    <div className="inline-flex overflow-hidden rounded-[9px] border border-line">
                      <button
                        disabled={state.status !== 'pendente'}
                        onClick={() => setMode(row.id, 'consolidado')}
                        className={`px-[10px] py-[6px] text-[11px] font-bold disabled:cursor-not-allowed ${
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
                    {state.status === 'pendente' && <span className="text-[11.5px] text-faint">—</span>}
                    {state.status === 'emitindo' && (
                      <span className="text-[11.5px] font-semibold text-amber">Emitindo…</span>
                    )}
                    {state.status === 'emitida' && (
                      <div className="flex flex-col gap-1">
                        {state.items.map((it) => (
                          <span key={it.serviceType} className="font-display text-[11.5px] font-bold text-navy">
                            {state.items.length > 1 && <span className="font-sans font-medium text-faint">{it.label}: </span>}
                            {it.nfseNumber}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-[13px] text-right">
                    {state.status === 'pendente' && (
                      <button
                        onClick={() => emitRow(row)}
                        className="rounded-[8px] bg-orange px-[12px] py-[7px] text-[11px] font-bold text-white"
                      >
                        Emitir
                      </button>
                    )}
                    {state.status === 'emitindo' && <span className="text-[11px] font-semibold text-faint">…</span>}
                    {state.status === 'emitida' && <Tag tone="g" label="Emitida" />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="mb-[18px] animate-rise rounded-card bg-card p-5 shadow-card" style={{ animationDelay: '.1s' }}>
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

      <section className="animate-rise overflow-hidden rounded-card bg-card shadow-card" style={{ animationDelay: '.14s' }}>
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
