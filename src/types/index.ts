// Modelo de dados espelhando o schema Supabase/Postgres descrito em
// MVP_Faturamento_Franquias.md (seção 4).

export type NfseMode = 'consolidado' | 'separado_por_servico'

export interface Tenant {
  id: string
  name: string
  logoUrl: string | null
  primaryColor: string | null
  // Decide, na emissão, se cada fatura vira 1 invoice_item consolidado ou até
  // 3 (um por service_type) — ver seção 3/4 do MD (v2).
  nfseMode: NfseMode
  createdAt: string
}

export interface Unit {
  id: string
  tenantId: string
  name: string
  cnpj: string | null
  active: boolean
  createdAt: string
}

export type Brand = 'Forneria' | 'The Duck'

// Cadastro de unidades usado na tela de Franquias, gerado em
// src/data/franquias.json a partir de duas fontes reais:
// - nomes + marca: Arquivos/Banco Junho 2026 Emissao de boletos.xlsx (abas
//   "Forneria" e "The Duck" — planilha operacional real de cobrança);
// - endereço/cidade/horário/imagem: Arquivos/unidades_rows.json (cadastro
//   real do Supabase, mas só cobre a marca Forneria) via casamento manual de
//   nomes (ver TEMP script usado para gerar o merge).
// Unidades sem correspondência no cadastro (ex: novas aberturas, ou toda a
// marca The Duck) ficam com os campos de endereço em null. Ainda não tem
// CNPJ nem vínculo direto com `Unit`/`invoices` — isso fica para quando o
// cadastro fiscal (seção 7 do MD) entrar no MVP.
export interface FranchiseUnit {
  id: string
  nome: string
  marca: Brand
  estado: string | null
  cidade: string | null
  endereco: string | null
  horario: string | null
  imagem: string | null
  uf: string | null
  ativo: boolean
}

// Unidade vinda de verdade do Supabase (`nf_forneria.units`, migrations
// 0005/0006) — usada só na tela de Franquias, que é a única ligada ao banco
// por enquanto (Sidebar/Configurações continuam no `FranchiseUnit` estático
// acima). Tem os campos fiscais que `FranchiseUnit` não tem, necessários
// pro "tomador" da NFS-e (seção 8 do MD / integração Focus NFe).
export interface LiveUnit {
  id: string
  tenantId: string
  marca: Brand
  name: string
  // Nome fantasia da unidade (`name`, ex: "Bangu") é distinto da razão
  // social completa da empresa — a NFS-e exige a razão social como nome do
  // tomador, não o nome fantasia (migration 0008).
  razaoSocial: string | null
  cnpj: string | null
  active: boolean
  cidade: string | null
  estado: string | null
  uf: string | null
  endereco: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cep: string | null
  codigoMunicipio: string | null
  telefone: string | null
  email: string | null
  horario: string | null
  imagem: string | null
}

export interface BillingPeriod {
  id: string
  tenantId: string
  referenceMonth: string // ex: 2026-06-01
  sourceFileName: string | null
  importedAt: string | null
  importedBy: string | null
}

export type NfseStatus = 'pendente' | 'simulada' | 'falha'
export type PaymentStatus = 'paga' | 'a_vencer' | 'atraso' | 'pendente'
// 'atraso' não está no DDL da seção 4 do MD, mas é citado como estado do fluxo
// na seção 6 (calculado quando due_date < hoje e não paga).
export type InvoiceStatus = 'pendente_emissao' | 'emitida' | 'enviada' | 'paga' | 'atraso' | 'falha'

// Fatura por unidade/mês — sempre 1 boleto/PIX, independente de quantos
// invoice_items (e portanto NFS-e) existirem por trás dela (seção 4 do MD v2).
export interface Invoice {
  id: string
  billingPeriodId: string
  unitId: string
  unitName: string // desnormalizado para exibição direta na tabela/dashboard
  totalValue: number // soma de todos os invoice_items
  paymentMethod: 'boleto_pix'
  boletoCode: string | null
  pixCopiaCola: string | null
  paymentStatus: PaymentStatus
  dueDate: string | null
  paidAt: string | null
  whatsappSent: boolean
  emailSent: boolean
  status: InvoiceStatus
  createdAt: string
}

export type ServiceType = 'royalties' | 'marketing' | 'call_center' | 'consolidado'

// 1 a N por invoice — permite consolidar (1 item) ou separar por serviço (até
// 3 itens), conforme `tenants.nfseMode`. Cada item tem sua própria NFS-e
// simulada (seção 4 do MD v2).
export interface InvoiceItem {
  id: string
  invoiceId: string
  serviceType: ServiceType
  serviceCode: string | null // código de serviço (LC 116/2003), para a integração real futura
  value: number
  nfseNumber: string | null
  nfseStatus: NfseStatus
  createdAt: string
}

// Linha crua extraída da planilha antes de virar Invoice (seção 3 do MD).
export interface ParsedSpreadsheetRow {
  unitName: string
  callCenterValue: number
  royaltiesValue: number
  marketingValue: number
  totalValue: number
  hasNoCharge: boolean // true quando os 3 valores somam 0
}

export interface ImportWarning {
  rowIndex: number
  unitName: string | null
  message: string
}

export interface DashboardKpis {
  issuedTotal: number
  receivedTotal: number
  openTotal: number
  defaultRatePct: number
}
