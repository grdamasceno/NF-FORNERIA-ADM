import { supabase } from '@/lib/supabase'
import type { LiveUnit } from '@/types'
import type { EmitterMappingEntry } from '@/lib/liveEmitters'

// Chama a Edge Function `emit-nfse` de verdade (não simulada) — ver seção 8
// do MD/TODO.md. Autenticado com o token da sessão, igual `uploadCertificado`
// em `liveEmitters.ts`; a função rejeita chamadas sem esse header (precisa
// ser admin/superadmin da organização do emissor).

export interface EmitirServicoParams {
  ambiente: 'homologacao' | 'producao'
  ref: string
  mapping: EmitterMappingEntry
  unit: LiveUnit
  valor: number
  discriminacao: string
}

export interface EmitirNfseResult {
  status: string
  numero?: string | null
  url_danfse?: string | null
  erros?: unknown
  mensagem?: string | null
}

export class EmitirNfseError extends Error {}

type FunctionBody = EmitirNfseResult & { error?: string; message?: string; body?: { mensagem?: string; erros?: unknown } }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Formato real dos erros da Focus varia (string solta, `{ codigo, mensagem }`,
// ou só `mensagem` no corpo) — junta o que tiver em vez de assumir uma forma só.
function describeFocusError(body: EmitirNfseResult | null): string {
  if (Array.isArray(body?.erros) && body!.erros.length > 0) {
    const parts = (body!.erros as unknown[]).map((e) => {
      if (typeof e === 'string') return e
      if (e && typeof e === 'object') {
        const o = e as { mensagem?: string; codigo?: string }
        return o.mensagem ?? o.codigo ?? JSON.stringify(e)
      }
      return String(e)
    })
    return parts.filter(Boolean).join(' · ')
  }
  if (body?.mensagem) return body.mensagem
  if (body?.status === 'processando_autorizacao') {
    return 'A Focus não confirmou a autorização a tempo — tente "Tentar de novo" em alguns instantes (a nota pode já ter sido autorizada do lado deles).'
  }
  return `Focus NFe retornou status "${body?.status ?? 'desconhecido'}" — não é uma emissão autorizada.`
}

async function callEmitFunction(accessToken: string, payload: Record<string, unknown>): Promise<{ resp: Response; body: FunctionBody | null }> {
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/emit-nfse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = (await resp.json().catch(() => null)) as FunctionBody | null
  return { resp, body }
}

// Consulta tolerante a limite de requisições da Focus (HTTP 429 / mensagem
// "máximo de requisições"): espera e tenta de novo algumas vezes.
async function consultarComRetry(
  accessToken: string,
  emitterId: string,
  ambiente: 'homologacao' | 'producao',
  ref: string,
): Promise<FunctionBody | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { resp, body } = await callEmitFunction(accessToken, { action: 'consultar', emitterId, ambiente, ref })
    if (resp.ok && body?.status) return body
    await sleep(5000)
  }
  return null
}

