// NF-FORNERIA-ADM · request-password-reset
//
// Chamada pela tela de login (sem sessão nenhuma, de propósito — é o fluxo
// "esqueci minha senha"). Gera o link de recuperação pela API de admin do
// Supabase (não depende do SMTP do GOTRUE, que não estava entregando) e
// manda esse link pelo SMTP próprio da organização (nf_forneria.
// smtp_settings, migration 0017). Sempre devolve { ok: true } — nunca vaza
// se o e-mail existe ou não (mitigação de enumeração de conta).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.14'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  let body: { email?: string; redirectTo?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }
  const email = body.email?.trim().toLowerCase()
  if (!email) return jsonResponse({ error: 'missing_email' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'server_misconfigured' }, 500)
  const adminHeaders = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, 'Content-Type': 'application/json' }

  try {
    const usersResp = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, { headers: adminHeaders })
    const usersBody = (await usersResp.json().catch(() => null)) as { users?: Array<{ id: string; email: string }> } | null
    const user = (usersBody?.users ?? []).find((u) => u.email?.toLowerCase() === email)
    if (!user) return jsonResponse({ ok: true })

    const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: 'nf_forneria' } })
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (!profile?.organization_id) return jsonResponse({ ok: true })

    const linkResp = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ type: 'recovery', email, redirect_to: body.redirectTo }),
    })
    const linkBody = await linkResp.json().catch(() => null)
    const actionLink: string | undefined = linkBody?.action_link ?? linkBody?.properties?.action_link
    if (!linkResp.ok || !actionLink) {
      console.error('generate_link falhou:', JSON.stringify(linkBody))
      return jsonResponse({ ok: true })
    }

    const { data: smtp } = await supabase
      .from('smtp_settings')
      .select('host, port, username, password, from_email, from_name, enabled')
      .eq('organization_id', profile.organization_id)
      .maybeSingle()
    if (!smtp || !smtp.enabled) return jsonResponse({ ok: true })

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.username, pass: smtp.password },
    })
    await transporter.sendMail({
      from: smtp.from_name ? `"${smtp.from_name}" <${smtp.from_email}>` : smtp.from_email,
      to: email,
      subject: 'Redefinir sua senha',
      html: `<p>Clique no link abaixo pra definir uma senha nova:</p><p><a href="${actionLink}">${actionLink}</a></p><p>Se você não pediu isso, pode ignorar esse e-mail.</p>`,
    })
    return jsonResponse({ ok: true })
  } catch (e) {
    console.error('request-password-reset:', e instanceof Error ? e.message : e)
    return jsonResponse({ ok: true })
  }
})
