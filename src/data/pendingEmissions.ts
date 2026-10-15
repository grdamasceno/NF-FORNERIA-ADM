import type { Brand } from '@/types'

// Fila de emissão da competência: candidatos a `invoice_item` (seção 3 do MD
// v2) que ainda não viraram fatura/NFS-e. Populada em tempo real — via
// importação de planilha (`toPendingRows` em `Faturamento.tsx`) ou
// preenchimento manual (`PreencherValores.tsx`) — nunca por um fixture
// fictício (ver TODO.md → "Inventário de dados fixos/fictícios").
//
// `unitId` é o id real da unidade em `nf_forneria.units` (Supabase), quando
// dá pra casar o nome da linha com uma unidade cadastrada — sem isso não dá
// pra emitir de verdade (não tem CNPJ/endereço fiscal pra mandar pra Focus).
export interface PendingEmissionRow {
  id: string
  unitId: string | null
  unitName: string
  marca: Brand
  callCenterValue: number
  royaltiesValue: number
  marketingValue: number
}

export function totalOf(row: PendingEmissionRow): number {
  return row.callCenterValue + row.royaltiesValue + row.marketingValue
}
