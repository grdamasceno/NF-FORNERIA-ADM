// NF-FORNERIA-ADM · manage-users
//
// Cadastro/listagem/remoção de usuário e reenvio de reset de senha. Precisa
// da service_role (API de admin do GoTrue), por isso vive numa Edge
// Function — nunca é chamada com a anon key diretamente. Só admin (da
// própria organização) ou superadmin (qualquer organização) pode usar.
//
// POST body:
//   { action: 'list' }
//   { action: 'create', email, role: 'admin'|'superadmin', organizationId?, name? }
//   { action: 'update', userId, role?, organizationId?, name? }
//   { action: 'reset_password', userId }
//   { action: 'remove', userId }

import { createClient } from 'jsr:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.14'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function randomPassword(): string {
  return crypto.randomUUID() + crypto.randomUUID()
}

// Gera o link de recuperação pela API de admin (não depende do SMTP do
// GOTRUE) e manda pelo SMTP próprio da organização (nf_forneria.
// smtp_settings) — mesmo mecanismo usado no "esqueci minha senha" do login
// (ver supabase/functions/request-password-reset). Lança erro com mensagem
// clara se não der pra mandar, pra aparecer na tela em vez de falhar calado.
async function sendPasswordSetupEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  email: string,
  redirectTo: string | undefined,
): Promise<void> {
  const adminHeaders = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, 'Content-Type': 'application/json' }

  const linkResp = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ type: 'recovery', email, redirect_to: redirectTo }),
  })
  const linkBody = await linkResp.json().catch(() => null)
  const actionLink: string | undefined = linkBody?.action_link ?? linkBody?.properties?.action_link
  if (!linkResp.ok || !actionLink) {
    throw new Error(linkBody?.msg ?? linkBody?.message ?? 'Falha ao gerar o link de redefinição.')
  }

  const { data: smtp } = await supabase
    .from('smtp_settings')
    .select('host, port, username, password, from_email, from_name, enabled')
    .eq('singleton', true)
    .maybeSingle()
  if (!smtp || !smtp.enabled) {
    throw new Error('SMTP não configurado (ver Configurações → SMTP).')
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.username, pass: smtp.password },
  })
  await transporter.sendMail({
    from: smtp.from_name ? `"${smtp.from_name}" <${smtp.from_email}>` : smtp.from_email,
    to: email,
    subject: 'Definir sua senha',
    html: `<p>Clique no link abaixo pra definir sua senha:</p><p><a href="${actionLink}">${actionLink}</a></p>`,
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const callerAuthHeader = req.headers.get('Authorization')
  if (!callerAuthHeader) return jsonResponse({ error: 'unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'server_misconfigured' }, 500)

  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: callerAuthHeader, apikey: serviceRoleKey },
  })
  if (!userResp.ok) return jsonResponse({ error: 'unauthorized' }, 401)
  const authUser = (await userResp.json()) as { id?: string }
  if (!authUser.id) return jsonResponse({ error: 'unauthorized' }, 401)

  const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: 'nf_forneria' } })
  const { data: callerProfile } = await supabase.from('profiles').select('role, organization_id').eq('id', authUser.id).single()
  if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'superadmin')) {
    return jsonResponse({ error: 'forbidden' }, 403)
  }
  const isSuper = callerProfile.role === 'superadmin'

  let body: {
    action?: 'list' | 'create' | 'update' | 'reset_password' | 'remove'
    email?: string
    role?: 'admin' | 'superadmin'
    organizationId?: string | null
    userId?: string
    redirectTo?: string
    name?: string
  }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  const adminHeaders = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, 'Content-Type': 'application/json' }

  // ---- list ----
  if (body.action === 'list') {
    let query = supabase.from('profiles').select('id, role, organization_id, name, created_at, organizations(name)')
    if (!isSuper) query = query.eq('organization_id', callerProfile.organization_id)
    const { data: profiles, error } = await query
    if (error) return jsonResponse({ error: 'db_error', message: error.message }, 500)

    const usersResp = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, { headers: adminHeaders })
    const usersBody = (await usersResp.json().catch(() => null)) as { users?: Array<{ id: string; email: string }> } | null
    const emailById = new Map((usersBody?.users ?? []).map((u) => [u.id, u.email]))

    const result = (profiles ?? []).map((p: { id: string; role: string; organization_id: string | null; name: string | null; created_at: string; organizations: { name: string } | { name: string }[] | null }) => {
      const org = Array.isArray(p.organizations) ? p.organizations[0] : p.organizations
      return {
        id: p.id,
        email: emailById.get(p.id) ?? '—',
        name: p.name,
        role: p.role,
        organizationId: p.organization_id,
        organizationName: org?.name ?? null,
        createdAt: p.created_at,
      }
    })
    return jsonResponse({ users: result })
  }

  // ---- create ----
  if (body.action === 'create') {
    const email = body.email?.trim().toLowerCase()
    const role = body.role
    if (!email || !role) return jsonResponse({ error: 'missing_fields', message: 'email e role são obrigatórios.' }, 400)
    if (role !== 'admin' && role !== 'superadmin') return jsonResponse({ error: 'invalid_role' }, 400)
    if (role === 'superadmin' && !isSuper) return jsonResponse({ error: 'forbidden', message: 'Só superadmin cria outro superadmin.' }, 403)

    const organizationId = isSuper ? (body.organizationId ?? null) : callerProfile.organization_id
    if (role === 'admin' && !organizationId) {
      return jsonResponse({ error: 'missing_organization', message: 'admin precisa de uma organização.' }, 400)
    }

    const createResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ email, password: randomPassword(), email_confirm: true }),
    })
    const createBody = await createResp.json().catch(() => null)
    if (!createResp.ok) {
      return jsonResponse({ error: 'auth_error', message: createBody?.msg ?? createBody?.message ?? 'Falha ao criar usuário.' }, 502)
    }
    const newUserId = createBody.id as string

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: newUserId, role, organization_id: organizationId, name: body.name?.trim() || null })
    if (profileError) {
      // reverte o usuário criado no Auth pra não ficar órfão sem perfil
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${newUserId}`, { method: 'DELETE', headers: adminHeaders })
      return jsonResponse({ error: 'db_error', message: profileError.message }, 500)
    }

    let emailWarning: string | null = null
    try {
      await sendPasswordSetupEmail(supabaseUrl, serviceRoleKey, supabase, email, body.redirectTo)
    } catch (e) {
      emailWarning = e instanceof Error ? e.message : 'Falha ao enviar e-mail de definição de senha.'
    }

    return jsonResponse({ ok: true, userId: newUserId, emailWarning })
  }

  // ---- update ----
  if (body.action === 'update') {
    if (!body.userId) return jsonResponse({ error: 'missing_user_id' }, 400)
    const { data: targetProfile } = await supabase.from('profiles').select('organization_id, role').eq('id', body.userId).single()
    if (!targetProfile) return jsonResponse({ error: 'not_found' }, 404)
    if (!isSuper && targetProfile.organization_id !== callerProfile.organization_id) return jsonResponse({ error: 'forbidden' }, 403)

    const patch: { role?: string; organization_id?: string | null; name?: string | null } = {}
    if (body.name !== undefined) patch.name = body.name.trim() || null
    if (body.role !== undefined) {
      if (body.role !== 'admin' && body.role !== 'superadmin') return jsonResponse({ error: 'invalid_role' }, 400)
      if (body.role === 'superadmin' && !isSuper) return jsonResponse({ error: 'forbidden', message: 'Só superadmin promove a superadmin.' }, 403)
      patch.role = body.role
    }
    if (body.organizationId !== undefined) {
      if (!isSuper) return jsonResponse({ error: 'forbidden', message: 'Só superadmin muda organização.' }, 403)
      patch.organization_id = body.organizationId
    }
    const finalRole = patch.role ?? targetProfile.role
    const finalOrgId = patch.organization_id !== undefined ? patch.organization_id : targetProfile.organization_id
    if (finalRole === 'admin' && !finalOrgId) {
      return jsonResponse({ error: 'missing_organization', message: 'admin precisa de uma organização.' }, 400)
    }

    const { error } = await supabase.from('profiles').update(patch).eq('id', body.userId)
    if (error) return jsonResponse({ error: 'db_error', message: error.message }, 500)
    return jsonResponse({ ok: true })
  }

  // ---- reset_password ----
  if (body.action === 'reset_password') {
    if (!body.userId) return jsonResponse({ error: 'missing_user_id' }, 400)
    const { data: targetProfile } = await supabase.from('profiles').select('organization_id').eq('id', body.userId).single()
    if (!targetProfile) return jsonResponse({ error: 'not_found' }, 404)
    if (!isSuper && targetProfile.organization_id !== callerProfile.organization_id) return jsonResponse({ error: 'forbidden' }, 403)

    const userResp2 = await fetch(`${supabaseUrl}/auth/v1/admin/users/${body.userId}`, { headers: adminHeaders })
    const userBody = await userResp2.json().catch(() => null)
    const email = userBody?.email as string | undefined
    if (!email) return jsonResponse({ error: 'not_found' }, 404)

    try {
      await sendPasswordSetupEmail(supabaseUrl, serviceRoleKey, supabase, email, body.redirectTo)
    } catch (e) {
      return jsonResponse({ error: 'smtp_error', message: e instanceof Error ? e.message : 'Falha ao enviar e-mail.' }, 502)
    }
    return jsonResponse({ ok: true })
  }

  // ---- remove ----
  if (body.action === 'remove') {
    if (!body.userId) return jsonResponse({ error: 'missing_user_id' }, 400)
    if (body.userId === authUser.id) return jsonResponse({ error: 'cannot_remove_self' }, 400)
    const { data: targetProfile } = await supabase.from('profiles').select('organization_id').eq('id', body.userId).single()
    if (!targetProfile) return jsonResponse({ error: 'not_found' }, 404)
    if (!isSuper && targetProfile.organization_id !== callerProfile.organization_id) return jsonResponse({ error: 'forbidden' }, 403)

    const deleteResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${body.userId}`, { method: 'DELETE', headers: adminHeaders })
    if (!deleteResp.ok) {
      const deleteBody = await deleteResp.json().catch(() => null)
      return jsonResponse({ error: 'auth_error', message: deleteBody?.msg ?? 'Falha ao remover usuário.' }, 502)
    }
    return jsonResponse({ ok: true })
  }

  return jsonResponse({ error: 'invalid_action' }, 400)
})
