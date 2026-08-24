import { NavLink } from 'react-router-dom'
import { ConfigIcon, FaturamentoIcon, FranquiasIcon, PainelIcon, RelatoriosIcon } from '@/components/icons'
import { activeFranchiseCount } from '@/data/units'
import logoOnChannel from '@/assets/logo-onchannel.jpeg'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-[11px] rounded-[11px] px-[11px] py-[10px] text-[13.5px] font-medium no-underline transition-colors',
    isActive ? 'bg-orange-soft text-orange font-semibold' : 'text-muted hover:bg-bg hover:text-navy',
  ].join(' ')

const iconClass = 'w-[18px] h-[18px] flex-shrink-0'

export function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen flex-col border-r border-line bg-card px-4 py-[22px]">
      <div className="flex items-center gap-[11px] px-2 pb-[22px] pt-1">
        <div className="h-[38px] w-[38px] flex-shrink-0 overflow-hidden rounded-[11px] bg-white shadow-[0_6px_14px_rgba(233,78,27,.22)]">
          <img src={logoOnChannel} alt="OnChannel" className="h-full w-full object-cover" />
        </div>
        <div>
          <b className="font-display text-[16px] font-extrabold leading-[1.05] tracking-[.01em] text-navy">
            OnChannel
          </b>
          <small className="mt-0.5 block text-[10.5px] font-semibold tracking-[.14em] text-faint">ALL IN ONE</small>
        </div>
      </div>

      <nav className="flex flex-col">
        <div className="mb-[7px] mt-[14px] px-[10px] text-[10.5px] font-bold tracking-[.13em] text-faint">
          OPERAÇÃO
        </div>
        <NavLink to="/" end className={navLinkClass}>
          <PainelIcon className={iconClass} /> Painel
        </NavLink>
        <NavLink to="/franquias" className={navLinkClass}>
          <FranquiasIcon className={iconClass} /> Franquias
          <span className="ml-auto rounded-[20px] bg-orange px-[7px] py-[1px] text-[10px] font-bold text-white">
            {activeFranchiseCount}
          </span>
        </NavLink>
        <NavLink to="/faturamento" className={navLinkClass}>
          <FaturamentoIcon className={iconClass} /> Faturamento
        </NavLink>

        <div className="mb-[7px] mt-[14px] px-[10px] text-[10.5px] font-bold tracking-[.13em] text-faint">
          GESTÃO
        </div>
        <NavLink to="/relatorios" className={navLinkClass}>
          <RelatoriosIcon className={iconClass} /> Relatórios
        </NavLink>
        <NavLink to="/configuracoes" className={navLinkClass}>
          <ConfigIcon className={iconClass} /> Configurações
        </NavLink>
      </nav>

      <div className="mt-auto flex items-center gap-[10px] rounded-[13px] border border-line p-[11px]">
        <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-navy font-display text-[13px] font-extrabold text-white">
          FO
        </div>
        <div>
          <b className="block text-[12.5px] leading-[1.2] text-navy">Forneria Original</b>
          <span className="text-[10.5px] text-faint">Rede · {activeFranchiseCount} unidades</span>
        </div>
      </div>
    </aside>
  )
}
