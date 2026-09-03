import { useMemo, useState } from 'react'
import { currentMonthValue, slugify } from '@/lib/format'
import { franchiseUnits, franchiseBrands } from '@/data/units'
import type { PendingEmissionRow } from '@/data/pendingEmissions'
import type { Brand } from '@/types'

interface ManualEntryModalProps {
  onCancel: () => void
  onConfirm: (rows: PendingEmissionRow[], competenciaValue: string) => void
}

type BrandFilter = Brand | 'todas'

interface RowInput {
  callCenter: string
  royalties: string
  marketing: string
}

const EMPTY_INPUT: RowInput = { callCenter: '', royalties: '', marketing: '' }

function parseValue(text: string): number {
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

// Preenchimento manual dos valores do mês direto na tela, alternativa ao
// upload de planilha — mesmo destino (`PendingEmissionRow[]`) e mesma regra
// de "sem cobrança fica de fora da fila" que `toPendingRows` usa pro
// caminho de importação de arquivo. Lista as 69 unidades reais cadastradas
// (`franchiseUnits`), não a fila fictícia de 8 unidades.
export function ManualEntryModal({ onCancel, onConfirm }: ManualEntryModalProps) {
  const [competencia, setCompetencia] = useState(currentMonthValue())
  const [brandFilter, setBrandFilter] = useState<BrandFilter>('todas')
  const [values, setValues] = useState<Record<string, RowInput>>({})

  const visibleUnits = useMemo(
    () => franchiseUnits.filter((u) => u.ativo && (brandFilter === 'todas' || u.marca === brandFilter)),
    [brandFilter],
  )

  function setField(unitId: string, field: keyof RowInput, text: string) {
    setValues((prev) => ({ ...prev, [unitId]: { ...(prev[unitId] ?? EMPTY_INPUT), [field]: text } }))
  }

  const filledCount = franchiseUnits.filter((u) => {
    const v = values[u.id]
    return v && (parseValue(v.callCenter) > 0 || parseValue(v.royalties) > 0 || parseValue(v.marketing) > 0)
  }).length

  function handleConfirm() {
    const rows: PendingEmissionRow[] = franchiseUnits
      .map((u) => {
        const v = values[u.id] ?? EMPTY_INPUT
        const callCenterValue = parseValue(v.callCenter)
        const royaltiesValue = parseValue(v.royalties)
        const marketingValue = parseValue(v.marketing)
        return {
          id: `${slugify(u.marca)}-${slugify(u.nome)}`,
          unitName: `${u.marca} ${u.nome}`,
          marca: u.marca,
          callCenterValue,
          royaltiesValue,
          marketingValue,
        } satisfies PendingEmissionRow
      })
      .filter((r) => r.callCenterValue > 0 || r.royaltiesValue > 0 || r.marketingValue > 0)
    onConfirm(rows, competencia)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-card border border-line bg-card shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 pb-4 pt-5">
          <div>
            <h3 className="text-[16px] font-bold text-navy">Preencher valores do mês</h3>
            <p className="mt-0.5 text-[12px] text-muted">
              Lança Call Center, Royalties e Marketing por unidade — vira a fila de emissão, igual importar planilha.
            </p>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[.05em] text-faint">Competência</span>
            <input
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="rounded-[9px] border border-line bg-white px-[11px] py-[7px] text-[12.5px] font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-orange-soft"
            />
          </label>
        </div>

        <div className="flex gap-2 border-b border-line px-6 py-3">
          <BrandFilterTab label="Todas as marcas" active={brandFilter === 'todas'} onClick={() => setBrandFilter('todas')} />
          {franchiseBrands.map((b) => (
            <BrandFilterTab key={b} label={b} active={brandFilter === b} onClick={() => setBrandFilter(b)} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-card">
              <tr>
                {['Unidade', 'Marca', 'Call Center', 'Royalties', 'Marketing'].map((h, i) => (
                  <th
                    key={h}
                    className={`border-b border-line bg-[#fafbfc] px-3 py-[9px] text-left text-[10px] font-bold uppercase tracking-[.05em] text-faint ${
                      i >= 2 ? 'text-right' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleUnits.map((u) => {
                const v = values[u.id] ?? EMPTY_INPUT
                return (
                  <tr key={u.id} className="border-b border-line last:border-none">
                    <td className="px-3 py-[6px] text-[12.5px] font-semibold text-navy">{u.nome}</td>
                    <td className="px-3 py-[6px] text-[11px] text-faint">{u.marca}</td>
                    <td className="px-3 py-[6px]">
                      <ValueInput value={v.callCenter} onChange={(t) => setField(u.id, 'callCenter', t)} />
                    </td>
                    <td className="px-3 py-[6px]">
                      <ValueInput value={v.royalties} onChange={(t) => setField(u.id, 'royalties', t)} />
                    </td>
                    <td className="px-3 py-[6px]">
                      <ValueInput value={v.marketing} onChange={(t) => setField(u.id, 'marketing', t)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
          <button onClick={onCancel} className="rounded-[9px] border border-line px-4 py-[9px] text-[12.5px] font-bold text-navy">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={filledCount === 0}
            className="rounded-[9px] bg-orange px-4 py-[9px] text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Aplicar ({filledCount} unidade{filledCount === 1 ? '' : 's'} com valor lançado)
          </button>
        </div>
      </div>
    </div>
  )
}

function ValueInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0,00"
      className="w-[110px] rounded-[7px] border border-line bg-white px-[8px] py-[5px] text-right text-[12px] text-navy placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-orange-soft"
    />
  )
}

function BrandFilterTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[9px] px-[12px] py-[7px] text-[11.5px] font-bold transition-colors ${
        active ? 'bg-orange text-white' : 'border border-line bg-card text-navy'
      }`}
    >
      {label}
    </button>
  )
}
