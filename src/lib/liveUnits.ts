import { supabase } from '@/lib/supabase'
import type { Brand, LiveUnit } from '@/types'

// Leitura/escrita de verdade em `nf_forneria.units` — usado só pela tela de
// Franquias. RLS (migration 0007) já filtra por organização sozinho: um
// `select` sem filtro nenhum aqui só volta as unidades da organização do
// usuário logado (ou todas, se ele for superadmin) — não precisa repetir
// esse filtro no código.

const TENANT_NAME_TO_BRAND: Record<string, Brand> = {
  'Forneria Original': 'Forneria',
  'The Duck': 'The Duck',
}

interface UnitRow {
  id: string
  tenant_id: string
  name: string
  cnpj: string | null
  active: boolean
  cidade: string | null
  estado: string | null
  uf: string | null
  endereco: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cep: string | null
  codigo_municipio: string | null
  telefone: string | null
  email: string | null
  horario: string | null
  imagem: string | null
  tenants: { name: string } | { name: string }[] | null
}

function toLiveUnit(row: UnitRow): LiveUnit {
  const tenantName = Array.isArray(row.tenants) ? row.tenants[0]?.name : row.tenants?.name
  return {
    id: row.id,
    tenantId: row.tenant_id,
    marca: TENANT_NAME_TO_BRAND[tenantName ?? ''] ?? 'Forneria',
    name: row.name,
    cnpj: row.cnpj,
    active: row.active,
    cidade: row.cidade,
    estado: row.estado,
    uf: row.uf,
    endereco: row.endereco,
    logradouro: row.logradouro,
    numero: row.numero,
    bairro: row.bairro,
    cep: row.cep,
    codigoMunicipio: row.codigo_municipio,
    telefone: row.telefone,
    email: row.email,
    horario: row.horario,
    imagem: row.imagem,
  }
}

export async function fetchUnits(): Promise<LiveUnit[]> {
  const { data, error } = await supabase
    .from('units')
    .select(
      'id, tenant_id, name, cnpj, active, cidade, estado, uf, endereco, logradouro, numero, bairro, cep, codigo_municipio, telefone, email, horario, imagem, tenants(name)',
    )
    .order('name')
  if (error) throw error
  return ((data ?? []) as unknown as UnitRow[]).map(toLiveUnit)
}

export type UnitEditableFields = Pick<
  LiveUnit,
  | 'name'
  | 'cnpj'
  | 'active'
  | 'cidade'
  | 'estado'
  | 'uf'
  | 'endereco'
  | 'logradouro'
  | 'numero'
  | 'bairro'
  | 'cep'
  | 'codigoMunicipio'
  | 'telefone'
  | 'email'
  | 'horario'
>

export async function updateUnit(id: string, patch: UnitEditableFields): Promise<void> {
  const { error } = await supabase
    .from('units')
    .update({
      name: patch.name,
      cnpj: patch.cnpj,
      active: patch.active,
      cidade: patch.cidade,
      estado: patch.estado,
      uf: patch.uf,
      endereco: patch.endereco,
      logradouro: patch.logradouro,
      numero: patch.numero,
      bairro: patch.bairro,
      cep: patch.cep,
      codigo_municipio: patch.codigoMunicipio,
      telefone: patch.telefone,
      email: patch.email,
      horario: patch.horario,
    })
    .eq('id', id)
  if (error) throw error
}
