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

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/emit-nfse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
    }),
  })
  const body = (await resp.json().catch(() => null)) as (EmitirNfseResult & { error?: string; message?: string; body?: { mensagem?: string; erros?: unknown } }) | null

  if (!resp.ok) {
    const msg = body?.body?.mensagem ?? body?.message ?? body?.error ?? `Falha ao emitir NFS-e (HTTP ${resp.status}).`
    throw new EmitirNfseError(String(msg))
  }
  if (body?.status === 'erro_autorizacao' || body?.status === 'erro') {
    throw new EmitirNfseError(body?.mensagem ?? 'Focus NFe rejeitou a emissão — ver detalhes no painel da Focus.')
  }
  return body ?? { status: 'processando_autorizacao' }
}
