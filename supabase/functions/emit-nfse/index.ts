// NF-FORNERIA-ADM · emit-nfse
//
// Integração REAL com a Focus NFe (não simulada) — ver seção 8 do MD e
// TODO.md → "Inventário de dados fixos/fictícios". Roda como Edge Function
// (Deno) porque o token da Focus NFe não pode ser exposto no browser: essa
// função lê o token de `nf_forneria.emitter_credentials` usando a
// service_role (bypassa RLS), nunca a anon key.
//
// Referência da API usada aqui (consultada em 2026-08-27):
// https://doc.focusnfe.com.br/reference/emitir_nfse
// https://doc.focusnfe.com.br/reference/consultar_nfse
// https://doc.focusnfe.com.br/reference/autenticacao
// https://doc.focusnfe.com.br/reference/ambiente
//
// IMPORTANTE — o que esta função NÃO resolve sozinha:
// - Dados fiscais do TOMADOR (a unidade franqueada): CNPJ/CPF + endereço com
//   código do município (IBGE) precisam vir de algum cadastro. Hoje
//   `src/data/franquias.json`/`pendingEmissions.ts` não têm isso — a função
//   valida e retorna erro 400 claro se faltar, em vez de inventar dado
//   fiscal (nunca fabricar CNPJ/endereço falso numa chamada real de API).
// - `item_lista_servico`/`iss_retido`/`inscricao_municipal`/`codigo_municipio`
//   do prestador precisam estar preenchidos em `emitters`/`emitter_mapping`
//   (colunas criadas na migration 0003) — confirmar com o contador antes de
//   preencher de verdade (mesma ressalva da seção 3 do MD).
// - Deploy no self-hosted: depende de como o Edge Runtime está montado no
//   seu stack (Coolify) — normalmente é um volume apontando pra esta pasta
//   dentro do container `supabase/edge-runtime`. Ajuste conforme seu
//   docker-compose; isto aqui é só o código da função.
//
// Variáveis de ambiente esperadas (configurar como secret da função, nunca
// como VITE_*): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injetadas
// automaticamente pelo runtime do Supabase na maioria dos setups).

import { createClient } from 'jsr:@supabase/supabase-js@2'

type Ambiente = 'homologacao' | 'producao'

interface EmitirBody {
  action?: 'emitir' | 'consultar'
  emitterId: string
  ambiente: Ambiente
  ref: string
  tomador?: {
    cnpj?: string
    cpf?: string
    razaoSocial: string
    email?: string
    endereco: {
      logradouro: string
      numero: string
      bairro: string
      codigoMunicipio: string // IBGE, 7 dígitos
      uf: string
      cep: string
    }
  }
  servico?: {
    valor: number
    discriminacao: string
    itemListaServico?: string // sobrescreve o de emitter_mapping se vier
    issRetido?: boolean
  }
}

const FOCUS_BASE_URL: Record<Ambiente, string> = {
  homologacao: 'https://homologacao.focusnfe.com.br',
  producao: 'https://api.focusnfe.com.br',
}

