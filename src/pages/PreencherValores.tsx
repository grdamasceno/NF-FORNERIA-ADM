import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { currentMonthValue, slugify } from '@/lib/format'
import { fetchUnits } from '@/lib/liveUnits'
import { createPublicFillLink, fetchInvoiceRows } from '@/lib/liveInvoices'
import { useSettings } from '@/context/SettingsContext'
import type { PendingEmissionRow } from '@/data/pendingEmissions'
import type { Brand, LiveUnit } from '@/types'

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

function formatInputValue(n: number): string {
  return n > 0 ? String(n).replace('.', ',') : ''
}

function hasDadoFiscalCompleto(u: LiveUnit): boolean {
  return !!(u.cnpj && u.razaoSocial && u.logradouro && u.numero && u.bairro && u.cep && u.codigoMunicipio)
}

// Preenchimento manual dos valores do mês, página própria (em vez de modal)
// pra caber as 69 unidades com mais espaço. Alternativa ao upload de
// planilha — mesmo destino (`PendingEmissionRow[]`) e mesma regra de "sem
// cobrança fica de fora da fila" que `toPendingRows` usa no caminho de
// importação de arquivo. Usa as unidades REAIS do Supabase (não mais o
// fixture `franquias.json`) — é o `id` real daqui que a emissão de verdade
// usa pra buscar CNPJ/endereço fiscal da unidade. Ao confirmar, volta pra
// Faturamento levando o resultado via `navigate(..., { state })`.
export function PreencherValores() {
  const navigate = useNavigate()
  const { organizationId } = useSettings()
  const [units, setUnits] = useState<LiveUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [competencia, setCompetencia] = useState(currentMonthValue())
  const [brandFilter, setBrandFilter] = useState<BrandFilter>('todas')
  const [onlyUnfilled, setOnlyUnfilled] = useState(false)
  const [values, setValues] = useState<Record<string, RowInput>>({})
  const [publicLink, setPublicLink] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  async function handleGenerateLink() {
    if (!organizationId) return
    setGeneratingLink(true)
    setLinkError(null)
    setPublicLink(null)
    try {
      const token = await createPublicFillLink(organizationId, competencia)
      setPublicLink(`${window.location.origin}/preencher-publico/${token}`)
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Falha ao gerar link.')
    } finally {
      setGeneratingLink(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    fetchUnits()
      .then((data) => {
        if (!cancelled) setUnits(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao carregar unidades.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Pré-carrega o que já foi salvo pra essa competência (fila real,
  // `nf_forneria.invoices/invoice_items`) — sem isso, reabrir a tela depois
  // de uma emissão com erro mostrava tudo zerado de novo, obrigando a
  // redigitar em vez de só corrigir/reenviar.
  useEffect(() => {
    setPublicLink(null)
    setLinkError(null)
    let cancelled = false
    fetchInvoiceRows(competencia)
      .then((rows) => {
        if (cancelled) return
        const prefill: Record<string, RowInput> = {}
        for (const row of rows) {
          prefill[row.unitId] = {
            callCenter: formatInputValue(row.callCenterValue),
            royalties: formatInputValue(row.royaltiesValue),
            marketing: formatInputValue(row.marketingValue),
          }
        }
        setValues(prefill)
      })
      .catch((e) => console.error('Falha ao carregar fila existente:', e instanceof Error ? e.message : e))
    return () => {
      cancelled = true
    }
  }, [competencia])

  const brands = useMemo(() => Array.from(new Set(units.map((u) => u.marca))).sort(), [units])

  function isFilled(u: LiveUnit): boolean {
    const v = values[u.id]
    return !!v && (parseValue(v.callCenter) > 0 || parseValue(v.royalties) > 0 || parseValue(v.marketing) > 0)
  }

  const visibleUnits = useMemo(
    () =>
      units.filter(
        (u) => u.active && (brandFilter === 'todas' || u.marca === brandFilter) && (!onlyUnfilled || !isFilled(u)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [units, brandFilter, onlyUnfilled, values],
  )

  function setField(unitId: string, field: keyof RowInput, text: string) {
    setValues((prev) => ({ ...prev, [unitId]: { ...(prev[unitId] ?? EMPTY_INPUT), [field]: text } }))
  }

  const filledCount = units.filter((u) => {
    const v = values[u.id]
    return v && (parseValue(v.callCenter) > 0 || parseValue(v.royalties) > 0 || parseValue(v.marketing) > 0)
  }).length
  const unfilledCount = units.length - filledCount

  function handleConfirm() {
    const rows: PendingEmissionRow[] = units
      .map((u) => {
        const v = values[u.id] ?? EMPTY_INPUT
        const callCenterValue = parseValue(v.callCenter)
        const royaltiesValue = parseValue(v.royalties)
        const marketingValue = parseValue(v.marketing)
        return {
          id: `${slugify(u.marca)}-${slugify(u.name)}`,
          unitId: u.id,
          unitName: `${u.marca} ${u.name}`,
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
      <PageHeader
        title="Preencher valores do mês"
        subtitle="Lança Call Center, Royalties e Marketing por unidade — vira a fila de emissão, igual importar planilha."
      >
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[.05em] text-faint">Competência</span>
          <input
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            className="rounded-[9px] border border-line bg-card px-[11px] py-[7px] text-[12.5px] font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-orange-soft"
          />
        </label>
        <div className="flex items-center gap-2 rounded-[11px] border border-line bg-card px-[13px] py-[9px] text-[12.5px] font-semibold text-navy">
          {unfilledCount} unidade{unfilledCount === 1 ? '' : 's'} sem valor preenchido
        </div>
        <button
          onClick={handleGenerateLink}
          disabled={generatingLink || !organizationId}
          title="Gera um link sem login, travado nessa competência, pra outra pessoa preencher"
          className="rounded-[11px] border border-line bg-card px-4 py-[10px] text-[12.5px] font-bold text-navy disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generatingLink ? 'Gerando…' : 'Gerar link público'}
        </button>
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

      {error && <div className="mb-4 rounded-[11px] bg-red-soft p-3 text-[12.5px] font-semibold text-red">{error}</div>}
      {linkError && <div className="mb-4 rounded-[11px] bg-red-soft p-3 text-[12.5px] font-semibold text-red">{linkError}</div>}
      {publicLink && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[11px] bg-green-soft p-3 text-[12.5px] font-semibold text-green">
          <span>
            Link gerado (vale só pra {competencia}): <span className="break-all font-normal">{publicLink}</span>
          </span>
          <button
            onClick={() => navigator.clipboard?.writeText(publicLink)}
            className="rounded-[7px] bg-white px-[10px] py-[5px] text-[11px] font-bold text-navy"
          >
            Copiar
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <BrandFilterTab label="Todas as marcas" active={brandFilter === 'todas'} onClick={() => setBrandFilter('todas')} />
          {brands.map((b) => (
            <BrandFilterTab key={b} label={b} active={brandFilter === b} onClick={() => setBrandFilter(b)} />
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-[11px] border border-line bg-card px-[13px] py-[9px] text-[12.5px] font-bold text-navy">
          <input
            type="checkbox"
            checked={onlyUnfilled}
            onChange={(e) => setOnlyUnfilled(e.target.checked)}
            className="h-[14px] w-[14px] accent-orange"
          />
          Só pendentes
        </label>
      </div>

      <section className="animate-rise overflow-hidden rounded-card border border-line bg-card shadow-panel">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Unidade', 'Marca', 'Dado fiscal', 'Call Center', 'Royalties', 'Marketing'].map((h, i) => (
                  <th
                    key={h}
                    className={`border border-line bg-[#fafbfc] px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint ${
                      i >= 3 ? 'text-right' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="border border-line px-5 py-10 text-center text-[12.5px] text-faint">
                    Carregando…
                  </td>
                </tr>
              ) : (
                visibleUnits.map((u) => {
                  const v = values[u.id] ?? EMPTY_INPUT
                  const completo = hasDadoFiscalCompleto(u)
                  return (
                    <tr key={u.id} className="hover:bg-[#fafbfc]">
                      <td className="border border-line px-5 py-[7px] text-[13px] font-semibold text-navy">{u.name}</td>
                      <td className="border border-line px-5 py-[7px] text-[11.5px] text-faint">{u.marca}</td>
                      <td className="border border-line px-5 py-[7px] text-center">
                        <span
                          title={completo ? 'CNPJ e endereço cadastrados' : 'Falta CNPJ/endereço — edite em Franquias'}
                          className={`inline-block h-[8px] w-[8px] rounded-full ${completo ? 'bg-green' : 'bg-faint'}`}
                        />
                      </td>
                      <td className="border border-line p-0">
                        <ValueInput value={v.callCenter} onChange={(t) => setField(u.id, 'callCenter', t)} />
                      </td>
                      <td className="border border-line p-0">
                        <ValueInput value={v.royalties} onChange={(t) => setField(u.id, 'royalties', t)} />
                      </td>
                      <td className="border border-line p-0">
                        <ValueInput value={v.marketing} onChange={(t) => setField(u.id, 'marketing', t)} />
                      </td>
                    </tr>
                  )
                })
              )}
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
      className="w-full bg-transparent px-5 py-[7px] text-right text-[12.5px] text-navy placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-orange-soft"
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
