import { supabase } from '@/lib/supabase'
import type { Brand, Invoice, InvoiceItem, InvoiceStatus, PaymentStatus } from '@/types'
import type { EligibleServiceType } from '@/context/SettingsContext'

// Fila de faturamento/emissão de verdade, persistida em
// `nf_forneria.billing_periods`/`invoices`/`invoice_items` (schema desde a
// 0001, liberado pra escrita na 0014) — substitui o que antes vivia só em
// `useState` do React em `Faturamento.tsx` e sumia ao trocar de página.

const TENANT_NAME_TO_BRAND: Record<string, Brand> = {
  'Forneria Original': 'Forneria',
  'The Duck': 'The Duck',
}

export interface LiveInvoiceItem {
  id: string
  serviceType: EligibleServiceType
  value: number
  nfseNumber: string | null
  nfseStatus: 'pendente' | 'autorizada' | 'falha' | 'cancelada'
  urlDanfse: string | null
  errorMessage: string | null
  emitterId: string | null
}

export interface LiveInvoiceRow {
  id: string
  unitId: string
  unitName: string
  marca: Brand
  callCenterValue: number
  royaltiesValue: number
  marketingValue: number
  totalValue: number
  paymentStatus: PaymentStatus
  boletoFileName: string | null
  whatsappSent: boolean
  emailSent: boolean
  status: InvoiceStatus
  items: LiveInvoiceItem[]
}

interface InvoiceItemRow {
  id: string
  service_type: EligibleServiceType
  value: number
  nfse_number: string | null
  nfse_status: 'pendente' | 'autorizada' | 'falha' | 'cancelada'
  url_danfse: string | null
  error_message: string | null
  emitter_id: string | null
}

interface InvoiceRow {
  id: string
  unit_id: string
  total_value: number
  payment_status: PaymentStatus
  boleto_file_name: string | null
  whatsapp_sent: boolean
  email_sent: boolean
  status: InvoiceStatus
  units: { name: string; tenants: { name: string } | { name: string }[] | null } | { name: string; tenants: { name: string } | { name: string }[] | null }[] | null
  invoice_items: InvoiceItemRow[]
}

function toLiveInvoiceRow(row: InvoiceRow): LiveInvoiceRow {
  const unit = Array.isArray(row.units) ? row.units[0] : row.units
  const tenantName = Array.isArray(unit?.tenants) ? unit?.tenants[0]?.name : unit?.tenants?.name
  const marca = TENANT_NAME_TO_BRAND[tenantName ?? ''] ?? 'Forneria'
  const items: LiveInvoiceItem[] = (row.invoice_items ?? []).map((it) => ({
    id: it.id,
    serviceType: it.service_type,
    value: Number(it.value),
    nfseNumber: it.nfse_number,
    nfseStatus: it.nfse_status,
    urlDanfse: it.url_danfse,
    errorMessage: it.error_message,
    emitterId: it.emitter_id,
  }))
  const byType = Object.fromEntries(items.map((i) => [i.serviceType, i])) as Partial<Record<EligibleServiceType, LiveInvoiceItem>>
  return {
    id: row.id,
    unitId: row.unit_id,
    unitName: `${marca} ${unit?.name ?? ''}`.trim(),
    marca,
    callCenterValue: byType.call_center?.value ?? 0,
    royaltiesValue: byType.royalties?.value ?? 0,
    marketingValue: byType.marketing?.value ?? 0,
    totalValue: Number(row.total_value),
    paymentStatus: row.payment_status,
    boletoFileName: row.boleto_file_name,
    whatsappSent: row.whatsapp_sent,
    emailSent: row.email_sent,
    status: row.status,
    items,
  }
}

async function fetchTenantIdByBrand(): Promise<Partial<Record<Brand, string>>> {
  const { data, error } = await supabase.from('tenants').select('id, name')
  if (error) throw error
  const result: Partial<Record<Brand, string>> = {}
  for (const t of (data ?? []) as Array<{ id: string; name: string }>) {
    const marca = TENANT_NAME_TO_BRAND[t.name]
    if (marca) result[marca] = t.id
  }
  return result
}

