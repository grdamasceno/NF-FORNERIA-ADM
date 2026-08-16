// DADOS FICTÍCIOS — 8 unidades reais (nomes batem com a rede), mas os
// valores de Call Center/Royalties/Marketing são inventados (o repositório é
// público, então não commitamos os valores reais de faturamento — ver
// TODO.md → "Inventário de dados fixos/fictícios"). Representam a "fila de
// emissão" da competência: candidatos a `invoice_item` (seção 3 do MD v2)
// que ainda não viraram fatura/NFS-e — por isso ficam num arquivo à parte em
// vez de dentro de `mockInvoices.ts` (que já representa faturas
// emitidas/pagas/etc., ou seja, um estágio posterior).
// Ao conectar o banco: isto vira a consulta que lista `billing_period` com
// faturas em `pendente_emissao`.
export interface PendingEmissionRow {
  id: string
  unitName: string
  callCenterValue: number
  royaltiesValue: number
  marketingValue: number
}

export const pendingEmissions: PendingEmissionRow[] = [
  { id: 'pend-vargem', unitName: 'Forneria Vargem Pequena', callCenterValue: 1980.5, royaltiesValue: 6840.3, marketingValue: 1360.2 },
  { id: 'pend-freguesia', unitName: 'Forneria Freguesia', callCenterValue: 3420.8, royaltiesValue: 0, marketingValue: 3710.4 },
  { id: 'pend-leblon', unitName: 'Forneria Leblon', callCenterValue: 4420.0, royaltiesValue: 34980.6, marketingValue: 6990.15 },
  { id: 'pend-jardim-oceanico', unitName: 'Forneria Jardim Oceânico', callCenterValue: 3105.9, royaltiesValue: 0, marketingValue: 4430.7 },
  { id: 'pend-rio-2', unitName: 'Forneria Rio 2', callCenterValue: 3140.25, royaltiesValue: 0, marketingValue: 3985.5 },
  { id: 'pend-botafogo', unitName: 'Forneria Botafogo', callCenterValue: 3850.6, royaltiesValue: 34210.9, marketingValue: 6845.1 },
  { id: 'pend-taquara', unitName: 'Forneria Taquara', callCenterValue: 1820.4, royaltiesValue: 8320.75, marketingValue: 1660.9 },
  { id: 'pend-grajau', unitName: 'Forneria Grajaú', callCenterValue: 2590.3, royaltiesValue: 13890.2, marketingValue: 2780.5 },
]

export function totalOf(row: PendingEmissionRow): number {
  return row.callCenterValue + row.royaltiesValue + row.marketingValue
}
