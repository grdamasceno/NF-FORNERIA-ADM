// "2026-09" -> "2026-09" (formato do <input type="month">) e "Setembro / 2026"
// (formato de exibição já usado no resto da tela de Faturamento).
export function currentMonthValue(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function formatCompetencia(monthValue: string): string {
  const [year, month] = monthValue.split('-').map(Number)
  if (!year || !month) return monthValue
  const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const [mes, ano] = label.split(' de ')
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} / ${ano}`
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

export function initials(unitName: string): string {
  return unitName
    .replace('Forneria ', '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const AVATAR_COLORS = ['#E94E1B', '#1B2A3C', '#1FA971', '#2D6BE3', '#E0A100', '#7A4DE0', '#E0413B', '#0F9C9C']

export function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
