import '@/lib/chartSetup'
import { Bar } from 'react-chartjs-2'
import { formatBRL } from '@/lib/format'

interface RevenueBarChartProps {
  labels: string[]
  issued: number[]
  received: number[]
}

export function RevenueBarChart({ labels, issued, received }: RevenueBarChartProps) {
  return (
    <div className="animate-rise rounded-card border border-line bg-card p-[18px_20px] shadow-panel" style={{ animationDelay: '.18s' }}>
      <div className="mb-1.5 flex items-center justify-between">
        <div>
          <h3 className="text-[14.5px] font-bold text-navy">Faturamento por mês</h3>
          <div className="text-[11.5px] text-faint">Emitido × recebido · 2026</div>
        </div>
        <div className="flex items-center gap-3.5">
          <span className="flex items-center gap-[5px] text-[11px] font-semibold text-muted">
            <i className="inline-block h-[9px] w-[9px] rounded-[3px] bg-orange" />
            Emitido
          </span>
          <span className="flex items-center gap-[5px] text-[11px] font-semibold text-muted">
            <i className="inline-block h-[9px] w-[9px] rounded-[3px] bg-navy" />
            Recebido
          </span>
        </div>
      </div>
      <div className="relative mt-2 h-[248px]">
        <Bar
          data={{
            labels,
            datasets: [
              { label: 'Emitido', data: issued, backgroundColor: '#E94E1B', borderRadius: 6, barPercentage: 0.62, categoryPercentage: 0.66 },
              { label: 'Recebido', data: received, backgroundColor: '#1B2A3C', borderRadius: 6, barPercentage: 0.62, categoryPercentage: 0.66 },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatBRL(Number(c.raw))}` } },
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#9aa6b4', font: { family: 'Inter', size: 11, weight: 600 } } },
              y: {
                border: { display: false },
                grid: { color: '#EEF1F4' },
                ticks: { color: '#9aa6b4', font: { family: 'Inter', size: 10 }, callback: (v) => `R$${Number(v) / 1000}k` },
              },
            },
          }}
        />
      </div>
    </div>
  )
}
