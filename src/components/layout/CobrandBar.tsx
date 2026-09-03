import { BrandMarkIcon } from '@/components/icons'

// Barra de co-branding (whitelabel/multi-tenant). O logo do cliente troca
// por tenant — hoje fixo em "Forneria Original", ver seção 5.1 do MD.
export function CobrandBar() {
  return (
    <div className="animate-rise mb-4 flex items-center justify-between gap-4 rounded-2xl border border-line bg-card px-4 py-[11px] shadow-panel">
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-soft px-[9px] py-1 text-[11px] font-bold text-orange">
          <BrandMarkIcon className="h-[13px] w-[13px]" />
          Plataforma ALL IN ONE
        </span>
        <i className="text-[11.5px] not-italic text-faint">by OnChannel</i>
      </div>
      <div className="flex items-center gap-[11px]">
        <div className="text-right text-[10px] font-bold uppercase tracking-[.1em] text-faint">
          Personalizado para o cliente
        </div>
        <div className="flex items-center gap-[10px]">
          <div
            role="img"
            aria-label="Logo do cliente"
            className="h-[42px] w-[42px] flex-shrink-0 rounded-[11px] bg-navy shadow-[0_2px_8px_rgba(27,42,60,.14)]"
          />
          <b className="font-display text-[14px] font-extrabold text-navy">Forneria Original</b>
        </div>
      </div>
    </div>
  )
}
