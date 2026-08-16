import type { InvoiceStatus, PaymentStatus } from '@/types'

type TagTone = 'g' | 'b' | 'a' | 'r' | 'n'

const toneClasses: Record<TagTone, string> = {
  g: 'text-green bg-green-soft',
  b: 'text-blue bg-blue-soft',
  a: 'text-amber bg-amber-soft',
  r: 'text-red bg-red-soft',
  n: 'text-navy bg-[#eef1f4]',
}

export const statusTag: Record<InvoiceStatus, { tone: TagTone; label: string }> = {
  paga: { tone: 'g', label: 'Paga' },
  enviada: { tone: 'b', label: 'Enviada' },
  emitida: { tone: 'n', label: 'Emitida' },
  pendente_emissao: { tone: 'n', label: 'Pendente emissão' },
  atraso: { tone: 'r', label: 'Em atraso' },
  falha: { tone: 'r', label: 'Falha · dados' },
}

export const paymentTag: Record<PaymentStatus, { tone: TagTone; label: string }> = {
  paga: { tone: 'g', label: 'Pago' },
  a_vencer: { tone: 'a', label: 'A vencer' },
  atraso: { tone: 'r', label: 'Atraso' },
  pendente: { tone: 'n', label: 'Pendente' },
}

export function Tag({ tone, label }: { tone: TagTone; label: string }) {
  return (
    <span className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-[7px] px-[9px] py-[3px] text-[11px] font-bold ${toneClasses[tone]}`}>
      {label}
    </span>
  )
}
