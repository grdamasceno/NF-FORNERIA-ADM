import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { currentMonthValue, slugify } from '@/lib/format'
import { franchiseUnits, franchiseBrands } from '@/data/units'
import type { PendingEmissionRow } from '@/data/pendingEmissions'
import type { Brand } from '@/types'

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

// Preenchimento manual dos valores do mês, página própria (em vez de modal)
// pra caber as 69 unidades com mais espaço. Alternativa ao upload de
// planilha — mesmo destino (`PendingEmissionRow[]`) e mesma regra de "sem
// cobrança fica de fora da fila" que `toPendingRows` usa no caminho de
// importação de arquivo. Ao confirmar, volta pra Faturamento levando o
// resultado via `navigate(..., { state })`, que lá vira a fila de emissão
// (ver `Faturamento.tsx` → efeito que lê `location.state`).
export function PreencherValores() {
  const navigate = useNavigate()
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
    navigate('/faturamento', { state: { manualEntryRows: rows, manualEntryCompetencia: competencia } })
  }

  return (
    <>
      <PageHeader title="Preencher valores do mês" subtitle="Lança Call Center, Royalties e Marketing por unidade — vira a fila de emissão, igual importar planilha.">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[.05em] text-faint">Competência</span>
          <input
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            className="rounded-[9px] border border-line bg-card px-[11px] py-[7px] text-[12.5px] font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-orange-soft"
          />
        </label>
        <button onClick={() => navigate('/faturamento')} className="rounded-[11px] border border-line bg-card px-4 py-[10px] text-[12.5px] font-bold text-navy">
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          disabled={filledCount === 0}
          className="rounded-[11px] bg-orange px-4 py-[10px] text-[12.5px] font-bold text-white shadow-[0_6px_14px_rgba(233,78,27,.28)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Aplicar ({filledCount} unidade{filledCount === 1 ? '' : 's'} com valor lançado)
        </button>
      </PageHeader>

      <div className="mb-4 flex gap-2">
        <BrandFilterTab label="Todas as marcas" active={brandFilter === 'todas'} onClick={() => setBrandFilter('todas')} />
        {franchiseBrands.map((b) => (
          <BrandFilterTab key={b} label={b} active={brandFilter === b} onClick={() => setBrandFilter(b)} />
        ))}
      </div>

      <section className="animate-rise overflow-hidden rounded-card border border-line bg-card shadow-panel">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Unidade', 'Marca', 'Call Center', 'Royalties', 'Marketing'].map((h, i) => (
                  <th
                    key={h}
                    className={`border-y border-line bg-[#fafbfc] px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint ${
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
                  <tr key={u.id} className="border-b border-line last:border-none hover:bg-[#fafbfc]">
                    <td className="px-5 py-[9px] text-[13px] font-semibold text-navy">{u.nome}</td>
                    <td className="px-5 py-[9px] text-[11.5px] text-faint">{u.marca}</td>
                    <td className="px-5 py-[9px]">
                      <ValueInput value={v.callCenter} onChange={(t) => setField(u.id, 'callCenter', t)} />
                    </td>
                    <td className="px-5 py-[9px]">
                      <ValueInput value={v.royalties} onChange={(t) => setField(u.id, 'royalties', t)} />
                    </td>
                    <td className="px-5 py-[9px]">
                      <ValueInput value={v.marketing} onChange={(t) => setField(u.id, 'marketing', t)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function ValueInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0,00"
      className="w-[130px] rounded-[8px] border border-line bg-white px-[9px] py-[6px] text-right text-[12.5px] text-navy placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-orange-soft"
    />
  )
}

function BrandFilterTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[11px] px-[14px] py-[9px] text-[12.5px] font-bold transition-colors ${
        active ? 'bg-orange text-white shadow-[0_6px_14px_rgba(233,78,27,.28)]' : 'border border-line bg-card text-navy'
      }`}
    >
      {label}
    </button>
  )
}
