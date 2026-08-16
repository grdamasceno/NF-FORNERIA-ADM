import { PageHeader } from '@/components/layout/PageHeader'
import { SimBadge } from '@/components/SimBadge'
import { sendLog } from '@/data/mockEnvios'

const channelLabel = { whatsapp: 'WhatsApp', email: 'E-mail' } as const

// Log de envio fictício — ver TODO.md → "Inventário de dados fixos/fictícios".
export function Envios() {
  const sent = sendLog.filter((e) => e.sent).length

  return (
    <>
      <PageHeader title="Envios" subtitle="Histórico de envio por WhatsApp e e-mail — simulado">
        <SimBadge />
      </PageHeader>

      <section className="animate-rise overflow-hidden rounded-card bg-card shadow-card">
        <div className="flex items-center justify-between px-5 pb-[13px] pt-[17px]">
          <h3 className="text-[14.5px] font-bold text-navy">
            Junho / 2026 · {sent}/{sendLog.length} envios concluídos
          </h3>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Unidade', 'Canal', 'Destino', 'Enviado em', 'Status'].map((h) => (
                <th key={h} className="border-y border-line bg-[#fafbfc] px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sendLog.map((entry) => (
              <tr key={`${entry.invoiceId}-${entry.channel}`} className="border-b border-line last:border-none hover:bg-[#fafbfc]">
                <td className="px-5 py-[13px] text-[13px] font-semibold text-navy">{entry.unitName}</td>
                <td className="px-5 py-[13px] text-[12.5px] text-muted">{channelLabel[entry.channel]}</td>
                <td className="px-5 py-[13px] text-[12px] text-muted">{entry.contact}</td>
                <td className="px-5 py-[13px] text-[12px] text-muted">{entry.sentAt ?? '—'}</td>
                <td className="px-5 py-[13px]">
                  {entry.sent ? (
                    <span className="inline-flex items-center gap-1.5 rounded-[7px] bg-green-soft px-[9px] py-[3px] text-[11px] font-bold text-green">
                      Enviado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-[7px] bg-[#eef1f4] px-[9px] py-[3px] text-[11px] font-bold text-faint">
                      Pendente
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
