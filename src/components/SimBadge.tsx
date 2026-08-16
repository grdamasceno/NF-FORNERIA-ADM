// Selo visual para deixar claro que o dado ao lado é simulado/fictício,
// conforme exigido na seção 5.4 do MD ("aviso visual SIMULADO").
export function SimBadge({ label = 'SIMULADO' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[6px] border border-dashed border-faint px-[6px] py-[1px] text-[9.5px] font-bold uppercase tracking-[.08em] text-faint">
      {label}
    </span>
  )
}
