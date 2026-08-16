import { mockInvoices } from './mockInvoices'

// DADOS 100% FICTÍCIOS — prévia de relatórios. Relatórios estão fora do
// escopo do MVP (seção 7 do MD); isto é só um esboço visual do que a tela
// poderia mostrar, não um cálculo real de série histórica.

export const quarterlyRevenue = [
  { label: 'T3 2025', value: 198400 },
  { label: 'T4 2025', value: 214100 },
  { label: 'T1 2026', value: 226700 },
  { label: 'T2 2026', value: 231950 },
]

export const topUnits = mockInvoices
  .slice()
  .sort((a, b) => b.totalValue - a.totalValue)
  .slice(0, 5)
  .map((inv) => ({ unitName: inv.unitName, value: inv.totalValue }))

export const averageTicket = Math.round(
  mockInvoices.reduce((sum, inv) => sum + inv.totalValue, 0) / mockInvoices.length,
)
