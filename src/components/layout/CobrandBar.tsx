import { BrandMarkIcon } from '@/components/icons'
import { useSettings } from '@/context/SettingsContext'

// Barra de co-branding (whitelabel/multi-tenant). O logo do cliente troca
// por tenant — hoje fixo em "Forneria Original", ver seção 5.1 do MD. Logo em
// si já é real (nf_forneria.organizations.logo_url, editável em
// Configurações) — só o nome ao lado continua fixo.
export function CobrandBar() {
  const { organizationLogoUrl } = useSettings()

  return (
    <div className="animate-rise mb-4 flex items-center justify-between gap-4 rounded-2xl border border-line bg-card px-4 py-[11px] shadow-panel">
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-soft px-[9px] py-1 text-[11px] font-bold text-orange">
          <BrandMarkIcon className="h-[13px] w-[13px]" />
          Plataforma ALL IN ONE
        </span>
        <i className="text-[11.5px] not-italic text-faint">by OnChannel</i>
      </div>
      <div className="flex items-center gap-[10px]">
        {organizationLogoUrl ? (
          <img src={organizationLogoUrl} alt="Logo do cliente" className="h-[42px] w-[42px] flex-shrink-0 rounded-[11px] object-cover" />
        ) : (
          <div role="img" aria-label="Logo do cliente" className="h-[42px] w-[42px] flex-shrink-0 rounded-[11px] bg-navy" />
        )}
        <b className="font-display text-[14px] font-extrabold text-navy">Forneria Original</b>
      </div>
    </div>
  )
}
