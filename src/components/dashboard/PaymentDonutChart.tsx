import '@/lib/chartSetup'
import { Doughnut } from 'react-chartjs-2'

interface PaymentDonutChartProps {
  paid: number
  dueSoon: number
  overdue: number
}

export function PaymentDonutChart({ paid, dueSoon, overdue }: PaymentDonutChartProps) {
  const total = paid + dueSoon + overdue

  return (
    <div className="animate-rise rounded-card bg-card p-[18px_20px] shadow-card" style={{ animationDelay: '.22s' }}>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-[14.5px] font-bold text-navy">Status de pagamento</h3>
        <span className="text-[11.5px] text-faint">{total} cobranças</span>
      </div>
      <div className="relative my-1.5 h-[200px]">
        <Doughnut
          data={{
            labels: ['Pagas', 'A vencer', 'Em atraso'],
            datasets: [{ data: [paid, dueSoon, overdue], backgroundColor: ['#1FA971', '#E0A100', '#E0413B'], borderWidth: 0, spacing: 2 }],
          }}
          options={{
            cutout: '72%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c) => `${c.label}: ${c.raw} unidades` } },
            },
          }}
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className="font-display text-[30px] font-extrabold leading-none text-navy">
            {paid}
            <span className="text-lg text-faint">/{total}</span>
          </b>
          <small className="mt-[3px] text-[11px] font-semibold text-muted">pagas</small>
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-[9px]">
        <LegendRow color="#1FA971" label="Pagas" value={paid} />
        <LegendRow color="#E0A100" label="A vencer" value={dueSoon} />
        <LegendRow color="#E0413B" label="Em atraso" value={overdue} />
      </div>
    </div>
  )
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center text-[12.5px] font-semibold text-navy">
      <span className="flex items-center gap-2 text-muted">
        <i className="inline-block h-[9px] w-[9px] rounded-[3px]" style={{ background: color }} />
        {label}
      </span>
      <span className="ml-auto font-bold">{value}</span>
    </div>
  )
}
