import type { Brand } from '@/types'

// Linha "de entrada" pra fila de emissão: formato comum entre importação de
// planilha (`toPendingRows` em `Faturamento.tsx`) e preenchimento manual
// (`PreencherValores.tsx`) antes de virar `invoice`/`invoice_item` de
// verdade via `saveQueueRows` (`lib/liveInvoices.ts`) — a fila em si vive no
// banco (nf_forneria.invoices/invoice_items), não aqui.
//
// `unitId` é o id real da unidade em `nf_forneria.units` (Supabase), quando
// dá pra casar o nome da linha com uma unidade cadastrada — sem isso não dá
// pra gravar fatura nenhuma (unit_id é obrigatório na tabela).
export interface PendingEmissionRow {
  id: string
  unitId: string | null
  unitName: string
  marca: Brand
  callCenterValue: number
  royaltiesValue: number
  marketingValue: number
}
