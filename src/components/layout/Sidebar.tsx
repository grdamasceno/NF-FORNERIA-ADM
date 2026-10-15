import { NavLink } from 'react-router-dom'
import { ConfigIcon, FaturamentoIcon, FranquiasIcon, PainelIcon, RelatoriosIcon } from '@/components/icons'
import { activeFranchiseCount } from '@/data/units'
import { useAuth } from '@/context/AuthContext'
import logoOnChannel from '@/assets/logo-onchannel.jpeg'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

const navLinkClass = (collapsed: boolean) =>
  ({ isActive }: { isActive: boolean }) =>
    [
      'flex items-center gap-[11px] rounded-[11px] px-[11px] py-[10px] text-[13.5px] font-medium no-underline transition-colors',
      collapsed ? 'justify-center' : '',
      isActive ? 'bg-orange-soft text-orange font-semibold' : 'text-muted hover:bg-bg hover:text-navy',
    ].join(' ')

const iconClass = 'w-[18px] h-[18px] flex-shrink-0'

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const { session, profile, signOut } = useAuth()
  const linkClass = navLinkClass(collapsed)

  return (
    <aside className={`sticky top-0 flex h-screen w-full flex-col border-r border-line bg-card py-[22px] ${collapsed ? 'px-[7px]' : 'px-4'}`}>
      <div className={`flex items-center gap-[11px] pb-[22px] pt-1 ${collapsed ? 'flex-col px-0' : 'px-2'}`}>
        <div className="h-[38px] w-[38px] flex-shrink-0 overflow-hidden rounded-full border border-faint bg-white">
          <img src={logoOnChannel} alt="OnChannel" className="h-full w-full object-cover" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <b className="font-display text-[16px] font-extrabold leading-[1.05] tracking-[.01em] text-navy">OnChannel</b>
            <small className="mt-0.5 block text-[10.5px] font-semibold tracking-[.14em] text-faint">ALL IN ONE</small>
          </div>
        )}
        <button
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-[7px] border border-line text-faint hover:bg-bg hover:text-navy"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
          </svg>
        </button>
      </div>

      <nav className="flex flex-col">
        {!collapsed && (
          <div className="mb-[7px] mt-[14px] px-[10px] text-[10.5px] font-bold tracking-[.13em] text-faint">OPERAÇÃO</div>
        )}
        <NavLink to="/" end className={linkClass} title={collapsed ? 'Painel' : undefined}>
          <PainelIcon className={iconClass} /> {!collapsed && 'Painel'}
        </NavLink>
        <NavLink to="/franquias" className={linkClass} title={collapsed ? `Franquias (${activeFranchiseCount})` : undefined}>
          <FranquiasIcon className={iconClass} />
          {!collapsed && (
            <>
              Franquias
              <span className="ml-auto rounded-[20px] bg-orange px-[7px] py-[1px] text-[10px] font-bold text-white">
                {activeFranchiseCount}
              </span>
            </>
          )}
        </NavLink>
        <NavLink to="/faturamento" className={linkClass} title={collapsed ? 'Faturamento' : undefined}>
          <FaturamentoIcon className={iconClass} /> {!collapsed && 'Faturamento'}
        </NavLink>

        {!collapsed && (
          <div className="mb-[7px] mt-[14px] px-[10px] text-[10.5px] font-bold tracking-[.13em] text-faint">GESTÃO</div>
        )}
        <NavLink to="/relatorios" className={linkClass} title={collapsed ? 'Relatórios' : undefined}>
          <RelatoriosIcon className={iconClass} /> {!collapsed && 'Relatórios'}
        </NavLink>
        <NavLink to="/configuracoes" className={linkClass} title={collapsed ? 'Configurações' : undefined}>
          <ConfigIcon className={iconClass} /> {!collapsed && 'Configurações'}
        </NavLink>
      </nav>

      <div
        className={`mt-auto flex items-center gap-[10px] rounded-[13px] border border-line p-[11px] ${collapsed ? 'flex-col' : ''}`}
      >
        <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-navy font-display text-[13px] font-extrabold text-white">
          FO
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[12.5px] leading-[1.2] text-navy" title={session?.user.email}>
              {session?.user.email ?? 'Forneria Original'}
            </b>
            <span className="text-[10.5px] text-faint">
              {profile?.role === 'superadmin' ? 'Superadmin' : 'Admin'} · {activeFranchiseCount} unidades
            </span>
          </div>
        )}
        <button
          onClick={() => signOut()}
          title="Sair"
          className="flex-shrink-0 rounded-[8px] border border-line px-2 py-1 text-[10.5px] font-bold text-muted hover:bg-bg hover:text-navy"
        >
          {collapsed ? '⏻' : 'Sair'}
        </button>
      </div>
    </aside>
  )
}
