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
    const msg = body?.body?.mensagem ?? body?.message ?? body?.error ?? `Falha ao emitir NFS-e (HTTP ${resp.status}).`
    throw new EmitirNfseError(String(msg))
  }

  // A Edge Function já espera ~10s pela autorização antes de devolver. Se
  // ainda não resolveu (achado real: a Focus às vezes demora mais que isso
  // em produção), continua consultando aqui em vez de desistir — nunca
  // marcar como sucesso sem o status literal "autorizado" (ver histórico:
  // isso já gravou nota como emitida sem ter sido autorizada de verdade).
  let final: FunctionBody | null = body
  for (let attempt = 0; attempt < 6 && final?.status === 'processando_autorizacao'; attempt++) {
    await sleep(3000)
    const { body: consultaBody } = await callEmitFunction(accessToken, {
      action: 'consultar',
      emitterId: mapping.emitterId,
      ambiente,
      ref,
    })
    final = consultaBody
  }

  if (final?.status !== 'autorizado') {
    throw new EmitirNfseError(describeFocusError(final))
  }
  return final
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
