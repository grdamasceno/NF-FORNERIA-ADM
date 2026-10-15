import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { formatCompetencia } from '@/lib/format'
import { fetchPublicFillData, savePublicFillValues, type PublicFillData } from '@/lib/publicFill'
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

function formatInputValue(n: number): string {
  return n > 0 ? String(n).replace('.', ',') : ''
}

// Versão pública (sem login) de "Preencher valores" — acessada por link com
// token (gen_random_uuid()), travada numa única competência pelo link
// (ver supabase/functions/public-fill-values). Layout deliberadamente mais
// simples que o app autenticado: sem sidebar, sem dado fiscal/CNPJ, só o
// essencial pra quem recebeu o link preencher Call Center/Royalties/
// Marketing por unidade.
export function PreencherPublico() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicFillData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [brandFilter, setBrandFilter] = useState<BrandFilter>('todas')
  const [values, setValues] = useState<Record<string, RowInput>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetchPublicFillData(token)
      .then((d) => {
        if (cancelled) return
        setData(d)
        const prefill: Record<string, RowInput> = {}
        for (const u of d.units) {
          prefill[u.id] = {
            callCenter: formatInputValue(u.callCenter),
            royalties: formatInputValue(u.royalties),
            marketing: formatInputValue(u.marketing),
          }
        }
        setValues(prefill)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Link inválido.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const brands = useMemo(() => Array.from(new Set((data?.units ?? []).map((u) => u.marca))).sort(), [data])
  const visibleUnits = useMemo(
    () => (data?.units ?? []).filter((u) => brandFilter === 'todas' || u.marca === brandFilter),
    [data, brandFilter],
  )

  function setField(unitId: string, field: keyof RowInput, text: string) {
    setValues((prev) => ({ ...prev, [unitId]: { ...(prev[unitId] ?? EMPTY_INPUT), [field]: text } }))
  }

  async function handleSubmit() {
    if (!token || !data) return
    setSaving(true)
    setSaveError(null)
    try {
      const payload = data.units.map((u) => {
        const v = values[u.id] ?? EMPTY_INPUT
        return {
          unitId: u.id,
          callCenter: parseValue(v.callCenter),
          royalties: parseValue(v.royalties),
          marketing: parseValue(v.marketing),
        }
      })
      await savePublicFillValues(token, payload)
      setSaved(true)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Falha ao enviar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <CenteredMessage>Carregando…</CenteredMessage>
  }

  if (loadError || !data) {
    return <CenteredMessage>⚠ {loadError ?? 'Link inválido.'}</CenteredMessage>
  }

  if (saved) {
    return <CenteredMessage>✓ Valores enviados com sucesso. Pode fechar essa página.</CenteredMessage>
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-5">
          <h1 className="text-[20px] font-bold text-navy">Preencher valores — {data.organizationName}</h1>
          <p className="mt-1 text-[13px] text-muted">
            Competência: <b>{formatCompetencia(data.competencia.slice(0, 7))}</b> · lance Call Center, Royalties e Marketing por
            unidade.
          </p>
        </div>

        {saveError && <div className="mb-4 rounded-[11px] bg-red-soft p-3 text-[12.5px] font-semibold text-red">⚠ {saveError}</div>}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <BrandFilterTab label="Todas as marcas" active={brandFilter === 'todas'} onClick={() => setBrandFilter('todas')} />
            {brands.map((b) => (
              <BrandFilterTab key={b} label={b} active={brandFilter === b} onClick={() => setBrandFilter(b)} />
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-[11px] bg-orange px-5 py-[11px] text-[12.5px] font-bold text-white shadow-[0_6px_14px_rgba(233,78,27,.28)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Enviando…' : 'Enviar valores'}
          </button>
        </div>

        <section className="overflow-hidden rounded-card border border-line bg-card shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Unidade', 'Marca', 'Call Center', 'Royalties', 'Marketing'].map((h, i) => (
                    <th
                      key={h}
                      className={`border border-line bg-[#fafbfc] px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint ${
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
                    <tr key={u.id} className="hover:bg-[#fafbfc]">
                      <td className="border border-line px-5 py-[7px] text-[13px] font-semibold text-navy">{u.name}</td>
                      <td className="border border-line px-5 py-[7px] text-[11.5px] text-faint">{u.marca}</td>
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
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-[11px] bg-orange px-5 py-[11px] text-[12.5px] font-bold text-white shadow-[0_6px_14px_rgba(233,78,27,.28)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Enviando…' : 'Enviar valores'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-center">
      <p className="text-[14px] font-semibold text-navy">{children}</p>
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
