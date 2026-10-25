import { chart } from '@/shared/charts/colors'

// WINDFOR's run times in January 2026 (UTC, which is UK time in winter).
const RUNS = [2.5, 4.5, 7.5, 9.5, 11.5, 15.5, 18.5, 22.5]
const GATE = 9 + 20 / 60
const DAY_STARTS = 23 // the delivery day starts at 23:00 the evening before

/**
 * The selection rule as a picture: runs published on D-1, the gate, and the delivery
 * day they are bought for. Drawn in a fixed 48-hour frame (D-1 00:00 to D 24:00).
 */
export function RuleDiagram() {
  const width = 960
  const x = (hours: number) => 24 + (hours / 48) * (width - 48)
  const used = Math.max(...RUNS.filter((r) => r < GATE))
  const label = (hours: number) => {
    const h = Math.floor(hours) % 24
    const m = Math.round((hours % 1) * 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  return (
    <svg
      viewBox={`0 0 ${width} 170`}
      width="100%"
      role="img"
      aria-label="Timeline: eight forecast runs are published on the day before delivery; the last one before the 09:20 gate, the 07:30 run, is the one used for the bid, and the 09:30 run arrives ten minutes too late; the delivery day runs from 23:00 that evening to 23:00 the next day"
      style={{ display: 'block' }}
    >
      <rect
        x={x(DAY_STARTS)}
        y={92}
        width={x(DAY_STARTS + 24) - x(DAY_STARTS)}
        height={30}
        rx={6}
        fill={chart.band}
      />
      <text x={x(DAY_STARTS) + 10} y={112} fill="var(--gray-12)" fontSize={13} fontWeight={600}>
        Delivery day D: 23:00 to 23:00, the hours you are buying
      </text>
      <line x1={x(0)} x2={x(48)} y1={132} y2={132} stroke={chart.axis} />
      {[0, 12, 24, 36, 48].map((h) => (
        <text key={h} x={x(h)} y={150} textAnchor="middle" fill="var(--gray-11)" fontSize={12}>
          {h === 0 || h === 24 || h === 48 ? '00:00' : '12:00'}
        </text>
      ))}
      <text x={x(0)} y={166} fill="var(--gray-11)" fontSize={12}>
        Day before (D−1): forecasts arrive, you bid
      </text>
      <line
        x1={x(GATE)}
        x2={x(GATE)}
        y1={14}
        y2={132}
        stroke="var(--gray-12)"
        strokeWidth={2}
        strokeDasharray="4 3"
      />
      <text x={x(GATE) + 6} y={22} fill="var(--gray-12)" fontSize={12} fontWeight={600}>
        09:20 gate closes
      </text>
      {RUNS.map((run) => {
        const state = run === used ? 'used' : run < GATE ? 'earlier' : 'after'
        return (
          <g key={run} transform={`translate(${x(run)},58)`}>
            <circle
              r={state === 'used' ? 7 : 5}
              fill={
                state === 'used'
                  ? chart.series1
                  : state === 'after'
                    ? chart.series2
                    : 'var(--gray-9)'
              }
              stroke={chart.surface}
              strokeWidth={2}
            />
            {/* The halo keeps the gate line from cutting through a label next to it. */}
            <text
              y={-14}
              textAnchor="middle"
              fill="var(--gray-11)"
              fontSize={11}
              stroke={chart.surface}
              strokeWidth={4}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {label(run)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
