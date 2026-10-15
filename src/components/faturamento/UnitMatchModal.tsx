import { useMemo, useState } from 'react'
import { brandFromTenantName, slugify } from '@/lib/format'
import type { ParsedSheet } from '@/lib/spreadsheetParser'
import type { LiveUnit } from '@/types'

// Chave estável por linha da planilha — usada tanto aqui quanto em
// `toPendingRows` (Faturamento.tsx) pra ligar a escolha do usuário na linha
// certa. Baseada no índice original de `sheet.rows` (antes de filtrar "sem
// cobrança"), nunca reindexado, pra não embaralhar ao comparar os dois lados.
export function rowMatchKey(sheetIdx: number, rowIdx: number): string {
  return `${sheetIdx}-${rowIdx}`
}

// `undefined` = linha sem correspondência automática e o usuário ainda não
// decidiu nada (bloqueia "Continuar"). `null` = usuário decidiu
// explicitamente "sem correspondência". `string` = id de uma unidade real.
export type UnitMatches = Record<string, string | null>

interface MatchCandidate {
  sheetIdx: number
  rowIdx: number
  key: string
  rowName: string
  marca: LiveUnit['marca']
  values: { callCenter: number; royalties: number; marketing: number; total: number }
  autoMatchedId: string | null
}

function cleanRowName(rowName: string): string {
  return rowName.replace(/^The Duck Pizzaria\s*-\s*/i, '').trim()
}

// Match automático por nome normalizado (acento/caixa/pontuação fora, via
// `slugify`) — exato primeiro; se não achar, tenta conter/ser contido (ex:
// planilha com "Barra da Tijuca" batendo unidade cadastrada "Barra Tijuca").
// Ambíguo (mais de uma candidata por "contains") não autocompleta sozinho —
// fica pro usuário escolher, conforme pedido.
function autoMatch(rowName: string, candidates: LiveUnit[]): LiveUnit | null {
  const target = slugify(cleanRowName(rowName))
  if (!target) return null
  const exact = candidates.find((u) => slugify(u.name) === target)
  if (exact) return exact
  const partial = candidates.filter((u) => {
    const un = slugify(u.name)
    return un.length > 2 && (target.includes(un) || un.includes(target))
  })
  return partial.length === 1 ? partial[0] : null
}

function buildCandidates(sheets: ParsedSheet[], units: LiveUnit[]): MatchCandidate[] {
  return sheets.flatMap((sheet, sheetIdx) => {
    const marca = brandFromTenantName(sheet.tenantName)
    const brandUnits = units.filter((u) => u.marca === marca)
    return sheet.rows
      .map((r, rowIdx) => ({ r, rowIdx }))
      .filter(({ r }) => !r.hasNoCharge)
      .map(({ r, rowIdx }) => ({
        sheetIdx,
        rowIdx,
        key: rowMatchKey(sheetIdx, rowIdx),
        rowName: r.unitName,
        marca,
        values: { callCenter: r.callCenterValue, royalties: r.royaltiesValue, marketing: r.marketingValue, total: r.totalValue },
        autoMatchedId: autoMatch(r.unitName, brandUnits)?.id ?? null,
      }))
  })
}

interface UnitMatchModalProps {
  fileName: string
  sheets: ParsedSheet[]
  units: LiveUnit[]
  onCancel: () => void
  onConfirm: (matches: UnitMatches) => void
}