async function fetchOrCreateBillingPeriod(
  tenantId: string,
  referenceMonth: string,
  meta: { sourceFileName?: string | null; importedBy?: string | null },
): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from('billing_periods')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('reference_month', referenceMonth)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return existing.id

  const { data, error } = await supabase
    .from('billing_periods')
    .insert({
      tenant_id: tenantId,
      reference_month: referenceMonth,
      source_file_name: meta.sourceFileName ?? null,
      imported_at: new Date().toISOString(),
      imported_by: meta.importedBy ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export interface QueueRowInput {
  unitId: string
  marca: Brand
  callCenterValue: number
  royaltiesValue: number
  marketingValue: number
}

// Grava a fila (preenchimento manual ou importação de planilha) nas tabelas
// reais. Item cujo serviço já tem nota AUTORIZADA nunca é tocado — reimportar
// o mês não pode apagar o rastro de uma nota real já emitida.
export async function saveQueueRows(competencia: string, rows: QueueRowInput[], sourceFileName: string | null): Promise<void> {
  if (rows.length === 0) return
  const referenceMonth = `${competencia}-01`
  const tenantIdByBrand = await fetchTenantIdByBrand()
  const { data: userData } = await supabase.auth.getUser()
  const importedBy = userData.user?.id ?? null

  const billingPeriodIdByBrand: Partial<Record<Brand, string>> = {}
  for (const marca of new Set(rows.map((r) => r.marca))) {
    const tenantId = tenantIdByBrand[marca]
    if (!tenantId) continue
    billingPeriodIdByBrand[marca] = await fetchOrCreateBillingPeriod(tenantId, referenceMonth, { sourceFileName, importedBy })
  }

  for (const row of rows) {
    const billingPeriodId = billingPeriodIdByBrand[row.marca]
    if (!billingPeriodId) continue
    const totalValue = row.callCenterValue + row.royaltiesValue + row.marketingValue

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .upsert({ billing_period_id: billingPeriodId, unit_id: row.unitId, total_value: totalValue }, { onConflict: 'billing_period_id,unit_id' })
      .select('id')
      .single()
    if (invoiceError) throw invoiceError

    const { data: existingItems, error: existingItemsError } = await supabase
      .from('invoice_items')
      .select('id, service_type, nfse_status')
      .eq('invoice_id', invoice.id)
    if (existingItemsError) throw existingItemsError
    const existingByType = Object.fromEntries(
      ((existingItems ?? []) as Array<{ id: string; service_type: string; nfse_status: string }>).map((i) => [i.service_type, i]),
    )

    const serviceValues: Array<{ serviceType: EligibleServiceType; value: number }> = [
      { serviceType: 'call_center', value: row.callCenterValue },
      { serviceType: 'royalties', value: row.royaltiesValue },
      { serviceType: 'marketing', value: row.marketingValue },
    ]
    for (const { serviceType, value } of serviceValues) {
      const existing = existingByType[serviceType]
      if (existing?.nfse_status === 'autorizada') continue
      if (value <= 0) {
        if (existing) await supabase.from('invoice_items').delete().eq('id', existing.id)
        continue
      }
      if (existing) {
        await supabase.from('invoice_items').update({ value }).eq('id', existing.id)
      } else {
        await supabase.from('invoice_items').insert({ invoice_id: invoice.id, service_type: serviceType, value, nfse_status: 'pendente' })
      }
    }
  }
}

export async function fetchInvoiceRows(competencia: string): Promise<LiveInvoiceRow[]> {
  const referenceMonth = `${competencia}-01`
  const { data: periods, error: periodsError } = await supabase.from('billing_periods').select('id').eq('reference_month', referenceMonth)
  if (periodsError) throw periodsError
  const periodIds = ((periods ?? []) as Array<{ id: string }>).map((p) => p.id)
  if (periodIds.length === 0) return []

  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, unit_id, total_value, payment_status, boleto_file_name, whatsapp_sent, email_sent, status, units(name, tenants(name)), invoice_items(id, service_type, value, nfse_number, nfse_status, url_danfse, error_message, emitter_id)',
    )
    .in('billing_period_id', periodIds)
  if (error) throw error
  return ((data ?? []) as unknown as InvoiceRow[]).map(toLiveInvoiceRow)
}

export async function recordEmissionResult(
  itemId: string,
  result: {
    nfseStatus: 'autorizada' | 'falha'
    nfseNumber?: string | null
    urlDanfse?: string | null
    errorMessage?: string | null
    emitterId?: string | null
  },
): Promise<void> {
  const { error } = await supabase
    .from('invoice_items')
    .update({
      nfse_status: result.nfseStatus,
      nfse_number: result.nfseNumber ?? null,
      url_danfse: result.urlDanfse ?? null,
      error_message: result.errorMessage ?? null,
      emitter_id: result.emitterId ?? null,
    })
    .eq('id', itemId)
  if (error) throw error
}

export async function recordCancellation(itemId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('invoice_items')
    .update({ nfse_status: 'cancelada', canceled_at: new Date().toISOString(), cancel_reason: reason })
    .eq('id', itemId)
  if (error) throw error
}

export async function updateInvoiceStatus(invoiceId: string, status: InvoiceStatus): Promise<void> {
  const { error } = await supabase.from('invoices').update({ status }).eq('id', invoiceId)
  if (error) throw error
}

export async function updateInvoicePayment(invoiceId: string, paymentStatus: PaymentStatus): Promise<void> {
  const { error } = await supabase.from('invoices').update({ payment_status: paymentStatus }).eq('id', invoiceId)
  if (error) throw error
}

export async function updateInvoiceBoleto(invoiceId: string, fileName: string, dataUrl: string): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({ boleto_file_name: fileName, boleto_file_data: dataUrl })
    .eq('id', invoiceId)
  if (error) throw error
}

