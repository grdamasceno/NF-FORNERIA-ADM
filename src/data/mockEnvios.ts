import { mockInvoices } from './mockInvoices'

// DADOS 100% FICTÍCIOS — histórico de envio por canal, derivado dos flags
// `whatsappSent`/`emailSent` de `mockInvoices` (esses sim viram de
// `simulateWhatsappSend`/`simulateEmailSend` no fluxo real — ver
// src/lib/simulation.ts). Contato e horário aqui são inventados só para a
// tela de Envios ter o que mostrar.
// Ao conectar o banco: substituir por uma tabela `sends` (ou colunas de
// timestamp em `invoices`) que registre canal/horário de fato.

export interface SendLogEntry {
  invoiceId: string
  unitName: string
  channel: 'whatsapp' | 'email'
  sent: boolean
  contact: string
  sentAt: string | null
}

const DIACRITICS = /[̀-ͯ]/g

function fakeContact(unitName: string, channel: 'whatsapp' | 'email'): string {
  const slug = unitName
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.|\.$)/g, '')
  return channel === 'whatsapp' ? '+55 21 9····-····' : `financeiro.${slug}@forneria.com.br`
}

export const sendLog: SendLogEntry[] = mockInvoices.flatMap((inv) => [
  {
    invoiceId: inv.id,
    unitName: inv.unitName,
    channel: 'whatsapp' as const,
    sent: inv.whatsappSent,
    contact: fakeContact(inv.unitName, 'whatsapp'),
    sentAt: inv.whatsappSent ? '02/06/2026 10:15' : null,
  },
  {
    invoiceId: inv.id,
    unitName: inv.unitName,
    channel: 'email' as const,
    sent: inv.emailSent,
    contact: fakeContact(inv.unitName, 'email'),
    sentAt: inv.emailSent ? '02/06/2026 10:16' : null,
  },
])