export async function emitirNfseReal(params: EmitirServicoParams): Promise<EmitirNfseResult> {
  const { ambiente, ref, mapping, unit, valor, discriminacao } = params
  if (!mapping.emitterId) {
    throw new EmitirNfseError('Nenhum CNPJ emissor configurado para essa marca/serviço (ver Configurações).')
  }
  if (!unit.cnpj || !unit.razaoSocial || !unit.logradouro || !unit.numero || !unit.bairro || !unit.cep || !unit.codigoMunicipio) {
    throw new EmitirNfseError(`Dado fiscal incompleto para "${unit.name}" — edite em Franquias.`)
  }
  if (!mapping.itemListaServico) {
    throw new EmitirNfseError('Código de serviço (LC 116/2003) não configurado para essa marca/serviço (ver Configurações).')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new EmitirNfseError('Sessão expirada — faça login de novo.')

  // Antes de enviar, confere se essa ref já tem nota autorizada na Focus
  // (emissão anterior que passou mas ficou registrada como falha por limite
  // de requisições, por ex). Se tiver, reaproveita a nota em vez de reenviar
  // — é isso que impede nota duplicada e traz número/PDF de volta.
  const jaEmitida = await callEmitFunction(accessToken, { action: 'consultar', emitterId: mapping.emitterId, ambiente, ref })
  if (jaEmitida.resp.ok && jaEmitida.body?.status === 'autorizado') return jaEmitida.body

  const { resp, body } = await callEmitFunction(accessToken, {
    action: 'emitir',
    emitterId: mapping.emitterId,
    ambiente,
    ref,
    tomador: {
      cnpj: unit.cnpj,
      razaoSocial: unit.razaoSocial,
      ...(unit.email ? { email: unit.email } : {}),
      endereco: {
        logradouro: unit.logradouro,
        numero: unit.numero,
        bairro: unit.bairro,
        codigoMunicipio: unit.codigoMunicipio,
        uf: unit.uf ?? '',
        cep: unit.cep,
      },
    },
    servico: {
      valor,
      discriminacao,
      itemListaServico: mapping.itemListaServico,
      codigoTributarioMunicipio: mapping.codigoTributarioMunicipio ?? undefined,
      issRetido: mapping.issRetido,
    },
  })

  if (!resp.ok) {
    const msg = String(body?.body?.mensagem ?? body?.message ?? body?.error ?? `Falha ao emitir NFS-e (HTTP ${resp.status}).`)
    // "Já autorizada": a Focus recusa o reenvio porque essa ref JÁ tem nota
    // autorizada (ex: a emissão anterior passou, mas a resposta se perdeu por
    // limite de requisições). Não é falha — busca a nota existente e devolve
    // como sucesso, sem emitir de novo.
    if (/j[aá] autorizad/i.test(msg)) {
      const existente = await consultarComRetry(accessToken, mapping.emitterId, ambiente, ref)
      if (existente?.status === 'autorizado') return existente
    }
    throw new EmitirNfseError(msg)
  }

  // A Edge Function já espera ~10s pela autorização antes de devolver. Se
  // ainda não resolveu (achado real: a Focus às vezes demora mais que isso
  // em produção), continua consultando aqui em vez de desistir — nunca
  // marcar como sucesso sem o status literal "autorizado" (ver histórico:
  // isso já gravou nota como emitida sem ter sido autorizada de verdade).
  // Consulta que falha (ex: limite de requisições da Focus) não derruba a
  // emissão: mantém o último status conhecido e tenta de novo.
  let final: FunctionBody | null = body
  for (let attempt = 0; attempt < 6 && final?.status === 'processando_autorizacao'; attempt++) {
    await sleep(3000)
    const { resp: consultaResp, body: consultaBody } = await callEmitFunction(accessToken, {
      action: 'consultar',
      emitterId: mapping.emitterId,
      ambiente,
      ref,
    })
    if (consultaResp.ok && consultaBody?.status) final = consultaBody
  }

  if (final?.status !== 'autorizado') {
    const msg = describeFocusError(final)
    if (/j[aá] autorizad/i.test(msg)) {
      const existente = await consultarComRetry(accessToken, mapping.emitterId, ambiente, ref)
      if (existente?.status === 'autorizado') return existente
    }
    throw new EmitirNfseError(msg)
  }
  return final
}

// Cancela uma NFS-e já autorizada na Focus (ação fiscal real — a prefeitura
// é notificada). Só devolve sucesso se a Focus confirmar status "cancelado".
export async function cancelarNfseReal(params: ConsultarServicoParams & { justificativa: string }): Promise<void> {
  const { ambiente, ref, mapping, justificativa } = params
  if (!mapping.emitterId) {
    throw new EmitirNfseError('Nenhum CNPJ emissor configurado para essa marca/serviço (ver Configurações).')
  }
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new EmitirNfseError('Sessão expirada — faça login de novo.')

  const { resp, body } = await callEmitFunction(accessToken, {
    action: 'cancelar',
    emitterId: mapping.emitterId,
    ambiente,
    ref,
    justificativa,
  })
  if (!resp.ok) {
    const msg = body?.body?.mensagem ?? body?.message ?? body?.error ?? `Falha ao cancelar NFS-e (HTTP ${resp.status}).`
    throw new EmitirNfseError(String(msg))
  }
  if (body?.status !== 'cancelado') {
    throw new EmitirNfseError(
      body?.status === 'erro_cancelamento'
        ? describeFocusError(body)
        : 'A Focus ainda não confirmou o cancelamento — confira o status no painel da Focus antes de tentar de novo.',
    )
  }
}

export interface ConsultarServicoParams {
  ambiente: 'homologacao' | 'producao'
  ref: string
  mapping: EmitterMappingEntry
}

// Só consulta o status de uma emissão já feita (sem reenviar nada) — usado
// pra resincronizar um item que já foi autorizado de verdade na Focus mas o
// registro local ficou incompleto (ex: faltando url_danfse).
export async function consultarNfseReal(params: ConsultarServicoParams): Promise<EmitirNfseResult> {
  const { ambiente, ref, mapping } = params
  if (!mapping.emitterId) {
    throw new EmitirNfseError('Nenhum CNPJ emissor configurado para essa marca/serviço (ver Configurações).')
  }
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new EmitirNfseError('Sessão expirada — faça login de novo.')

  const { resp, body } = await callEmitFunction(accessToken, { action: 'consultar', emitterId: mapping.emitterId, ambiente, ref })
  if (!resp.ok) {
    const msg = body?.body?.mensagem ?? body?.message ?? body?.error ?? `Falha ao consultar NFS-e (HTTP ${resp.status}).`
    throw new EmitirNfseError(String(msg))
  }
  return body ?? { status: 'erro_consulta' }
}
