import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { useMemo, useState, type MouseEvent } from 'react'

import type { Schema } from '@/shared/api/client'
import { ChartTooltip, TooltipRow } from '@/shared/charts/chart-tooltip'
import { chart } from '@/shared/charts/colors'
import { useElementWidth } from '@/shared/charts/use-element-width'
import { formatHours, formatMw } from '@/shared/format'

type Point = Schema<'LeadTimePoint'>

const HEIGHT = 260
const MARGIN = { top: 12, right: 12, bottom: 28, left: 64 }
const MAX_H = 48
const integer = new Intl.NumberFormat('en-GB')

/** Typical miss and P90 shortfall against lead time. Click a lead time to score it. */
export function LeadTimeChart({
  curve,
  leadRange,
  horizon,
  onPick,
}: {
  curve: Point[]
  leadRange: { min_h: number; max_h: number } | undefined
  horizon: number | undefined
  onPick: (horizon: number) => void
}) {
  const [frameRef, width] = useElementWidth<HTMLDivElement>()
  const [hovered, setHovered] = useState<number | null>(null)
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom

  const { x, y, mae, p90 } = useMemo(() => {
    const x = scaleLinear().domain([0, MAX_H]).range([0, innerWidth])
    const top = Math.max(500, ...curve.map((p) => Math.max(p.mae_mw ?? 0, p.p90_mw ?? 0)))
    const y = scaleLinear().domain([0, top]).nice(4).range([innerHeight, 0])
    return {
      x,
      y,
      mae: line<Point>()
        .defined((p) => p.mae_mw != null)
        .x((p) => x(p.horizon_h))
        .y((p) => y(p.mae_mw ?? 0))(curve),
      p90: line<Point>()
        .defined((p) => p.p90_mw != null)
        .x((p) => x(p.horizon_h))
        .y((p) => y(p.p90_mw ?? 0))(curve),
    }
  }, [curve, innerWidth, innerHeight])

  const point = hovered === null ? undefined : curve.find((p) => p.horizon_h === hovered)

  function nearest(event: MouseEvent<SVGRectElement>): number {
    const bounds = event.currentTarget.getBoundingClientRect()
    return Math.min(MAX_H, Math.max(0, Math.round(x.invert(event.clientX - bounds.left))))
  }

  return (
    <div ref={frameRef} className="chart-frame">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label="Line chart: the typical miss and the P90 shortfall rise with lead time, from 0 to 48 hours ahead"
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {leadRange ? (
            <rect
              x={x(leadRange.min_h)}
              width={Math.max(0, x(leadRange.max_h) - x(leadRange.min_h))}
              height={innerHeight}
              fill={chart.band}
            />
          ) : null}
          {y.ticks(4).map((tick) => (
            <g key={tick} transform={`translate(0,${y(tick)})`}>
              <line x2={innerWidth} stroke={chart.grid} />
              <text x={-8} dy="0.32em" textAnchor="end">
                {tick === 0 ? '0' : `${integer.format(tick)} MW`}
              </text>
            </g>
          ))}
          <line y1={innerHeight} y2={innerHeight} x2={innerWidth} stroke={chart.axis} />
          {[0, 12, 24, 36, 48].map((h) => (
            <text key={h} x={x(h)} y={innerHeight + 18} textAnchor="middle">
              {h} h
            </text>
          ))}
          {horizon !== undefined ? (
            <line
              x1={x(horizon)}
              x2={x(horizon)}
              y2={innerHeight}
              stroke={chart.ink}
              strokeWidth={2}
            />
          ) : null}
          <path
            d={p90 ?? ''}
            fill="none"
            stroke={chart.series2}
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          <path d={mae ?? ''} fill="none" stroke={chart.series1} strokeWidth={2} />
          {point ? (
            <g transform={`translate(${x(point.horizon_h)},0)`}>
              <line y2={innerHeight} stroke={chart.axis} />
              {point.mae_mw != null ? (
                <circle
                  cy={y(point.mae_mw)}
                  r={4}
                  fill={chart.series1}
                  stroke={chart.surface}
                  strokeWidth={2}
                />
              ) : null}
            </g>
          ) : null}
          <rect
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onPointerMove={(event) => setHovered(nearest(event))}
            onPointerLeave={() => setHovered(null)}
            onClick={(event) => onPick(nearest(event))}
          />
        </g>
      </svg>
      {point ? (
        <ChartTooltip
          x={MARGIN.left + x(point.horizon_h)}
          y={MARGIN.top}
          width={width}
          title={`${point.horizon_h} h ahead or more`}
        >
          <TooltipRow color={chart.series1} value={formatMw(point.mae_mw)} label="Typical miss" />
          <TooltipRow
            color={chart.series2}
            dashed
            value={formatMw(point.p90_mw)}
            label="P90 shortfall"
          />
          <TooltipRow value={formatHours(point.median_lead_h)} label="Median age of the run used" />
        </ChartTooltip>
      ) : null}
    </div>
  )
}

export function LeadTimeTable({ curve }: { curve: Point[] }) {
  return (
    <table className="data-table tabular">
      <thead>
        <tr>
          <th scope="col">Lead time</th>
          <th scope="col">Typical miss</th>
          <th scope="col">P90 shortfall</th>
          <th scope="col">Median run age</th>
          <th scope="col">Hours scored</th>
        </tr>
      </thead>
      <tbody>
        {curve.map((p) => (
          <tr key={p.horizon_h}>
            <th scope="row">{p.horizon_h} h</th>
            <td>{formatMw(p.mae_mw)}</td>
            <td>{formatMw(p.p90_mw)}</td>
            <td>{formatHours(p.median_lead_h)}</td>
            <td>
              {p.hours_scored} of {p.hours}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
