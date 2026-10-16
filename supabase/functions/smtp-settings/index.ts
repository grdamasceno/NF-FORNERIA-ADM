// NF-FORNERIA-ADM · smtp-settings
//
// Lê/grava o SMTP próprio do app (nf_forneria.smtp_settings, migration
// 0017/0018) — nunca devolve a senha de volta pro navegador, só confirma
// que está configurado. Só superadmin mexe nisso. Tabela é singleton (uma
// config só pro app inteiro, não por organização — pedido do usuário,
// evita o caso de um superadmin sem organização nenhuma não ter de onde
// puxar SMTP).
//
// POST body:
//   { action: 'get' }
//   { action: 'save', host, port, username, password?, fromEmail, fromName?, useTls, enabled }

import { createClient } from 'jsr:@supabase/supabase-js@2'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
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
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', authUser.id).single()
  if (!profile || profile.role !== 'superadmin') return jsonResponse({ error: 'forbidden', message: 'Só superadmin configura SMTP.' }, 403)

  let body: {
    action?: 'get' | 'save'
    host?: string
    port?: number
    username?: string
    password?: string
    fromEmail?: string
    fromName?: string
    useTls?: boolean
    enabled?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  if (body.action === 'save') {
    const { host, port, username, fromEmail } = body
    if (!host || !port || !username || !fromEmail) {
      return jsonResponse({ error: 'missing_fields', message: 'Host, porta, usuário e e-mail remetente são obrigatórios.' }, 400)
    }
    const { data: existing } = await supabase.from('smtp_settings').select('password').eq('singleton', true).maybeSingle()
    if (!body.password && !existing) {
      return jsonResponse({ error: 'missing_password', message: 'Senha é obrigatória no primeiro cadastro.' }, 400)
    }

    const { error } = await supabase.from('smtp_settings').upsert(
      {
        singleton: true,
        host,
        port,
        username,
        password: body.password || existing!.password,
        from_email: fromEmail,
        from_name: body.fromName ?? null,
        use_tls: body.useTls !== false,
        enabled: body.enabled !== false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'singleton' },
    )
    if (error) return jsonResponse({ error: 'db_error', message: error.message }, 500)
    return jsonResponse({ ok: true })
  }

  // ---- get (default) ----
  const { data } = await supabase
    .from('smtp_settings')
    .select('host, port, username, from_email, from_name, use_tls, enabled, updated_at')
    .eq('singleton', true)
    .maybeSingle()
  return jsonResponse({ settings: data ? { ...data, hasPassword: true } : null })
})
