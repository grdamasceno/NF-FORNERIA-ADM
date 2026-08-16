// DADOS 100% FICTÍCIOS — histórico de importação de planilha para preencher
// a tela de Faturamento (seções 5.2/5.3 do MD) antes de existir upload real.
// Ao conectar o banco: trocar por query em `billing_periods` (seção 4 do MD).

export interface ImportHistoryEntry {
  id: string
  competencia: string
  arquivo: string
  importadoEm: string
  importadoPor: string
  unidadesReconhecidas: number
  alertas: number
  status: 'confirmada' | 'processando'
}

export const importHistory: ImportHistoryEntry[] = [
  {
    id: 'mock-import-2026-06',
    competencia: 'Junho / 2026',
    arquivo: 'Banco_Junho_2026_Emissao_de_boletos.xlsx',
    importadoEm: '01/06/2026 09:12',
    importadoPor: 'Diretor Financeiro',
    unidadesReconhecidas: 10,
    alertas: 1,
    status: 'confirmada',
  },
  {
    id: 'mock-import-2026-05',
    competencia: 'Maio / 2026',
    arquivo: 'Banco_Maio_2026_Emissao_de_boletos.xlsx',
    importadoEm: '01/05/2026 08:47',
    importadoPor: 'Diretor Financeiro',
    unidadesReconhecidas: 10,
    alertas: 0,
    status: 'confirmada',
  },
  {
    id: 'mock-import-2026-04',
    competencia: 'Abril / 2026',
    arquivo: 'Banco_Abril_2026_Emissao_de_boletos.xlsx',
    importadoEm: '01/04/2026 09:03',
    importadoPor: 'Diretor Financeiro',
    unidadesReconhecidas: 9,
    alertas: 2,
    status: 'confirmada',
  },
]

export const lastImportWarnings = [
  'Forneria São Gonçalo: NFS-e simulada falhou — dados fiscais incompletos na planilha.',
]