// Passo antes do preview de importação: correlaciona cada linha da planilha
// com uma unidade real do Supabase (precisa do `unitId` pra emitir de
// verdade depois). Tenta casar pelo nome automaticamente; linha sem
// correspondência clara fica destacada e precisa de escolha manual do
// usuário antes de liberar "Continuar".
export function UnitMatchModal({ fileName, sheets, units, onCancel, onConfirm }: UnitMatchModalProps) {
  const candidates = useMemo(() => buildCandidates(sheets, units), [sheets, units])
  const [choices, setChoices] = useState<Record<string, string | null | undefined>>(() =>
    Object.fromEntries(candidates.map((c) => [c.key, c.autoMatchedId])),
  )

  const unresolvedCount = candidates.filter((c) => choices[c.key] === undefined).length
  const autoMatchedCount = candidates.filter((c) => c.autoMatchedId !== null).length

const NO_MATCH = '__none__'

  function setChoice(key: string, value: string) {
    setChoices((prev) => ({ ...prev, [key]: value === NO_MATCH ? null : value }))
  }

  function handleConfirm() {
    if (unresolvedCount > 0) return
    const resolved: UnitMatches = Object.fromEntries(Object.entries(choices).map(([k, v]) => [k, v ?? null]))
    onConfirm(resolved)
  }

  const byMarca = useMemo(() => {
    const map = new Map<LiveUnit['marca'], MatchCandidate[]>()
    for (const c of candidates) {
      const list = map.get(c.marca) ?? []
      list.push(c)
      map.set(c.marca, list)
    }
    return map
  }, [candidates])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="max-h-[90vh] w-full max-w-[820px] overflow-y-auto rounded-card border border-line bg-card p-6 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-bold text-navy">Correlacionar unidades</h3>
        <p className="mt-1 text-[12.5px] text-muted">{fileName}</p>
        <p className="mt-2 text-[12px] text-faint">
          {autoMatchedCount} de {candidates.length} unidade{candidates.length === 1 ? '' : 's'} correspondida{candidates.length === 1 ? '' : 's'}{' '}
          automaticamente pelo nome. {unresolvedCount > 0 ? `${unresolvedCount} precisa${unresolvedCount === 1 ? '' : 'm'} de correlação manual.` : 'Tudo certo.'}
        </p>

        {[...byMarca.entries()].map(([marca, rows]) => (
          <div key={marca} className="mt-5">
            <h4 className="mb-2 text-[13px] font-bold text-navy">{marca}</h4>
            <div className="overflow-hidden rounded-[9px] border border-line">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Unidade (planilha)', 'Total', 'Unidade correspondente'].map((h, i) => (
                      <th
                        key={h}
                        className={`bg-[#fafbfc] px-3 py-[8px] text-left text-[10px] font-bold uppercase tracking-[.05em] text-faint ${i === 1 ? 'text-right' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const unresolved = choices[c.key] === undefined
                    const noMatch = choices[c.key] === null
                    return (
                      <tr key={c.key} className={`border-t border-line ${unresolved ? 'bg-red-soft' : noMatch ? 'bg-amber-soft' : ''}`}>
                        <td className="px-3 py-[7px] text-[12px] font-semibold text-navy">{c.rowName}</td>
                        <td className="px-3 py-[7px] text-right text-[11.5px] text-muted">
                          {c.values.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-3 py-[7px]">
                          <select
                            value={choices[c.key] ?? ''}
                            onChange={(e) => setChoice(c.key, e.target.value)}
                            className={`w-full rounded-[7px] border bg-white px-2 py-[5px] text-[11.5px] text-navy focus:outline-none focus:ring-1 focus:ring-orange-soft ${
                              unresolved ? 'border-red' : 'border-line'
                            }`}
                          >
                            <option value="" disabled={!unresolved}>
                              {unresolved ? 'Selecione…' : ''}
                            </option>
                            <option value="">— Sem correspondência —</option>
                            {units
                              .filter((u) => u.marca === c.marca)
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className="mt-6 flex items-center justify-between gap-2">
          <p className="text-[11.5px] text-faint">Sem correspondência = entra na fila sem CNPJ/endereço (não emite até você corrigir em Franquias).</p>
          <div className="flex shrink-0 gap-2">
            <button onClick={onCancel} className="rounded-[9px] border border-line px-4 py-[9px] text-[12.5px] font-bold text-navy">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={unresolvedCount > 0}
              title={unresolvedCount > 0 ? 'Resolva as linhas destacadas antes de continuar' : undefined}
              className="rounded-[9px] bg-orange px-4 py-[9px] text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
