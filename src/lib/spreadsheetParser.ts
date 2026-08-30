import * as XLSX from 'xlsx'
import type { ImportWarning, ParsedSpreadsheetRow } from '@/types'

// Implementa o mapeamento planilha -> sistema descrito em
// MVP_Faturamento_Franquias.md (seção 3). Uma aba = uma rede/marca (tenant).
// O parser busca colunas pelo nome do cabeçalho, nunca pela posição fixa.

const HEADER_ALIASES = {
  unitName: ['nome da loja', 'loja', 'unidade', 'franquia'],
  callCenter: ['call center'],
  royalties: ['royalts', 'royalties'],
  marketing: ['marketing'],
} as const

function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .trim()
    .toLowerCase()
}

function toNumber(cell: unknown): number {
  if (cell === null || cell === undefined || cell === '') return 0
  const n = typeof cell === 'number' ? cell : Number(String(cell).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

export interface ParsedSheet {
  tenantName: string // nome da aba
  rows: ParsedSpreadsheetRow[]
  warnings: ImportWarning[]
}

export function parseSpreadsheet(file: ArrayBuffer): ParsedSheet[] {
  const workbook = XLSX.read(file, { type: 'array' })

  return workbook.SheetNames.map((sheetName) => parseSheet(sheetName, workbook.Sheets[sheetName]))
}

// A planilha real tem uma linha de título antes do cabeçalho de verdade
// ("Vendas Junho 26" / "Mês JUNHO 26") — por isso não dá pra assumir que a
// linha 0 já é o cabeçalho. Procura, nas primeiras linhas, a que tem pelo
// menos um dos nomes de coluna conhecidos.
function findHeaderRowIndex(raw: unknown[][]): number {
  const knownAliases = [...HEADER_ALIASES.callCenter, ...HEADER_ALIASES.royalties, ...HEADER_ALIASES.marketing, ...HEADER_ALIASES.unitName]
  for (let i = 0; i < Math.min(raw.length, 5); i++) {
    // `Array.from` em vez de `.map` de propósito: linhas de planilha vêm
    // como sparse arrays (buracos nas células vazias), e `.findIndex` visita
    // buracos diferente de `.map`/`.some` — `Array.from` densifica antes de
    // qualquer comparação, evitando erro ao chamar `.includes` num `undefined`.
    const headers = Array.from(raw[i], normalizeHeader)
    if (headers.some((h) => knownAliases.some((a) => h.includes(a)))) return i
  }
  return 0
}

function parseSheet(sheetName: string, sheet: XLSX.WorkSheet): ParsedSheet {
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })
  const warnings: ImportWarning[] = []

  if (raw.length === 0) {
    return { tenantName: sheetName, rows: [], warnings }
  }

  const headerRowIndex = findHeaderRowIndex(raw)
  const headerRow = raw[headerRowIndex]
  const dataRows = raw.slice(headerRowIndex + 1)
  const headers = Array.from(headerRow, normalizeHeader) // ver comentário em findHeaderRowIndex

  const findCol = (aliases: readonly string[]) => headers.findIndex((h) => aliases.some((a) => h.includes(a)))

  // Nem toda aba rotula a coluna do nome da unidade (a planilha "Forneria"
  // deixa essa coluna sem cabeçalho) — quando não acha por nome, cai pra
  // coluna 0 (seção 3 do MD). Quando acha (ex: "Nome da loja" na aba "The
  // Duck", que não é a coluna 0), usa a que encontrou.
  const foundUnitNameCol = findCol(HEADER_ALIASES.unitName)
  const colUnitName = foundUnitNameCol === -1 ? 0 : foundUnitNameCol
  const colCallCenter = findCol(HEADER_ALIASES.callCenter)
  const colRoyalties = findCol(HEADER_ALIASES.royalties)
  const colMarketing = findCol(HEADER_ALIASES.marketing)

  const rows: ParsedSpreadsheetRow[] = []

  dataRows.forEach((row, idx) => {
    const rowIndex = headerRowIndex + idx + 2 // +1 pro cabeçalho, +1 pra virar 1-based
    const rawUnitName = String(row[colUnitName] ?? '').trim()

    const isEmptyRow = row.every((c) => c === undefined || c === null || String(c).trim() === '')
    if (isEmptyRow) return

    // Linha de totais: sem nome de unidade válido, ou última linha só com números.
    const looksLikeTotalsRow = !rawUnitName || /total/i.test(rawUnitName)
    if (looksLikeTotalsRow) {
      if (idx !== dataRows.length - 1) {
        warnings.push({
          rowIndex,
          unitName: rawUnitName || null,
          message: 'Linha sem nome de unidade reconhecível, ignorada (possível linha de totais).',
        })
      }
      return
    }

    const callCenterValue = toNumber(row[colCallCenter])
    const royaltiesValue = toNumber(row[colRoyalties])
    const marketingValue = toNumber(row[colMarketing])
    const totalValue = callCenterValue + royaltiesValue + marketingValue

    if ([callCenterValue, royaltiesValue, marketingValue].some((v) => v < 0)) {
      warnings.push({ rowIndex, unitName: rawUnitName, message: 'Valor negativo encontrado na linha.' })
    }

    rows.push({
      unitName: toTitleCase(rawUnitName),
      callCenterValue,
      royaltiesValue,
      marketingValue,
      totalValue,
      hasNoCharge: totalValue === 0,
    })
  })

  return { tenantName: sheetName, rows, warnings }
}

// TODO: INTEGRAÇÃO FUTURA — quando o preenchimento manual (CRUD) existir,
// este parser deixa de ser o único ponto de entrada de `invoices`; o service
// layer que consome `ParsedSpreadsheetRow` deve funcionar igualmente para
// linhas vindas de um formulário.
