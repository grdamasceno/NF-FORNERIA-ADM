import { PageHeader } from '@/components/layout/PageHeader'
import { SimBadge } from '@/components/SimBadge'
import { formatBRL } from '@/lib/format'
import { averageTicket, quarterlyRevenue, topUnits } from '@/data/mockRelatorios'

// Relatórios está fora do escopo do MVP (seção 7 do MD) — esta tela é só uma
// prévia de layout com dados fictícios, ver TODO.md → "Inventário de dados".
export function Relatorios() {
  return (
    <>
      <PageHeader title="Relatórios" subtitle="Fora do escopo do MVP · prévia de layout com dados fictícios">
        <SimBadge label="PRÉVIA · FORA DO ESCOPO" />
      </PageHeader>

      <section className="mb-[18px] grid grid-cols-[2fr_1fr] gap-4 max-[1080px]:grid-cols-1">
        <div className="animate-rise rounded-card bg-card p-5 shadow-card">
          <h3 className="mb-4 text-[14.5px] font-bold text-navy">Faturamento por trimestre</h3>
          <div className="flex items-end gap-3">
            {quarterlyRevenue.map((q) => {
              const max = Math.max(...quarterlyRevenue.map((x) => x.value))
              const heightPct = (q.value / max) * 100
              return (
                <div key={q.label} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-[140px] w-full items-end">
                    <div className="w-full rounded-t-[6px] bg-orange" style={{ height: `${heightPct}%` }} />
                  </div>
                  <div className="text-[11px] font-semibold text-muted">{q.label}</div>
                  <div className="text-[11px] font-bold text-navy">{formatBRL(q.value)}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="animate-rise rounded-card bg-card p-5 shadow-card" style={{ animationDelay: '.06s' }}>
          <h3 className="mb-1 text-[14.5px] font-bold text-navy">Ticket médio por unidade</h3>
          <div className="num mt-2 text-[30px] text-navy">{formatBRL(averageTicket)}</div>
          <div className="mt-1 text-[11.5px] text-faint">Junho / 2026 · base fictícia</div>
        </div>
      </section>

      <section className="animate-rise rounded-card bg-card p-5 shadow-card" style={{ animationDelay: '.1s' }}>
        <h3 className="mb-4 text-[14.5px] font-bold text-navy">Top 5 unidades por faturamento</h3>
        <div className="flex flex-col gap-3">
          {topUnits.map((u, i) => (
            <div key={u.unitName} className="flex items-center gap-3">
              <span className="w-5 text-[12px] font-bold text-faint">{i + 1}º</span>
              <span className="flex-1 text-[13px] font-semibold text-navy">{u.unitName}</span>
              <span className="font-display text-[13px] font-bold text-navy">{formatBRL(u.value)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
