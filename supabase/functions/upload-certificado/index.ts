// NF-FORNERIA-ADM · upload-certificado
//
// Repassa o certificado A1 (.pfx) e a senha pra Focus NFe (PUT /v2/empresas/{id})
// e grava só a data de validade devolvida. Nada do arquivo nem da senha é
// persistido. Só admin da organização do emissor (ou superadmin) pode chamar.
//
// Body: { emitterId, ambiente: 'homologacao' | 'producao', arquivoBase64, senha }

import { createClient } from 'jsr:@supabase/supabase-js@2'

type Ambiente = 'homologacao' | 'producao'

const FOCUS_BASE_URL: Record<Ambiente, string> = {
  homologacao: 'https://homologacao.focusnfe.com.br',
  producao: 'https://api.focusnfe.com.br',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function basicAuthHeader(token: string): string {
  return 'Basic ' + btoa(`${token}:`)
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'server_misconfigured' }, 500)
  }

  // Valida o usuário logado pelo próprio Auth (não confia no header sem checar).
  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: serviceRoleKey },
  })
  if (!userResp.ok) return jsonResponse({ error: 'unauthorized' }, 401)
  const user = (await userResp.json()) as { id?: string }
  if (!user.id) return jsonResponse({ error: 'unauthorized' }, 401)

  let body: { emitterId?: string; ambiente?: Ambiente; arquivoBase64?: string; senha?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }
  const { emitterId, ambiente, arquivoBase64, senha } = body
  if (!emitterId || !ambiente || !arquivoBase64 || !senha) {
    return jsonResponse({ error: 'missing_fields' }, 400)
  }
  if (ambiente !== 'homologacao' && ambiente !== 'producao') {
    return jsonResponse({ error: 'invalid_ambiente' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { db: { schema: 'nf_forneria' } })

  const { data: profile } = await admin.from('profiles').select('role, organization_id').eq('id', user.id).single()
  if (!profile) return jsonResponse({ error: 'forbidden' }, 403)

  const { data: emitter, error: emitterError } = await admin
    .from('emitters')
    .select('id, organization_id, focus_empresa_id')
    .eq('id', emitterId)
    .single()
  if (emitterError || !emitter) return jsonResponse({ error: 'emitter_not_found' }, 404)

  const isSuper = profile.role === 'superadmin'
  if (!isSuper && profile.role !== 'admin') return jsonResponse({ error: 'forbidden' }, 403)
  if (!isSuper && profile.organization_id !== emitter.organization_id) return jsonResponse({ error: 'forbidden' }, 403)

  if (!emitter.focus_empresa_id) {
    return jsonResponse({ error: 'missing_focus_empresa_id', message: 'Cadastre o ID da empresa na Focus NFe antes de enviar o certificado.' }, 400)
  }

  const { data: credential } = await admin
    .from('emitter_credentials')
    .select('token')
    .eq('emitter_id', emitterId)
    .eq('ambiente', ambiente)
    .single()
  if (!credential) return jsonResponse({ error: 'credential_not_found' }, 404)

  const focusResp = await fetch(`${FOCUS_BASE_URL[ambiente]}/v2/empresas/${emitter.focus_empresa_id}`, {
    method: 'PUT',
    headers: { Authorization: basicAuthHeader(credential.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ arquivo_certificado_base64: arquivoBase64, senha_certificado: senha }),
  })
  const focusBody = (await focusResp.json().catch(() => null)) as Record<string, unknown> | null

  if (!focusResp.ok) {
    return jsonResponse({ error: 'focus_nfe_error', status: focusResp.status, body: focusBody }, 502)
  }

  const validoAte = (focusBody?.certificado_valido_ate as string | undefined) ?? null
  await admin.from('emitters').update({ certificado_valido_ate: validoAte }).eq('id', emitterId)

  return jsonResponse({ certificado_valido_ate: validoAte })
})
