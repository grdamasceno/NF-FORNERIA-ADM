import { PageHeader } from '@/components/layout/PageHeader'
import { SimBadge } from '@/components/SimBadge'
import { formatBRL } from '@/lib/format'
import { mockInvoiceItems, mockInvoices } from '@/data/mockInvoices'

const serviceTypeLabel = {
  consolidado: 'Consolidado',
  royalties: 'Royalties',
  marketing: 'Marketing',
  call_center: 'Call Center',
} as const

// NFS-e simuladas por definição do MVP (seção 8 do MD) — não é "dado fixo
// temporário", é o próprio comportamento esperado até a Focus NFe entrar.
// Uma NFS-e é gerada por `invoice_item`, não por fatura — o tenant mock está
// em modo `consolidado` (1 item por fatura); em modo `separado_por_servico`
// esta mesma tabela mostraria até 3 linhas por unidade (seção 4 do MD v2).
// Ver TODO.md → "Inventário de dados fixos/fictícios".
export function NotasFiscais() {
  const unitNameByInvoice = new Map(mockInvoices.map((inv) => [inv.id, inv.unitName]))
  const emitidas = mockInvoiceItems.filter((item) => item.nfseNumber)
  const falhas = mockInvoiceItems.filter((item) => !item.nfseNumber)

  return (
    <>
      <PageHeader title="Notas Fiscais" subtitle="NFS-e do Rio de Janeiro · emissão simulada via Focus NFe">
        <SimBadge />
      </PageHeader>

      <section className="animate-rise overflow-hidden rounded-card bg-card shadow-card">
        <div className="flex items-center justify-between px-5 pb-[13px] pt-[17px]">
          <h3 className="text-[14.5px] font-bold text-navy">Junho / 2026 · {emitidas.length} NFS-e simuladas</h3>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Unidade', 'Serviço', 'Número NFS-e', 'Valor', 'Status'].map((h, i) => (
                <th
                  key={h}
                  className={`border-y border-line bg-[#fafbfc] px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint ${i === 3 ? 'text-right' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockInvoiceItems.map((item) => (
              <tr key={item.id} className="border-b border-line last:border-none hover:bg-[#fafbfc]">
                <td className="px-5 py-[13px] text-[13px] font-semibold text-navy">{unitNameByInvoice.get(item.invoiceId)}</td>
                <td className="px-5 py-[13px] text-[12px] text-muted">{serviceTypeLabel[item.serviceType]}</td>
                <td className="px-5 py-[13px]">
                  <span className="font-display text-[12.5px] font-bold text-navy">{item.nfseNumber ?? '—'}</span>
                </td>
                <td className="px-5 py-[13px] text-right">
                  <span className="font-display font-bold text-navy">{formatBRL(item.value)}</span>
                </td>
                <td className="px-5 py-[13px]">
                  {item.nfseNumber ? (
                    <span className="inline-flex items-center gap-1.5 rounded-[7px] bg-green-soft px-[9px] py-[3px] text-[11px] font-bold text-green">
                      Simulada <SimBadge />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-[7px] bg-red-soft px-[9px] py-[3px] text-[11px] font-bold text-red">
                      Falha · dados incompletos
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {falhas.length > 0 && (
        <p className="mt-3 text-[12px] text-muted">
          {falhas.length} item{falhas.length === 1 ? '' : 's'} sem NFS-e emitida por falta de dados na planilha importada.
        </p>
      )}
    </>
  )
}
