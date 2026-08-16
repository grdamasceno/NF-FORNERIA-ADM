import type { ReactNode } from 'react'

type Trend = 'up' | 'down' | 'flat'

interface KpiCardProps {
  icon: ReactNode
  iconBg: string
  label: string
  value: string
  cents?: string
  trend?: Trend
  trendLabel?: string
  sub?: string
  delay?: number
}

const trendClasses: Record<Trend, string> = {
  up: 'text-green bg-green-soft',
  down: 'text-red bg-red-soft',
  flat: 'text-muted bg-[#eef1f4]',
}

export function KpiCard({ icon, iconBg, label, value, cents, trend, trendLabel, sub, delay = 0 }: KpiCardProps) {
  return (
    <div
      className="animate-rise relative overflow-hidden rounded-card border-l-4 border-orange bg-card p-[17px_18px] shadow-card"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="mb-[13px] flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num my-[5px] text-[26px] text-navy">
        {value}
        {cents && <span className="text-base font-bold text-faint">{cents}</span>}
      </div>
      {trend && trendLabel && (
        <span className={`inline-flex items-center gap-1 rounded-[7px] px-[7px] py-[2px] text-[11.5px] font-bold ${trendClasses[trend]}`}>
          {trendLabel}
        </span>
      )}
      {sub && <span className="ml-[7px] text-[11px] text-faint">{sub}</span>}
    </div>
  )
}
