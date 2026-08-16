import { useMemo } from 'react'
import type { Invoice, InvoiceItem } from '@/types'
import { avatarColor, formatBRL, initials } from '@/lib/format'
import { paymentTag, statusTag, Tag } from './statusTags'

interface FranchiseTableProps {
  invoices: Invoice[]
  items: InvoiceItem[] // invoice_items — usados aqui só para mostrar a 1ª NFS-e de cada fatura
  competencia: string
}

export function FranchiseTable({ invoices, items, competencia }: FranchiseTableProps) {
  const nfseByInvoice = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const item of items) {
      if (!map.has(item.invoiceId)) map.set(item.invoiceId, item.nfseNumber)
    }
    return map
  }, [items])

  return (
    <section className="animate-rise overflow-hidden rounded-card bg-card shadow-card" style={{ animationDelay: '.26s' }}>
      <div className="flex items-center justify-between px-5 pb-[13px] pt-[17px]">
        <h3 className="text-[14.5px] font-bold text-navy">Franquias · {competencia}</h3>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-[9px] border border-line bg-white px-[11px] py-[7px] text-[11.5px] font-semibold text-muted">
            Filtrar
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-[9px] border border-line bg-white px-[11px] py-[7px] text-[11.5px] font-semibold text-muted">
            Ordenar
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-[9px] border border-line bg-white px-[11px] py-[7px] text-[11.5px] font-semibold text-muted">
            Exportar
          </button>
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            {['Unidade', 'Valor', 'NFS-e (RJ)', 'Boleto / PIX', 'Envio', 'Status'].map((h, i) => (
              <th
                key={h}
                className={`border-y border-line bg-[#fafbfc] px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint ${
                  i === 1 || i === 5 ? 'text-right' : ''
                } ${i === 2 || i === 4 ? 'max-[560px]:hidden' : ''}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const s = statusTag[inv.status]
            const p = paymentTag[inv.paymentStatus]
            return (
              <tr key={inv.id} className="border-b border-line transition-colors last:border-none hover:bg-[#fafbfc]">
                <td className="px-5 py-[13px] align-middle">
                  <div className="flex items-center gap-[11px]">
                    <div
                      className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] font-display text-xs font-extrabold text-white"
                      style={{ background: avatarColor(inv.unitName) }}
                    >
                      {initials(inv.unitName)}
                    </div>
                    <div>
                      <b className="block text-[13px] font-semibold leading-[1.25] text-navy">{inv.unitName}</b>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-[13px] text-right align-middle">
                  <span className="font-display font-bold text-navy">{formatBRL(inv.totalValue)}</span>
                </td>
                <td className="max-[560px]:hidden px-5 py-[13px] align-middle">
                  <span className="text-[11px] font-semibold text-muted">{nfseByInvoice.get(inv.id) ?? '—'}</span>
                </td>
                <td className="px-5 py-[13px] align-middle">
                  <Tag tone={p.tone} label={p.label} />
                </td>
                <td className="max-[560px]:hidden px-5 py-[13px] align-middle">
                  <div className="flex items-center gap-1.5">
                    <ChannelIcon ok={inv.whatsappSent} />
                    <ChannelIcon ok={inv.emailSent} />
                  </div>
                </td>
                <td className="px-5 py-[13px] text-right align-middle">
                  <Tag tone={s.tone} label={s.label} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex items-center justify-center gap-2.5 p-4 text-[11.5px] font-medium text-faint">
        Emissão <b className="font-bold text-orange">NFS-e RJ</b> via Focus NFe
        <span className="h-1 w-1 rounded-full bg-[#cfd6dd]" />
        Cobrança boleto + PIX
        <span className="h-1 w-1 rounded-full bg-[#cfd6dd]" />
        Envio automático WhatsApp &amp; e-mail
        <span className="h-1 w-1 rounded-full bg-[#cfd6dd]" />
        <b className="font-bold text-orange">ALL IN ONE</b> · OnChannel
      </div>
    </section>
  )
}

function ChannelIcon({ ok }: { ok: boolean }) {
  return (
    <i
      className={`flex h-6 w-6 items-center justify-center rounded-[7px] ${ok ? 'bg-green-soft text-green' : 'bg-[#eef1f4] text-faint'}`}
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
        <path d="M12 2a10 10 0 0 0-8.7 15l-1.3 5 5.1-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20z" />
      </svg>
    </i>
  )
}
