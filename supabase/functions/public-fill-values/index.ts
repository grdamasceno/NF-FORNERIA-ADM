// NF-FORNERIA-ADM · public-fill-values
//
// Único ponto de escrita do app que não exige login — usado pela página
// pública /preencher-publico/:token (ver migration 0016). Roda com
// service_role (nunca a anon key) e é o único jeito de ler/gravar a fila de
// faturamento a partir de um token: não existe policy de anon nas tabelas
// reais, de propósito. Valida token/revogação/expiração em toda chamada.
//
// POST body:
//   { token: "uuid" }                                            -> carrega unidades + valores já preenchidos
//   { token: "uuid", action: "save", values: [{unitId, callCenter, royalties, marketing}] } -> grava

import { createClient } from 'jsr:@supabase/supabase-js@2'

const TENANT_NAME_TO_BRAND: Record<string, string> = {
  'Forneria Original': 'Forneria',
  'The Duck': 'The Duck',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  let body: { token?: string; action?: 'save'; values?: Array<{ unitId: string; callCenter?: number; royalties?: number; marketing?: number }> }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }
  const { token } = body
  if (!token) return jsonResponse({ error: 'missing_token' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'server_misconfigured' }, 500)
  const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: 'nf_forneria' } })

  const { data: link, error: linkError } = await supabase
    .from('public_fill_links')
    .select('token, organization_id, competencia, expires_at, revoked')
    .eq('token', token)
    .single()
  if (linkError || !link) return jsonResponse({ error: 'invalid_link', message: 'Link não encontrado.' }, 404)
  if (link.revoked) return jsonResponse({ error: 'invalid_link', message: 'Esse link foi revogado.' }, 404)
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return jsonResponse({ error: 'invalid_link', message: 'Esse link expirou.' }, 404)
  }

  const { data: tenants } = await supabase.from('tenants').select('id, name').eq('organization_id', link.organization_id)
  const tenantIds = (tenants ?? []).map((t: { id: string }) => t.id)

  // ---- modo "save" ----
  if (body.action === 'save') {
    const rows = Array.isArray(body.values) ? body.values : []
    const { data: validUnits } = await supabase.from('units').select('id, tenant_id').in('tenant_id', tenantIds)
    const tenantByUnit = new Map((validUnits ?? []).map((u: { id: string; tenant_id: string }) => [u.id, u.tenant_id]))

    for (const row of rows) {
      const tenantId = tenantByUnit.get(row.unitId)
      if (!tenantId) continue // unidade não pertence à organização desse link — ignora silenciosamente

      let bpId: string | null = null
      const { data: bp } = await supabase
        .from('billing_periods')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('reference_month', link.competencia)
        .maybeSingle()
      if (bp) {
        bpId = bp.id
      } else {
        const { data: created } = await supabase
          .from('billing_periods')
          .insert({ tenant_id: tenantId, reference_month: link.competencia, source_file_name: 'Link público' })
          .select('id')
          .single()
        bpId = created?.id ?? null
      }
      if (!bpId) continue

      const callCenter = Number(row.callCenter) || 0
      const royalties = Number(row.royalties) || 0
      const marketing = Number(row.marketing) || 0
      const totalValue = callCenter + royalties + marketing

      const { data: invoice } = await supabase
        .from('invoices')
        .upsert({ billing_period_id: bpId, unit_id: row.unitId, total_value: totalValue }, { onConflict: 'billing_period_id,unit_id' })
        .select('id')
        .single()
      if (!invoice) continue

      const { data: existingItems } = await supabase
        .from('invoice_items')
        .select('id, service_type, nfse_status')
        .eq('invoice_id', invoice.id)
      const existingByType = Object.fromEntries(
        ((existingItems ?? []) as Array<{ id: string; service_type: string; nfse_status: string }>).map((i) => [i.service_type, i]),
      )

      for (const { serviceType, value } of [
        { serviceType: 'call_center', value: callCenter },
        { serviceType: 'royalties', value: royalties },
        { serviceType: 'marketing', value: marketing },
      ]) {
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
    return jsonResponse({ ok: true })
  }

  // ---- modo "load" (default) ----
  const { data: org } = await supabase.from('organizations').select('name').eq('id', link.organization_id).single()
  const { data: unitsRows } = await supabase
    .from('units')
    .select('id, name, tenants(name)')
    .in('tenant_id', tenantIds)
    .eq('active', true)
    .order('name')

  const { data: periods } = await supabase
    .from('billing_periods')
    .select('id')
    .in('tenant_id', tenantIds)
    .eq('reference_month', link.competencia)
  const periodIds = (periods ?? []).map((p: { id: string }) => p.id)

  const existingValues: Record<string, Record<string, number>> = {}
  if (periodIds.length > 0) {
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('unit_id, invoice_items(service_type, value)')
      .in('billing_period_id', periodIds)
    for (const inv of (invoicesData ?? []) as Array<{ unit_id: string; invoice_items: Array<{ service_type: string; value: number }> }>) {
      const entry: Record<string, number> = {}
      for (const it of inv.invoice_items ?? []) entry[it.service_type] = it.value
      existingValues[inv.unit_id] = entry
    }
  }

  const units = ((unitsRows ?? []) as Array<{ id: string; name: string; tenants: { name: string } | { name: string }[] | null }>).map((u) => {
    const tenantName = Array.isArray(u.tenants) ? u.tenants[0]?.name : u.tenants?.name
    return {
      id: u.id,
      name: u.name,
      marca: TENANT_NAME_TO_BRAND[tenantName ?? ''] ?? 'Forneria',
      callCenter: existingValues[u.id]?.call_center ?? 0,
      royalties: existingValues[u.id]?.royalties ?? 0,
      marketing: existingValues[u.id]?.marketing ?? 0,
    }
  })

  return jsonResponse({ organizationName: org?.name ?? '', competencia: link.competencia, units })
})
