import { PageHeader } from '@/components/layout/PageHeader'
import { SimBadge } from '@/components/SimBadge'
import { Tag, paymentTag } from '@/components/dashboard/statusTags'
import { formatBRL } from '@/lib/format'
import { mockInvoices } from '@/data/mockInvoices'

// Boleto/PIX simulados (seção 8 do MD, `simulateBoletoGeneration`). "Marcar
// como paga" aqui é só visual — a baixa manual de verdade ainda depende do
// Supabase (ver TODO.md → "Inventário de dados fixos/fictícios").
export function BoletosPix() {
  const withCharge = mockInvoices.filter((inv) => inv.boletoCode)

  return (
    <>
      <PageHeader title="Boletos & PIX" subtitle="Cobrança simulada · baixa manual de pagamento">
        <SimBadge />
      </PageHeader>

      <section className="animate-rise overflow-hidden rounded-card bg-card shadow-card">
        <div className="flex items-center justify-between px-5 pb-[13px] pt-[17px]">
          <h3 className="text-[14.5px] font-bold text-navy">Junho / 2026 · {withCharge.length} cobranças</h3>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Unidade', 'Valor', 'Boleto', 'PIX copia-e-cola', 'Vencimento', 'Status', ''].map((h, i) => (
                <th
                  key={h}
                  className={`border-y border-line bg-[#fafbfc] px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint ${i === 1 ? 'text-right' : ''} ${i === 3 ? 'max-[900px]:hidden' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withCharge.map((inv) => {
              const p = paymentTag[inv.paymentStatus]
              return (
                <tr key={inv.id} className="border-b border-line last:border-none hover:bg-[#fafbfc]">
                  <td className="px-5 py-[13px] text-[13px] font-semibold text-navy">{inv.unitName}</td>
                  <td className="px-5 py-[13px] text-right">
                    <span className="font-display font-bold text-navy">{formatBRL(inv.totalValue)}</span>
                  </td>
                  <td className="px-5 py-[13px]">
                    <code className="text-[11px] text-muted">{inv.boletoCode}</code>
                  </td>
                  <td className="max-[900px]:hidden px-5 py-[13px]">
                    <code className="block max-w-[220px] truncate text-[11px] text-muted" title={inv.pixCopiaCola ?? undefined}>
                      {inv.pixCopiaCola}
                    </code>
                  </td>
                  <td className="px-5 py-[13px] text-[12px] text-muted">
                    {inv.dueDate ? new Date(inv.dueDate + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-5 py-[13px]">
                    <Tag tone={p.tone} label={p.label} />
                  </td>
                  <td className="px-5 py-[13px] text-right">
                    <button
                      disabled={inv.paymentStatus === 'paga'}
                      className="rounded-[8px] border border-line px-[10px] py-[6px] text-[11px] font-bold text-navy disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Marcar como paga
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </>
  )
}
