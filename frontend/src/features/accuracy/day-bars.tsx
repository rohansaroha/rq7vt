import { Text } from '@radix-ui/themes'
import { Link } from '@tanstack/react-router'
import { scaleBand, scaleLinear } from 'd3-scale'
import { useState } from 'react'

import type { Schema } from '@/shared/api/client'
import { ChartTooltip, TooltipRow } from '@/shared/charts/chart-tooltip'
import { chart } from '@/shared/charts/colors'
import { column } from '@/shared/charts/marks'
import { useElementWidth } from '@/shared/charts/use-element-width'
import { formatDay, formatGwTick, formatMw, formatShortDay, formatSignedMw } from '@/shared/format'

import type { Forecast } from './queries'
import { dayMae, worstDay } from './takeaways'

type DayRow = Schema<'DayRow'>

const HEIGHT = 220
const MARGIN = { top: 22, right: 8, bottom: 26, left: 48 }

/** The typical miss on each delivery day at the gate. Click a day to open it. */
export function DayBars({
  days,
  forecast,
  onOpen,
}: {
  days: DayRow[]
  forecast: Forecast
  onOpen: (day: string) => void
}) {
  const [frameRef, width] = useElementWidth<HTMLDivElement>()
  const [hovered, setHovered] = useState<DayRow | null>(null)
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const x = scaleBand<string>()
    .domain(days.map((d) => d.day))
    .range([0, innerWidth])
    .paddingInner(0.18)
  const top = Math.max(500, ...days.map((d) => Math.max(d.mae_mw ?? 0, d.corrected_mae_mw ?? 0)))
  const y = scaleLinear().domain([0, top]).nice(4).range([innerHeight, 0])
  const color = forecast === 'corrected' ? chart.corrected : chart.series1
  const worst = worstDay(days, forecast)
  const step = innerWidth < 520 ? 14 : 7

  return (
    <div ref={frameRef} className="chart-frame">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Bar chart of the typical miss on each delivery day${worst ? `; the hardest was ${formatDay(worst.day)}` : ''}`}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {y.ticks(4).map((tick) => (
            <g key={tick} transform={`translate(0,${y(tick)})`}>
              <line x2={innerWidth} stroke={chart.grid} />
              <text x={-8} dy="0.32em" textAnchor="end">
                {formatGwTick(tick)}
              </text>
            </g>
          ))}
          {days.map((row, i) => {
            const value = dayMae(row, forecast)
            const left = x(row.day) ?? 0
            const w = x.bandwidth()
            const h = value == null ? 0 : innerHeight - y(value)
            return (
              <g key={row.day}>
                {h > 0 ? (
                  <path
                    d={column(left, innerHeight - h, w, h)}
                    fill={color}
                    opacity={hovered && hovered !== row ? 0.55 : 1}
                  />
                ) : null}
                {row === worst && value != null ? (
                  <text
                    x={left + w / 2}
                    y={innerHeight - h - 6}
                    textAnchor={i > days.length - 4 ? 'end' : 'middle'}
                    style={{ fontWeight: 600 }}
                  >
                    {formatShortDay(row.day)}
                  </text>
                ) : null}
                {i % step === 0 ? (
                  <text x={left + w / 2} y={innerHeight + 16} textAnchor="middle">
                    {formatShortDay(row.day)}
                  </text>
                ) : null}
                <rect
                  className="day-bar"
                  x={left - 1}
                  width={w + 2}
                  height={innerHeight}
                  fill="transparent"
                  onPointerEnter={() => setHovered(row)}
                  onPointerLeave={() => setHovered(null)}
                  onClick={() => onOpen(row.day)}
                />
              </g>
            )
          })}
          <line y1={innerHeight} y2={innerHeight} x2={innerWidth} stroke={chart.axis} />
        </g>
      </svg>
      {hovered ? (
        <ChartTooltip
          x={MARGIN.left + (x(hovered.day) ?? 0) + x.bandwidth() / 2}
          y={MARGIN.top}
          width={width}
          title={`${formatDay(hovered.day)} · click to open`}
        >
          <TooltipRow color={chart.series1} value={formatMw(hovered.mae_mw)} label="Typical miss" />
          <TooltipRow
            color={chart.corrected}
            dash="4 2"
            value={formatMw(hovered.corrected_mae_mw)}
            label="With the learned correction"
          />
          <TooltipRow value={formatSignedMw(hovered.bias_mw)} label="Bias" />
          <TooltipRow
            value={`${hovered.hours_short} of ${hovered.hours_scored}`}
            label="Hours short"
          />
        </ChartTooltip>
      ) : null}
    </div>
  )
}

export function DaysTable({ days, gate }: { days: DayRow[]; gate: string }) {
  return (
    <table className="data-table tabular">
      <thead>
        <tr>
          <th scope="col">Delivery day</th>
          <th scope="col">Typical miss</th>
          <th scope="col">Learned correction</th>
          <th scope="col">Bias</th>
          <th scope="col">Hours short</th>
          <th scope="col">Worst shortfall</th>
        </tr>
      </thead>
      <tbody>
        {days.map((row) => (
          <tr key={row.day}>
            <th scope="row">
              <Link to="/" search={{ day: row.day, gate }}>
                {formatDay(row.day)}
              </Link>
            </th>
            <td>{formatMw(row.mae_mw)}</td>
            <td>{formatMw(row.corrected_mae_mw)}</td>
            <td>{formatSignedMw(row.bias_mw)}</td>
            <td>
              {row.hours_short} of {row.hours_scored}
            </td>
            <td>{row.worst_shortfall ? formatMw(row.worst_shortfall.error_mw) : '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function DaysLegendNote() {
  return (
    <Text size="1" color="gray">
      Each bar is one delivery day. Click a bar to open that day on the Decision page.
    </Text>
  )
}
