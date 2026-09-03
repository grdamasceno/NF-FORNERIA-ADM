import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tag } from '@/components/dashboard/statusTags'
import { avatarColor, initials } from '@/lib/format'
import { fetchUnits } from '@/lib/liveUnits'
import { EditUnitModal } from '@/components/franquias/EditUnitModal'
import type { Brand, LiveUnit } from '@/types'

type BrandFilter = Brand | 'todas'

// Única tela ligada de verdade ao Supabase (`nf_forneria.units`) — as
// outras (Sidebar, Configurações) ainda usam o `franquias.json` estático.
// Ver TODO.md → "Inventário de dados fixos/fictícios".
export function Franquias() {
  const [units, setUnits] = useState<LiveUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [uf, setUf] = useState<string>('todos')
  const [marca, setMarca] = useState<BrandFilter>('todas')
  const [editing, setEditing] = useState<LiveUnit | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchUnits()
      .then((data) => {
        if (!cancelled) setUnits(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao carregar franquias.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const states = useMemo(
    () => Array.from(new Set(units.map((u) => u.estado).filter((e): e is string => !!e))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [units],
  )
  const brands = useMemo(() => Array.from(new Set(units.map((u) => u.marca))).sort(), [units])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return units.filter((u) => {
      const matchesQuery =
        !q || u.name.toLowerCase().includes(q) || (u.cidade ?? '').toLowerCase().includes(q) || (u.endereco ?? '').toLowerCase().includes(q)
      const matchesUf = uf === 'todos' || u.estado === uf
      const matchesMarca = marca === 'todas' || u.marca === marca
      return matchesQuery && matchesUf && matchesMarca
    })
  }, [units, query, uf, marca])

  const activeCount = units.filter((u) => u.active).length

  return (
    <>
      <PageHeader title="Franquias" subtitle={loading ? 'Carregando…' : `${activeCount} unidades ativas · Forneria + The Duck`}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, cidade ou endereço…"
          className="w-64 rounded-[11px] border border-line bg-card px-[13px] py-[9px] text-[12.5px] text-navy placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-orange-soft max-[560px]:w-full"
        />
        <select
          value={uf}
          onChange={(e) => setUf(e.target.value)}
          className="rounded-[11px] border border-line bg-card px-[13px] py-[9px] text-[12.5px] font-semibold text-navy focus:outline-none"
        >
          <option value="todos">Todos os estados</option>
          {states.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
      </PageHeader>

      {error && (
        <div className="mb-4 rounded-[11px] bg-red-soft p-3 text-[12.5px] font-semibold text-red">
          {error} — conferir se a migration 0005/0006 já rodou no self-hosted.
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <BrandTab label="Todas as marcas" active={marca === 'todas'} onClick={() => setMarca('todas')} count={units.length} />
        {brands.map((b) => (
          <BrandTab key={b} label={b} active={marca === b} onClick={() => setMarca(b)} count={units.filter((u) => u.marca === b).length} />
        ))}
      </div>

      <section className="animate-rise overflow-hidden rounded-card border border-line bg-card shadow-panel" style={{ animationDelay: '.1s' }}>
        <div className="flex items-center justify-between px-5 pb-[13px] pt-[17px]">
          <h3 className="text-[14.5px] font-bold text-navy">
            {loading ? 'Carregando…' : `${filtered.length} unidade${filtered.length === 1 ? '' : 's'}`}
          </h3>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Unidade', 'Marca', 'Cidade / UF', 'Endereço', 'CNPJ', 'Status', ''].map((h, i) => (
                <th
                  key={h}
                  className={`border-y border-line bg-[#fafbfc] px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint ${
                    i === 3 || i === 4 ? 'max-[900px]:hidden' : ''
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-line transition-colors last:border-none hover:bg-[#fafbfc]">
                <td className="px-5 py-[13px] align-middle">
                  <div className="flex items-center gap-[11px]">
                    <div
                      className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] font-display text-xs font-extrabold text-white"
                      style={{ background: avatarColor(u.name) }}
                    >
                      {initials(u.name)}
                    </div>
                    <b className="block text-[13px] font-semibold leading-[1.25] text-navy">{u.name}</b>
                  </div>
                </td>
                <td className="px-5 py-[13px] align-middle">
                  <Tag tone={u.marca === 'Forneria' ? 'n' : 'b'} label={u.marca} />
                </td>
                <td className="px-5 py-[13px] align-middle">
                  <span className="text-[12.5px] text-muted">{u.cidade ? `${u.cidade} · ${u.uf ?? u.estado}` : '—'}</span>
                </td>
                <td className="max-[900px]:hidden px-5 py-[13px] align-middle">
                  <span className="text-[12px] text-muted" title={u.endereco ?? undefined}>
                    {u.endereco ?? 'Endereço não cadastrado'}
                  </span>
                </td>
                <td className="max-[900px]:hidden px-5 py-[13px] align-middle">
                  <span className="text-[12px] text-muted">{u.cnpj ?? '—'}</span>
                </td>
                <td className="px-5 py-[13px] align-middle">
                  <Tag tone={u.active ? 'g' : 'n'} label={u.active ? 'Ativa' : 'Inativa'} />
                </td>
                <td className="px-5 py-[13px] text-right align-middle">
                  <button
                    onClick={() => setEditing(u)}
                    className="rounded-[8px] border border-line px-[10px] py-[6px] text-[11px] font-bold text-navy"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-muted">Nenhuma unidade encontrada para esse filtro.</div>
        )}
      </section>

      {editing && (
        <EditUnitModal
          unit={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => setUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))}
        />
      )}
    </>
  )
}

function BrandTab({ label, active, count, onClick }: { label: string; active: boolean; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[11px] px-[14px] py-[9px] text-[12.5px] font-bold transition-colors ${
        active ? 'bg-orange text-white shadow-[0_6px_14px_rgba(233,78,27,.28)]' : 'border border-line bg-card text-navy'
      }`}
    >
      {label} <span className={active ? 'text-white/80' : 'text-faint'}>· {count}</span>
    </button>
  )
}
