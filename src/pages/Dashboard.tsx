import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { RevenueBarChart } from '@/components/dashboard/RevenueBarChart'
import { PaymentDonutChart } from '@/components/dashboard/PaymentDonutChart'
import { FranchiseTable } from '@/components/dashboard/FranchiseTable'
import { computeKpis } from '@/data/mockInvoices'
import { fetchDashboardInvoices, fetchMonthlyTotals } from '@/lib/liveInvoices'
import { currentMonthValue, formatBRL, formatCompetencia } from '@/lib/format'
import type { Invoice, InvoiceItem } from '@/types'

// Painel com dado real (nf_forneria.invoices/invoice_items) — substitui o
// mockInvoices fictício que mostrava um dataset de exemplo inventado mesmo
// quando nenhuma fatura de verdade existia ainda.
export function Dashboard() {
  const [competencia] = useState(currentMonthValue())
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [monthlyTotals, setMonthlyTotals] = useState<{ labels: string[]; issued: number[]; received: number[] }>({
    labels: [],
    issued: [],
    received: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchDashboardInvoices(competencia), fetchMonthlyTotals()])
      .then(([dash, totals]) => {
        if (cancelled) return
        setInvoices(dash.invoices)
        setItems(dash.items)
        setMonthlyTotals(totals)
      })
      .catch((e) => console.error('Falha ao carregar painel:', e instanceof Error ? e.message : e))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [competencia])

  const kpis = computeKpis(invoices)
  const paid = invoices.filter((i) => i.paymentStatus === 'paga').length
  const dueSoon = invoices.filter((i) => i.paymentStatus === 'a_vencer').length
  const overdue = invoices.filter((i) => i.paymentStatus === 'atraso').length

  const [issuedInt, issuedCents] = formatBRL(kpis.issuedTotal).split(',')
  const [receivedInt, receivedCents] = formatBRL(kpis.receivedTotal).split(',')
  const [openInt, openCents] = formatBRL(kpis.openTotal).split(',')

  return (
    <>
      <PageHeader title="Faturamento de Franquias" subtitle="NFS-e do Rio de Janeiro · emissão via Focus NFe · boleto + PIX">
        <div className="flex items-center gap-2 rounded-[11px] border border-line bg-card px-[13px] py-[9px] text-[12.5px] font-semibold text-navy">
          Competência: {formatCompetencia(competencia)}
        </div>
      </PageHeader>

      {loading ? (
        <div className="py-16 text-center text-[12.5px] text-faint">Carregando…</div>
      ) : (
        <>
          <section className="mb-[18px] grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[560px]:grid-cols-1">
            <KpiCard
              delay={0.04}
              iconBg="#FDEEE8"
              icon={<span className="text-orange">R$</span>}
              label="Faturamento emitido"
              value={issuedInt}
              cents={`,${issuedCents ?? '00'}`}
              sub={formatCompetencia(competencia)}
            />
            <KpiCard
              delay={0.08}
              iconBg="#E5F6EF"
              icon={<span className="text-green">✓</span>}
              label="Recebido"
              value={receivedInt}
              cents={`,${receivedCents ?? '00'}`}
              sub={kpis.issuedTotal > 0 ? `${((kpis.receivedTotal / kpis.issuedTotal) * 100).toFixed(1)}% do emitido` : '—'}
            />
            <KpiCard
              delay={0.12}
              iconBg="#FBF2DA"
              icon={<span className="text-amber">⏱</span>}
              label="Em aberto"
              value={openInt}
              cents={`,${openCents ?? '00'}`}
              trendLabel={`${dueSoon + overdue} boletos`}
              sub="a vencer + atraso"
            />
            <KpiCard
              delay={0.16}
              iconBg="#FCE9E8"
              icon={<span className="text-red">!</span>}
              label="Inadimplência"
              value={kpis.defaultRatePct.toFixed(1).replace('.', ',')}
              cents="%"
              sub={`${overdue} unidade${overdue === 1 ? '' : 's'}`}
            />
          </section>

          <section className="mb-[18px] grid grid-cols-[2fr_1fr] gap-4 max-[1080px]:grid-cols-1">
            <RevenueBarChart labels={monthlyTotals.labels} issued={monthlyTotals.issued} received={monthlyTotals.received} />
            <PaymentDonutChart paid={paid} dueSoon={dueSoon} overdue={overdue} />
          </section>

          <FranchiseTable invoices={invoices} items={items} competencia={formatCompetencia(competencia)} />
        </>
      )}
    </>
  )
}