function basicAuthHeader(token: string): string {
  return 'Basic ' + btoa(`${token}:`)
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// `new Date().toISOString()` sempre devolve UTC ("Z") — como o Brasil está
// 3h atrás (sem horário de verão desde 2019), a Focus NFe rejeita isso como
// "data de emissão no futuro" (erro E0008). Mandamos o mesmo instante, só
// que expresso no offset de Brasília, que é o que a DPS/Ambiente Nacional
// espera.
function nowInBrasiliaIso(): string {
  const spTime = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return spTime.toISOString().replace('Z', '-03:00')
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed', message: 'Use POST.' }, 405)
  }

  let body: EmitirBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  const { emitterId, ambiente, ref } = body
  if (!emitterId || !ambiente || !ref) {
    return jsonResponse({ error: 'missing_fields', message: 'emitterId, ambiente e ref são obrigatórios.' }, 400)
  }
  if (ambiente !== 'homologacao' && ambiente !== 'producao') {
    return jsonResponse({ error: 'invalid_ambiente', message: 'ambiente deve ser "homologacao" ou "producao".' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'server_misconfigured', message: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configuradas na função.' }, 500)
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: 'nf_forneria' } })

  const { data: emitter, error: emitterError } = await supabase
    .from('emitters')
    .select('id, razao_social, cnpj, inscricao_municipal, codigo_municipio')
    .eq('id', emitterId)
    .single()
  if (emitterError || !emitter) {
    return jsonResponse({ error: 'emitter_not_found', message: emitterError?.message ?? 'Emissor não encontrado.' }, 404)
  }
  if (!emitter.inscricao_municipal || !emitter.codigo_municipio) {
    return jsonResponse(
      {
        error: 'emitter_missing_fiscal_data',
        message: `Emissor "${emitter.razao_social}" sem inscrição municipal e/ou código do município cadastrado (nf_forneria.emitters).`,
      },
      400,
    )
  }

  const { data: credential, error: credentialError } = await supabase
    .from('emitter_credentials')
    .select('token')
    .eq('emitter_id', emitterId)
    .eq('ambiente', ambiente)
    .single()
  if (credentialError || !credential) {
    return jsonResponse(
      { error: 'credential_not_found', message: `Nenhum token de ${ambiente} cadastrado para este emissor.` },
      404,
    )
  }

  const baseUrl = FOCUS_BASE_URL[ambiente]
  const authHeader = basicAuthHeader(credential.token)

  // ---- modo "consultar": só checa o status de uma emissão já feita ----
  if (body.action === 'consultar') {
    const result = await consultarNfse(baseUrl, authHeader, ref)
    return jsonResponse(result)
  }

  // ---- modo "emitir" (default) ----
  const { tomador, servico } = body
  if (!tomador || (!tomador.cnpj && !tomador.cpf) || !tomador.razaoSocial || !tomador.endereco) {
    return jsonResponse(
      {
        error: 'missing_tomador',
        message:
          'tomador (cnpj ou cpf, razaoSocial, endereco com codigoMunicipio) é obrigatório — dado fiscal da unidade franqueada ainda não está cadastrado em lugar nenhum do app (ver comentário no topo desta função).',
      },
      400,
    )
  }
  if (!servico || !servico.valor || !servico.discriminacao) {
    return jsonResponse({ error: 'missing_servico', message: 'servico.valor e servico.discriminacao são obrigatórios.' }, 400)
  }

  const itemListaServico = servico.itemListaServico
  if (!itemListaServico) {
    return jsonResponse(
      { error: 'missing_item_lista_servico', message: 'Código de serviço (LC 116/2003) não informado nem cadastrado em emitter_mapping.' },
      400,
    )
  }

  const payload = {
    data_emissao: nowInBrasiliaIso(),
    natureza_operacao: '1',
    optante_simples_nacional: true,
    prestador: {
      cnpj: emitter.cnpj.replace(/\D/g, ''),
      inscricao_municipal: emitter.inscricao_municipal,
      codigo_municipio: emitter.codigo_municipio,
    },
    tomador: {
      ...(tomador.cnpj ? { cnpj: tomador.cnpj.replace(/\D/g, '') } : { cpf: tomador.cpf!.replace(/\D/g, '') }),
      razao_social: tomador.razaoSocial,
      ...(tomador.email ? { email: tomador.email } : {}),
      endereco: {
        logradouro: tomador.endereco.logradouro,
        numero: tomador.endereco.numero,
        bairro: tomador.endereco.bairro,
        codigo_municipio: tomador.endereco.codigoMunicipio,
        uf: tomador.endereco.uf,
        cep: tomador.endereco.cep.replace(/\D/g, ''),
      },
    },
    servico: {
      valor_servicos: servico.valor,
      iss_retido: servico.issRetido ?? false,
      item_lista_servico: itemListaServico,
      discriminacao: servico.discriminacao,
      codigo_municipio: emitter.codigo_municipio,
    },
  }

  const emitResp = await fetch(`${baseUrl}/v2/nfse?ref=${encodeURIComponent(ref)}`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const emitBody = await emitResp.json().catch(() => null)

  if (!emitResp.ok) {
    return jsonResponse({ error: 'focus_nfe_error', status: emitResp.status, body: emitBody }, 502)
  }

  // Emissão é assíncrona (status inicial normalmente "processando_autorizacao").
  // Faz um curto polling aqui pra tentar devolver o resultado final já nesta
  // chamada; se não resolver a tempo, devolve "processando" — o cliente pode
  // chamar de novo com { action: "consultar", ref } depois.
  let final = emitBody
  for (let attempt = 0; attempt < 5; attempt++) {
    if (final?.status && final.status !== 'processando_autorizacao') break
    await new Promise((resolve) => setTimeout(resolve, 2000))
    final = await consultarNfse(baseUrl, authHeader, ref)
  }

  return jsonResponse(final, 201)
})

async function consultarNfse(baseUrl: string, authHeader: string, ref: string) {
  const resp = await fetch(`${baseUrl}/v2/nfse/${encodeURIComponent(ref)}`, {
    headers: { Authorization: authHeader },
  })
  const body = await resp.json().catch(() => null)
  return body ?? { status: 'erro_consulta', http_status: resp.status }
}
