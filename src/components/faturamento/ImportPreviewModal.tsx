import { formatBRL } from '@/lib/format'
import type { ParsedSheet } from '@/lib/spreadsheetParser'

interface ImportPreviewModalProps {
  fileName: string
  sheets: ParsedSheet[]
  onCancel: () => void
  onConfirm: () => void
}

// Preview antes de confirmar a importação (seção 5.2 do MD): mostra o que o
// parser reconheceu por aba/marca, alertas, e as unidades "sem cobrança no
// mês" (que ficam listadas aqui mas não viram fatura — seção 3 do MD).
export function ImportPreviewModal({ fileName, sheets, onCancel, onConfirm }: ImportPreviewModalProps) {
  const totalRows = sheets.reduce((sum, s) => sum + s.rows.length, 0)
  const totalWarnings = sheets.reduce((sum, s) => sum + s.warnings.length, 0)
  const totalNoCharge = sheets.reduce((sum, s) => sum + s.rows.filter((r) => r.hasNoCharge).length, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="max-h-[90vh] w-full max-w-[760px] overflow-y-auto rounded-card bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-bold text-navy">Confirmar importação</h3>
        <p className="mt-1 text-[12.5px] text-muted">{fileName}</p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="Unidades reconhecidas" value={String(totalRows)} />
          <Stat label="Sem cobrança no mês" value={String(totalNoCharge)} />
          <Stat label="Alertas" value={String(totalWarnings)} tone={totalWarnings > 0 ? 'amber' : undefined} />
        </div>

        {sheets.map((sheet) => (
          <div key={sheet.tenantName} className="mt-5">
            <h4 className="mb-2 text-[13px] font-bold text-navy">
              {sheet.tenantName} · {sheet.rows.length} unidade{sheet.rows.length === 1 ? '' : 's'}
            </h4>

            {sheet.warnings.length > 0 && (
              <div className="mb-2 flex flex-col gap-1 rounded-[9px] bg-amber-soft p-3">
                {sheet.warnings.map((w, i) => (
                  <span key={i} className="text-[11.5px] font-medium text-amber">
                    ⚠ Linha {w.rowIndex}{w.unitName ? ` (${w.unitName})` : ''}: {w.message}
                  </span>
                ))}
              </div>
            )}

            <div className="overflow-hidden rounded-[9px] border border-line">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Unidade', 'Call Center', 'Royalties', 'Marketing', 'Total'].map((h, i) => (
                      <th
                        key={h}
                        className={`bg-[#fafbfc] px-3 py-[8px] text-left text-[10px] font-bold uppercase tracking-[.05em] text-faint ${i > 0 ? 'text-right' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((r, i) => (
                    <tr key={i} className={`border-t border-line ${r.hasNoCharge ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-[7px] text-[12px] font-semibold text-navy">
                        {r.unitName}
                        {r.hasNoCharge && <span className="ml-1.5 font-normal text-faint">(sem cobrança)</span>}
                      </td>
                      <td className="px-3 py-[7px] text-right text-[11.5px] text-muted">{formatBRL(r.callCenterValue)}</td>
                      <td className="px-3 py-[7px] text-right text-[11.5px] text-muted">{formatBRL(r.royaltiesValue)}</td>
                      <td className="px-3 py-[7px] text-right text-[11.5px] text-muted">{formatBRL(r.marketingValue)}</td>
                      <td className="px-3 py-[7px] text-right text-[12px] font-bold text-navy">{formatBRL(r.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-[9px] border border-line px-4 py-[9px] text-[12.5px] font-bold text-navy">
            Cancelar
          </button>
          <button onClick={onConfirm} className="rounded-[9px] bg-orange px-4 py-[9px] text-[12.5px] font-bold text-white">
            Confirmar importação ({totalRows - totalNoCharge} unidades entram na fila)
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'amber' }) {
  return (
    <div className="rounded-[9px] border border-line p-3">
      <div className="text-[10px] font-bold uppercase tracking-[.05em] text-faint">{label}</div>
      <div className={`num mt-1 text-[18px] ${tone === 'amber' ? 'text-amber' : 'text-navy'}`}>{value}</div>
    </div>
  )
}
