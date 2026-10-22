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

const BRAND_TO_TENANT_NAME: Record<Brand, string> = {
  Forneria: 'Forneria Original',
  'The Duck': 'The Duck',
}

const UNIT_COLUMNS =
  'id, tenant_id, name, razao_social, cnpj, active, cidade, estado, uf, endereco, logradouro, numero, bairro, cep, codigo_municipio, telefone, email, horario, imagem, tenants(name)'

interface UnitRow {
  id: string
  tenant_id: string
  name: string
  razao_social: string | null
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
    razaoSocial: row.razao_social,
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
  const { data, error } = await supabase.from('units').select(UNIT_COLUMNS).order('name')
  if (error) throw error
  return ((data ?? []) as unknown as UnitRow[]).map(toLiveUnit)
}

export type UnitEditableFields = Pick<
  LiveUnit,
  | 'name'
  | 'razaoSocial'
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

// Cadastro de nova franquia (tela "+ Nova unidade" em Franquias). Marca já
// precisa existir como tenant (cadastro de marca nova fica pra depois — ver
// TODO.md) — resolve o `tenant_id` pelo nome do tenant correspondente.
export async function insertUnit(marca: Brand, patch: UnitEditableFields): Promise<LiveUnit> {
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .eq('name', BRAND_TO_TENANT_NAME[marca])
    .single()
  if (tenantError || !tenant) throw tenantError ?? new Error(`Marca "${marca}" não encontrada.`)

  const { data, error } = await supabase
    .from('units')
    .insert({
      tenant_id: tenant.id,
      name: patch.name,
      razao_social: patch.razaoSocial,
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
    .select(UNIT_COLUMNS)
    .single()
  if (error) throw error
  return toLiveUnit(data as unknown as UnitRow)
}

export async function updateUnit(id: string, patch: UnitEditableFields): Promise<void> {
  const { error } = await supabase
    .from('units')
    .update({
      name: patch.name,
      razao_social: patch.razaoSocial,
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

// Sem cascade em `invoices.unit_id` (de propósito) — se a unidade já tiver
// fatura/emissão vinculada, o banco recusa o delete em vez de apagar
// histórico fiscal junto. O erro sobe pra quem chamou tratar.
// Exclui a unidade junto com as faturas dela (invoices.unit_id não tem
// cascade, então o banco recusava o delete). Só libera se NENHUMA nota
// estiver autorizada: nota autorizada é registro fiscal real e apagar a
// fatura a deixaria órfã. Faturas só pendentes/falhas/canceladas podem sair
// (ex: unidade criada em duplicidade, cuja nota já foi cancelada).
export async function deleteUnit(id: string): Promise<void> {
  const { data: invoices, error: invErr } = await supabase.from('invoices').select('id').eq('unit_id', id)
  if (invErr) throw new Error(invErr.message)
  const invoiceIds = (invoices ?? []).map((i) => i.id as string)
  if (invoiceIds.length > 0) {
    const { count, error: itemErr } = await supabase
      .from('invoice_items')
      .select('id', { count: 'exact', head: true })
      .in('invoice_id', invoiceIds)
      .eq('nfse_status', 'autorizada')
    if (itemErr) throw new Error(itemErr.message)
    if ((count ?? 0) > 0) {
      throw new Error(
        'Essa unidade tem NFS-e autorizada — cancele a nota (Faturamento > Detalhes > Cancelar nota) antes de excluir a unidade.',
      )
    }
    const { error: delInvErr } = await supabase.from('invoices').delete().in('id', invoiceIds)
    if (delInvErr) throw new Error(delInvErr.message)
  }
  const { error } = await supabase.from('units').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
