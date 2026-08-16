import { PageHeader } from '@/components/layout/PageHeader'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { RevenueBarChart } from '@/components/dashboard/RevenueBarChart'
import { PaymentDonutChart } from '@/components/dashboard/PaymentDonutChart'
import { FranchiseTable } from '@/components/dashboard/FranchiseTable'
import { UploadIcon } from '@/components/icons'
import { computeKpis, mockInvoiceItems, mockInvoices, monthlyTotals } from '@/data/mockInvoices'
import { formatBRL } from '@/lib/format'

export function Dashboard() {
  const kpis = computeKpis(mockInvoices)
  const paid = mockInvoices.filter((i) => i.paymentStatus === 'paga').length
  const dueSoon = mockInvoices.filter((i) => i.paymentStatus === 'a_vencer').length
  const overdue = mockInvoices.filter((i) => i.paymentStatus === 'atraso').length

  const [issuedInt, issuedCents] = formatBRL(kpis.issuedTotal).split(',')
  const [receivedInt, receivedCents] = formatBRL(kpis.receivedTotal).split(',')
  const [openInt, openCents] = formatBRL(kpis.openTotal).split(',')

  return (
    <>
      <PageHeader title="Faturamento de Franquias" subtitle="NFS-e do Rio de Janeiro · emissão via Focus NFe · boleto + PIX">
        <div className="flex items-center gap-2 rounded-[11px] border border-line bg-card px-[13px] py-[9px] text-[12.5px] font-semibold text-navy">
          Competência: Junho / 2026
        </div>
        <button className="inline-flex items-center gap-2 rounded-[11px] border border-line bg-card px-[15px] py-[10px] text-[12.5px] font-bold text-navy">
          <UploadIcon className="h-4 w-4" /> Importar planilha
        </button>
        <button className="inline-flex items-center gap-2 rounded-[11px] bg-orange px-[15px] py-[10px] text-[12.5px] font-bold text-white shadow-[0_6px_14px_rgba(233,78,27,.28)]">
          Emitir lote
        </button>
      </PageHeader>

      <section className="mb-[18px] grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[560px]:grid-cols-1">
        <KpiCard
          delay={0.04}
          iconBg="#FDEEE8"
          icon={<span className="text-orange">R$</span>}
          label="Faturamento emitido"
          value={issuedInt}
          cents={`,${issuedCents ?? '00'}`}
          trend="up"
          trendLabel="12%"
          sub="vs. maio"
        />
        <KpiCard
          delay={0.08}
          iconBg="#E5F6EF"
          icon={<span className="text-green">✓</span>}
          label="Recebido"
          value={receivedInt}
          cents={`,${receivedCents ?? '00'}`}
          trend="up"
          trendLabel="8%"
          sub={`${((kpis.receivedTotal / kpis.issuedTotal) * 100).toFixed(1)}% do emitido`}
        />
        <KpiCard
          delay={0.12}
          iconBg="#FBF2DA"
          icon={<span className="text-amber">⏱</span>}
          label="Em aberto"
          value={openInt}
          cents={`,${openCents ?? '00'}`}
          trend="flat"
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
          trend="down"
          trendLabel="2,1%"
          sub={`${overdue} unidades`}
        />
      </section>

      <section className="mb-[18px] grid grid-cols-[2fr_1fr] gap-4 max-[1080px]:grid-cols-1">
        <RevenueBarChart labels={monthlyTotals.labels} issued={monthlyTotals.issued} received={monthlyTotals.received} />
        <PaymentDonutChart paid={paid} dueSoon={dueSoon} overdue={overdue} />
      </section>

      <FranchiseTable invoices={mockInvoices} items={mockInvoiceItems} competencia="Junho / 2026" />
    </>
  )
}
