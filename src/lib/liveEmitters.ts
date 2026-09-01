import { supabase } from '@/lib/supabase'
import type { Brand, ServiceType } from '@/types'

// Leitura/escrita de verdade em `nf_forneria.emitters`/`emitter_mapping` —
// usado pela tela de Configurações ("CNPJs emissores" e "Emissão por marca e
// serviço"). RLS (migration 0007) já filtra por organização sozinho, igual
// `lib/liveUnits.ts`.

export type EligibleServiceType = Exclude<ServiceType, 'consolidado'>

const TENANT_NAME_TO_BRAND: Record<string, Brand> = {
  'Forneria Original': 'Forneria',
  'The Duck': 'The Duck',
}

// Campos fiscais (inscrição municipal, código do município, Simples
// Nacional) são exigidos pela Focus NFe pra emitir de verdade, mas nascem
// vazios/`false` — o cliente completa depois pela própria tela, sem precisar
// de SQL direto (ver TODO.md → integração Focus NFe).
export interface LiveEmitter {
  id: string
  razaoSocial: string
  cnpj: string
  inscricaoMunicipal: string | null
  codigoMunicipio: string | null
  optanteSimplesNacional: boolean
}

// Um emissor pode não ter, ainda, item da lista de serviço/retenção de ISS
// definidos (dependem do contador — ver TODO.md), por isso os dois campos
// vêm nulos/false até serem preenchidos na tela.
export interface EmitterMappingEntry {
  emitterId: string | null
  itemListaServico: string | null
  issRetido: boolean
}

export function emitterKey(marca: Brand, service: EligibleServiceType): string {
  return `${marca}:${service}`
}

const EMITTER_COLUMNS = 'id, razao_social, cnpj, inscricao_municipal, codigo_municipio, optante_simples_nacional'

interface EmitterRow {
  id: string
  razao_social: string
  cnpj: string
  inscricao_municipal: string | null
  codigo_municipio: string | null
  optante_simples_nacional: boolean
}

function toLiveEmitter(row: EmitterRow): LiveEmitter {
  return {
    id: row.id,
    razaoSocial: row.razao_social,
    cnpj: row.cnpj,
    inscricaoMunicipal: row.inscricao_municipal,
    codigoMunicipio: row.codigo_municipio,
    optanteSimplesNacional: row.optante_simples_nacional,
  }
}

export async function fetchEmitters(): Promise<LiveEmitter[]> {
  const { data, error } = await supabase.from('emitters').select(EMITTER_COLUMNS).order('razao_social')
  if (error) throw error
  return ((data ?? []) as EmitterRow[]).map(toLiveEmitter)
}

// `emitters.organization_id` é `not null` (migration 0007) — precisa vir
// explícito no insert, RLS sozinha não preenche coluna nenhuma.
export async function addEmitter(razaoSocial: string, cnpj: string, organizationId: string): Promise<LiveEmitter> {
  const { data, error } = await supabase
    .from('emitters')
    .insert({ razao_social: razaoSocial, cnpj, organization_id: organizationId })
    .select(EMITTER_COLUMNS)
    .single()
  if (error) throw error
  return toLiveEmitter(data as EmitterRow)
}

export async function removeEmitter(id: string): Promise<void> {
  const { error } = await supabase.from('emitters').delete().eq('id', id)
  if (error) throw error
}

// Campos fiscais que a Focus NFe exige pra emitir — completados pelo cliente
// direto na tela, sem precisar de SQL (ver TODO.md → integração Focus NFe).
export async function updateEmitterFiscalData(
  id: string,
  patch: Partial<Pick<LiveEmitter, 'inscricaoMunicipal' | 'codigoMunicipio' | 'optanteSimplesNacional'>>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {}
  if ('inscricaoMunicipal' in patch) dbPatch.inscricao_municipal = patch.inscricaoMunicipal
  if ('codigoMunicipio' in patch) dbPatch.codigo_municipio = patch.codigoMunicipio
  if ('optanteSimplesNacional' in patch) dbPatch.optante_simples_nacional = patch.optanteSimplesNacional
  const { error } = await supabase.from('emitters').update(dbPatch).eq('id', id)
  if (error) throw error
}

interface MappingRow {
  tenant_id: string
  service_type: EligibleServiceType
  emitter_id: string | null
  item_lista_servico: string | null
  iss_retido: boolean
  tenants: { name: string } | { name: string }[] | null
}

export interface EmitterMappingResult {
  mapping: Record<string, EmitterMappingEntry>
  tenantIdByBrand: Partial<Record<Brand, string>>
}

export async function fetchEmitterMapping(): Promise<EmitterMappingResult> {
  const { data, error } = await supabase
    .from('emitter_mapping')
    .select('tenant_id, service_type, emitter_id, item_lista_servico, iss_retido, tenants(name)')
  if (error) throw error

  const mapping: Record<string, EmitterMappingEntry> = {}
  const tenantIdByBrand: Partial<Record<Brand, string>> = {}

  for (const row of (data ?? []) as unknown as MappingRow[]) {
    const tenantName = Array.isArray(row.tenants) ? row.tenants[0]?.name : row.tenants?.name
    const brand = tenantName ? TENANT_NAME_TO_BRAND[tenantName] : undefined
    if (!brand) continue
    tenantIdByBrand[brand] = row.tenant_id
    mapping[emitterKey(brand, row.service_type)] = {
      emitterId: row.emitter_id,
      itemListaServico: row.item_lista_servico,
      issRetido: row.iss_retido,
    }
  }

  return { mapping, tenantIdByBrand }
}

// `emitter_mapping` tem `unique (tenant_id, service_type)` — upsert com só as
// colunas informadas deixa as outras intactas (item_lista_servico/iss_retido
// não são sobrescritas ao só trocar o emissor, e vice-versa).
export async function upsertEmitterMapping(params: {
  tenantId: string
  service: EligibleServiceType
  emitterId?: string | null
  itemListaServico?: string | null
  issRetido?: boolean
}): Promise<void> {
  const { tenantId, service, ...rest } = params
  const patch: Record<string, unknown> = { tenant_id: tenantId, service_type: service }
  if ('emitterId' in rest) patch.emitter_id = rest.emitterId
  if ('itemListaServico' in rest) patch.item_lista_servico = rest.itemListaServico
  if ('issRetido' in rest) patch.iss_retido = rest.issRetido

  const { error } = await supabase.from('emitter_mapping').upsert(patch, { onConflict: 'tenant_id,service_type' })
  if (error) throw error
}
