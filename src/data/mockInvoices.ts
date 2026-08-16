import type { DashboardKpis, Invoice, InvoiceItem } from '@/types'

// DADOS 100% FICTÍCIOS — nenhuma dessas faturas existe de verdade.
// Espelha o dataset de exemplo do layout de referência
// (`MVP_Faturamento_Franquias_OnChannel (1).html`), já no formato `Invoice`,
// só para o dashboard ter o que mostrar antes da integração com Supabase.
// Ao conectar o banco: apagar este arquivo e todo import de `mockInvoices` /
// `monthlyTotals`, trocando por queries em `invoices` filtradas por
// `billing_period` (ver seção 4 do MD e TODO.md → "Inventário de dados").

const raw: Array<{
  unit: string
  cnpj: string
  value: number
  nfse: string
  payment: Invoice['paymentStatus']
  whatsappSent: boolean
  emailSent: boolean
  status: Invoice['status']
}> = [
  { unit: 'Forneria Barra da Tijuca', cnpj: '12.345.678/0001-90', value: 2450, nfse: 'NFS-e 001284', payment: 'paga', whatsappSent: true, emailSent: true, status: 'paga' },
  { unit: 'Forneria Icaraí', cnpj: '12.345.678/0002-70', value: 1980, nfse: 'NFS-e 001285', payment: 'paga', whatsappSent: true, emailSent: true, status: 'paga' },
  { unit: 'Forneria Recreio', cnpj: '12.345.678/0003-51', value: 2100, nfse: 'NFS-e 001286', payment: 'paga', whatsappSent: true, emailSent: true, status: 'paga' },
  { unit: 'Forneria Méier', cnpj: '12.345.678/0004-32', value: 1750, nfse: 'NFS-e 001287', payment: 'a_vencer', whatsappSent: true, emailSent: true, status: 'enviada' },
  { unit: 'Forneria Copacabana', cnpj: '12.345.678/0005-13', value: 2680, nfse: 'NFS-e 001288', payment: 'a_vencer', whatsappSent: false, emailSent: false, status: 'emitida' },
  { unit: 'Forneria Tijuca', cnpj: '12.345.678/0006-01', value: 1890, nfse: 'NFS-e 001289', payment: 'atraso', whatsappSent: true, emailSent: true, status: 'atraso' },
  { unit: 'Forneria Campo Grande', cnpj: '12.345.678/0007-84', value: 1620, nfse: 'NFS-e 001290', payment: 'paga', whatsappSent: true, emailSent: true, status: 'paga' },
  { unit: 'Forneria Madureira', cnpj: '12.345.678/0008-65', value: 1540, nfse: 'NFS-e 001291', payment: 'a_vencer', whatsappSent: true, emailSent: true, status: 'enviada' },
  { unit: 'Forneria São Gonçalo', cnpj: '12.345.678/0009-46', value: 1980, nfse: '—', payment: 'pendente', whatsappSent: false, emailSent: false, status: 'falha' },
  { unit: 'Forneria Nova Iguaçu', cnpj: '12.345.678/0010-99', value: 1820, nfse: 'NFS-e 001292', payment: 'a_vencer', whatsappSent: true, emailSent: true, status: 'enviada' },
]

// DUE_DATE_BY_PAYMENT / gerarBoletoFalso / gerarPixFalso: preenchem os campos
// simulados de cobrança (boleto/PIX) com valores plausíveis, no mesmo espírito
// de `src/lib/simulation.ts`, mas de forma determinística — servem só para a
// UI ter algo pra mostrar, não passam por nenhuma emissão real.
const DUE_DATE_BY_PAYMENT: Record<Invoice['paymentStatus'], string | null> = {
  paga: '2026-06-10',
  a_vencer: '2026-06-25',
  atraso: '2026-06-05',
  pendente: null,
}

function gerarBoletoFalso(seed: number): string {
  const base = 34191_00000 + seed * 137
  return String(base).replace(/(\d{5})(\d{5})/, '$1.$2')
}

function gerarPixFalso(seed: number): string {
  return `00020126580014BR.GOV.BCB.PIX0136MOCK-${seed.toString().padStart(4, '0')}5204000053039865802BR6009SIMULADO`
}

// Mock assume o tenant em modo `consolidado` (default do MD v2): 1
// invoice_item por fatura, com valor = total e sua própria NFS-e simulada.
export const mockInvoices: Invoice[] = raw.map((r, i) => ({
  id: `mock-${i + 1}`,
  billingPeriodId: 'mock-period-2026-06',
  unitId: `mock-unit-${i + 1}`,
  unitName: r.unit,
  totalValue: r.value,
  paymentMethod: 'boleto_pix',
  boletoCode: r.nfse === '—' ? null : gerarBoletoFalso(i + 1),
  pixCopiaCola: r.nfse === '—' ? null : gerarPixFalso(i + 1),
  paymentStatus: r.payment,
  dueDate: DUE_DATE_BY_PAYMENT[r.payment],
  paidAt: r.payment === 'paga' ? '2026-06-15T12:00:00Z' : null,
  whatsappSent: r.whatsappSent,
  emailSent: r.emailSent,
  status: r.status,
  createdAt: '2026-06-01T09:00:00Z',
}))

export const mockInvoiceItems: InvoiceItem[] = raw.map((r, i) => ({
  id: `mock-item-${i + 1}`,
  invoiceId: `mock-${i + 1}`,
  serviceType: 'consolidado',
  serviceCode: null,
  value: r.value,
  nfseNumber: r.nfse === '—' ? null : r.nfse,
  nfseStatus: r.nfse === '—' ? 'falha' : 'simulada',
  createdAt: '2026-06-01T09:00:00Z',
}))

export function itemsForInvoice(invoiceId: string): InvoiceItem[] {
  return mockInvoiceItems.filter((item) => item.invoiceId === invoiceId)
}

export function computeKpis(invoices: Invoice[]): DashboardKpis {
  const issuedTotal = invoices.reduce((sum, inv) => sum + inv.totalValue, 0)
  const receivedTotal = invoices.filter((inv) => inv.paymentStatus === 'paga').reduce((sum, inv) => sum + inv.totalValue, 0)
  const overdueTotal = invoices.filter((inv) => inv.paymentStatus === 'atraso').reduce((sum, inv) => sum + inv.totalValue, 0)
  const openTotal = invoices
    .filter((inv) => inv.paymentStatus === 'a_vencer' || inv.paymentStatus === 'atraso')
    .reduce((sum, inv) => sum + inv.totalValue, 0)

  return {
    issuedTotal,
    receivedTotal,
    openTotal,
    defaultRatePct: issuedTotal === 0 ? 0 : (overdueTotal / issuedTotal) * 100,
  }
}

// Fictício — série de 6 meses inventada para o gráfico de barras do Painel.
export const monthlyTotals = {
  labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
  issued: [62400, 68100, 71500, 74900, 79200, 84350],
  received: [55800, 60200, 64100, 66800, 71100, 61200],
}
