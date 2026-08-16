import type { Brand, FranchiseUnit } from '@/types'
import raw from './franquias.json'

// Dados reais e estáticos das franquias — ver src/data/franquias.json e o
// comentário em src/types/index.ts (`FranchiseUnit`) para a origem exata.
// Ponto único de acesso à lista de franquias até a tela ser ligada ao
// Supabase — trocar por uma query a `unidades` quando isso acontecer (ver
// TODO.md → "Inventário de dados fixos/fictícios").
export const franchiseUnits: FranchiseUnit[] = (raw as FranchiseUnit[])
  .slice()
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

export const activeFranchiseCount = franchiseUnits.filter((u) => u.ativo).length

export const franchiseBrands: Brand[] = Array.from(new Set(franchiseUnits.map((u) => u.marca))).sort((a, b) =>
  a.localeCompare(b, 'pt-BR'),
)

export const franchiseStates = Array.from(new Set(franchiseUnits.map((u) => u.estado).filter((e): e is string => !!e))).sort(
  (a, b) => a.localeCompare(b, 'pt-BR'),
)
