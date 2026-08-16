import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: ReactNode // ações do topbar (botões, seletor de competência etc.)
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="animate-rise mb-[22px] flex flex-wrap items-center gap-4">
      <div>
        <h1 className="text-[21px] font-extrabold text-navy">{title}</h1>
        {subtitle && <p className="mt-[3px] text-[12.5px] text-muted">{subtitle}</p>}
      </div>
      <div className="flex-1" />
      {children}
    </div>
  )
}