// Lido só sob demanda (Ver/Baixar) — fica fora do select da listagem pra
// não carregar o PDF de todas as faturas de uma vez.
export async function fetchBoletoDataUrl(invoiceId: string): Promise<string | null> {
  const { data, error } = await supabase.from('invoices').select('boleto_file_data').eq('id', invoiceId).single()
  if (error) throw error
  return (data?.boleto_file_data as string | null) ?? null
}

// Não mexe em `status` — isso fica só pro ciclo de emissão (ver
// `updateInvoiceStatus`). "Enviado" é uma dimensão independente
// (whatsapp_sent/email_sent), senão marcar como enviado apagava o fato de já
// estar emitida (campo único sobrescrito) — achado real no Painel/Faturamento.
export async function markInvoiceSent(invoiceId: string, channel: 'whatsapp' | 'email'): Promise<void> {
  const field = channel === 'whatsapp' ? 'whatsapp_sent' : 'email_sent'
  const { error } = await supabase
    .from('invoices')
    .update({ [field]: true })
    .eq('id', invoiceId)
  if (error) throw error
}

export async function deleteInvoices(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('invoices').delete().in('id', ids)
  if (error) throw error
}

// Gera um link público (sem login) travado numa única competência — ver
// supabase/functions/public-fill-values. Token é o próprio uuid gerado pela
// coluna (gen_random_uuid()), devolvido aqui pra montar a URL.
export async function createPublicFillLink(organizationId: string, competencia: string): Promise<string> {
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('public_fill_links')
    .insert({ organization_id: organizationId, competencia: `${competencia}-01`, created_by: userData.user?.id ?? null })
    .select('token')
    .single()
  if (error) throw error
  return data.token
}

// --- Painel (Dashboard) — mesmas tabelas, mas no formato `Invoice`/
// `InvoiceItem` (desnormalizado) que `computeKpis`/`FranchiseTable` já
// esperavam desde que foram desenhados pro dado real (ver TODO.md →
// "Inventário de dados fixos/fictícios"). Substitui `mockInvoices` no Painel.

