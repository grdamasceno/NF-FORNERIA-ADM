import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tag } from '@/components/dashboard/statusTags'
import { avatarColor, initials } from '@/lib/format'
import { activeFranchiseCount, franchiseBrands, franchiseStates, franchiseUnits } from '@/data/units'
import type { Brand } from '@/types'

type BrandFilter = Brand | 'todas'

export function Franquias() {
  const [query, setQuery] = useState('')
  const [uf, setUf] = useState<string>('todos')
  const [marca, setMarca] = useState<BrandFilter>('todas')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return franchiseUnits.filter((u) => {
      const matchesQuery =
        !q ||
        u.nome.toLowerCase().includes(q) ||
        (u.cidade ?? '').toLowerCase().includes(q) ||
        (u.endereco ?? '').toLowerCase().includes(q)
      const matchesUf = uf === 'todos' || u.estado === uf
      const matchesMarca = marca === 'todas' || u.marca === marca
      return matchesQuery && matchesUf && matchesMarca
    })
  }, [query, uf, marca])

  return (
    <>
      <PageHeader title="Franquias" subtitle={`${activeFranchiseCount} unidades ativas · Forneria + The Duck`}>
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
          {franchiseStates.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
      </PageHeader>

      <div className="mb-4 flex gap-2">
        <BrandTab label="Todas as marcas" active={marca === 'todas'} onClick={() => setMarca('todas')} count={franchiseUnits.length} />
        {franchiseBrands.map((b) => (
          <BrandTab key={b} label={b} active={marca === b} onClick={() => setMarca(b)} count={franchiseUnits.filter((u) => u.marca === b).length} />
        ))}
      </div>

      <section className="animate-rise overflow-hidden rounded-card bg-card shadow-card" style={{ animationDelay: '.1s' }}>
        <div className="flex items-center justify-between px-5 pb-[13px] pt-[17px]">
          <h3 className="text-[14.5px] font-bold text-navy">
            {filtered.length} unidade{filtered.length === 1 ? '' : 's'}
          </h3>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Unidade', 'Marca', 'Cidade / UF', 'Endereço', 'Horário', 'Status'].map((h, i) => (
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
                      style={{ background: avatarColor(u.nome) }}
                    >
                      {initials(u.nome)}
                    </div>
                    <b className="block text-[13px] font-semibold leading-[1.25] text-navy">{u.nome}</b>
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
                  <span className="line-clamp-1 max-w-[220px] text-[11.5px] text-faint" title={u.horario ?? undefined}>
                    {u.horario ? u.horario.split('\n')[0].split('|')[0] : '—'}
                  </span>
                </td>
                <td className="px-5 py-[13px] align-middle">
                  <Tag tone={u.ativo ? 'g' : 'n'} label={u.ativo ? 'Ativa' : 'Inativa'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-muted">Nenhuma unidade encontrada para esse filtro.</div>
        )}
      </section>
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
