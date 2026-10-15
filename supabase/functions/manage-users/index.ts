// NF-FORNERIA-ADM · manage-users
//
// Cadastro/listagem/remoção de usuário e reenvio de reset de senha. Precisa
// da service_role (API de admin do GoTrue), por isso vive numa Edge
// Function — nunca é chamada com a anon key diretamente. Só admin (da
// própria organização) ou superadmin (qualquer organização) pode usar.
//
// POST body:
//   { action: 'list' }
//   { action: 'create', email, role: 'admin'|'superadmin', organizationId? }
//   { action: 'reset_password', userId }
//   { action: 'remove', userId }

import { createClient } from 'jsr:@supabase/supabase-js@2'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function randomPassword(): string {
  return crypto.randomUUID() + crypto.randomUUID()
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
    action?: 'list' | 'create' | 'reset_password' | 'remove'
    email?: string
    role?: 'admin' | 'superadmin'
    organizationId?: string
    userId?: string
  }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  const adminHeaders = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, 'Content-Type': 'application/json' }

  // ---- list ----
  if (body.action === 'list') {
    let query = supabase.from('profiles').select('id, role, organization_id, created_at, organizations(name)')
    if (!isSuper) query = query.eq('organization_id', callerProfile.organization_id)
    const { data: profiles, error } = await query
    if (error) return jsonResponse({ error: 'db_error', message: error.message }, 500)

    const usersResp = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, { headers: adminHeaders })
    const usersBody = (await usersResp.json().catch(() => null)) as { users?: Array<{ id: string; email: string }> } | null
    const emailById = new Map((usersBody?.users ?? []).map((u) => [u.id, u.email]))

    const result = (profiles ?? []).map((p: { id: string; role: string; organization_id: string | null; created_at: string; organizations: { name: string } | { name: string }[] | null }) => {
      const org = Array.isArray(p.organizations) ? p.organizations[0] : p.organizations
      return {
        id: p.id,
        email: emailById.get(p.id) ?? '—',
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
      .insert({ id: newUserId, role, organization_id: organizationId })
    if (profileError) {
      // reverte o usuário criado no Auth pra não ficar órfão sem perfil
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${newUserId}`, { method: 'DELETE', headers: adminHeaders })
      return jsonResponse({ error: 'db_error', message: profileError.message }, 500)
    }

    // dispara o e-mail de "defina sua senha" (mesmo fluxo de recuperação de
    // senha — precisa de SMTP configurado no GoTrue pra chegar de verdade).
    await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: 'POST',
      headers: { apikey: serviceRoleKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => null)

    return jsonResponse({ ok: true, userId: newUserId })
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

    const recoverResp = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: 'POST',
      headers: { apikey: serviceRoleKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!recoverResp.ok) {
      const recoverBody = await recoverResp.json().catch(() => null)
      return jsonResponse({ error: 'auth_error', message: recoverBody?.msg ?? 'Falha ao enviar e-mail de redefinição.' }, 502)
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