export async function fetchDashboardInvoices(competencia: string): Promise<{ invoices: Invoice[]; items: InvoiceItem[] }> {
  const referenceMonth = `${competencia}-01`
  const { data: periods, error: periodsError } = await supabase.from('billing_periods').select('id').eq('reference_month', referenceMonth)
  if (periodsError) throw periodsError
  const periodIds = ((periods ?? []) as Array<{ id: string }>).map((p) => p.id)
  if (periodIds.length === 0) return { invoices: [], items: [] }

  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, billing_period_id, unit_id, total_value, boleto_file_name, payment_status, whatsapp_sent, email_sent, status, units(name, tenants(name)), billing_periods(imported_at), invoice_items(id, service_type, value, nfse_number, nfse_status, created_at)',
    )
    .in('billing_period_id', periodIds)
  if (error) throw error

  const invoices: Invoice[] = []
  const items: InvoiceItem[] = []
  for (const row of (data ?? []) as unknown as Array<{
    id: string
    billing_period_id: string
    unit_id: string
    total_value: number
    boleto_file_name: string | null
    payment_status: PaymentStatus
    whatsapp_sent: boolean
    email_sent: boolean
    status: InvoiceStatus
    units: { name: string; tenants: { name: string } | { name: string }[] | null } | { name: string; tenants: { name: string } | { name: string }[] | null }[] | null
    billing_periods: { imported_at: string | null } | { imported_at: string | null }[] | null
    invoice_items: Array<{ id: string; service_type: EligibleServiceType; value: number; nfse_number: string | null; nfse_status: 'pendente' | 'autorizada' | 'falha' | 'cancelada'; created_at: string }>
  }>) {
    const unit = Array.isArray(row.units) ? row.units[0] : row.units
    const tenantName = Array.isArray(unit?.tenants) ? unit?.tenants[0]?.name : unit?.tenants?.name
    const marca = TENANT_NAME_TO_BRAND[tenantName ?? ''] ?? 'Forneria'
    const bp = Array.isArray(row.billing_periods) ? row.billing_periods[0] : row.billing_periods
    invoices.push({
      id: row.id,
      billingPeriodId: row.billing_period_id,
      unitId: row.unit_id,
      unitName: `${marca} ${unit?.name ?? ''}`.trim(),
      totalValue: Number(row.total_value),
      paymentMethod: 'boleto_pix',
      boletoCode: row.boleto_file_name,
      pixCopiaCola: null,
      paymentStatus: row.payment_status,
      dueDate: null,
      paidAt: null,
      whatsappSent: row.whatsapp_sent,
      emailSent: row.email_sent,
      status: row.status,
      createdAt: bp?.imported_at ?? new Date().toISOString(),
    })
    for (const it of row.invoice_items ?? []) {
      items.push({
        id: it.id,
        invoiceId: row.id,
        serviceType: it.service_type,
        serviceCode: null,
        value: Number(it.value),
        nfseNumber: it.nfse_number,
        nfseStatus: it.nfse_status,
        createdAt: it.created_at,
      })
    }
  }
  return { invoices, items }
}

function monthLabel(referenceMonth: string): string {
  const [year, month] = referenceMonth.split('-').map(Number)
  const label = new Date(year, (month ?? 1) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Série real pro gráfico "Faturamento por mês" — 1 ponto por competência que
// já teve algum invoice gravado (não mais os 6 meses fictícios fixos). Pode
// vir com só 1 mês no começo, e cresce conforme o uso real do sistema.
export async function fetchMonthlyTotals(): Promise<{ labels: string[]; issued: number[]; received: number[] }> {
  const { data, error } = await supabase.from('invoices').select('total_value, payment_status, billing_periods(reference_month)')
  if (error) throw error

  const byMonth = new Map<string, { issued: number; received: number }>()
  for (const row of (data ?? []) as unknown as Array<{
    total_value: number
    payment_status: PaymentStatus
    billing_periods: { reference_month: string } | { reference_month: string }[] | null
  }>) {
    const bp = Array.isArray(row.billing_periods) ? row.billing_periods[0] : row.billing_periods
    const month = bp?.reference_month
    if (!month) continue
    const entry = byMonth.get(month) ?? { issued: 0, received: 0 }
    entry.issued += Number(row.total_value)
    if (row.payment_status === 'paga') entry.received += Number(row.total_value)
    byMonth.set(month, entry)
  }

  const months = [...byMonth.keys()].sort()
  return {
    labels: months.map(monthLabel),
    issued: months.map((m) => byMonth.get(m)!.issued),
    received: months.map((m) => byMonth.get(m)!.received),
  }
}
