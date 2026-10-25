import { scaleLinear, scaleUtc } from 'd3-scale'
import { area, line } from 'd3-shape'
import { useMemo, useState, type MouseEvent } from 'react'

import type { Schema } from '@/shared/api/client'
import { chart } from '@/shared/charts/colors'
import { DASH } from '@/shared/charts/marks'
import { ChartTooltip, TooltipRow } from '@/shared/charts/chart-tooltip'
import { useElementWidth } from '@/shared/charts/use-element-width'
import { formatGwTick, formatMw, formatSignedMw, formatUkTime } from '@/shared/format'

type Point = Schema<'DecisionPoint'>
type HalfHour = Schema<'HalfHour'>
type RunPoint = Schema<'RunPoint'>

const HEIGHT = 300
const MARGIN = { top: 12, right: 12, bottom: 28, left: 48 }
const HOUR_MS = 3_600_000

export type CompareRun = { label: string; points: RunPoint[] }

/**
 * The day as the buyer saw it: the forecast at the gate (and its likely range) against
 * the metered half-hours. D3 does the maths (scales, path strings); React draws the SVG.
 */
export function DecisionChart({
  points,
  actuals,
  compare,
  showBand,
  showCorrected = false,
  startsAt,
  endsAt,
  inspected,
  onInspect,
  label,
}: {
  points: Point[]
  actuals: HalfHour[]
  compare: CompareRun | undefined
  showBand: boolean
  showCorrected?: boolean
  startsAt: string
  endsAt: string
  inspected: number
  onInspect: (index: number) => void
  label: string
}) {
  const [frameRef, width] = useElementWidth<HTMLDivElement>()
  const [hovered, setHovered] = useState<number | null>(null)
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom

  const geometry = useMemo(() => {
    const x = scaleUtc()
      .domain([new Date(startsAt), new Date(endsAt)])
      .range([0, innerWidth])
    const highest = Math.max(
      2000,
      ...actuals.map((a) => a.generation_mw),
      ...points.map((p) =>
        Math.max(
          p.forecast_mw ?? 0,
          showBand ? (p.likely_high_mw ?? 0) : 0,
          showCorrected ? (p.corrected_mw ?? 0) : 0,
        ),
      ),
      ...(compare?.points.map((p) => p.forecast_mw) ?? []),
    )
    const y = scaleLinear().domain([0, highest]).nice(4).range([innerHeight, 0])
    const at = (instant: string) => x(new Date(instant))
    return {
      x,
      y,
      at,
      actual: line<HalfHour>()
        .x((d) => at(d.start_time))
        .y((d) => y(d.generation_mw))(actuals),
      forecast: line<Point>()
        .defined((d) => d.forecast_mw != null)
        .x((d) => at(d.start_time))
        .y((d) => y(d.forecast_mw ?? 0))(points),
      corrected: line<Point>()
        .defined((d) => d.corrected_mw != null)
        .x((d) => at(d.start_time))
        .y((d) => y(d.corrected_mw ?? 0))(points),
      band: area<Point>()
        .defined((d) => d.likely_low_mw != null && d.likely_high_mw != null)
        .x((d) => at(d.start_time))
        .y0((d) => y(d.likely_low_mw ?? 0))
        .y1((d) => y(d.likely_high_mw ?? 0))(points),
      compare: compare
        ? line<RunPoint>()
            .x((d) => at(d.start_time))
            .y((d) => y(d.forecast_mw))(compare.points)
        : null,
    }
  }, [actuals, points, compare, showBand, showCorrected, startsAt, endsAt, innerWidth, innerHeight])

  const { y, at } = geometry
  const active = hovered ?? inspected
  const point = points[active]
  const compareValue = point
    ? compare?.points.find((p) => p.start_time === point.start_time)?.forecast_mw
    : undefined
  // Label from the 23:00 start, every 3 hours (every 6 on narrow screens), plus the end.
  const step = innerWidth < 560 ? 6 : 3
  const ticks = [...points.filter((_, i) => i % step === 0).map((p) => p.start_time), endsAt]

  function nearestHour(event: MouseEvent<SVGRectElement>): number {
    const bounds = event.currentTarget.getBoundingClientRect()
    const time = geometry.x.invert(event.clientX - bounds.left).getTime()
    const index = Math.round((time - new Date(startsAt).getTime()) / HOUR_MS)
    return Math.min(points.length - 1, Math.max(0, index))
  }

  return (
    <div ref={frameRef} className="chart-frame">
      <svg width={width} height={HEIGHT} role="img" aria-label={label}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {y.ticks(4).map((tick) => (
            <g key={tick} transform={`translate(0,${y(tick)})`}>
              <line x2={innerWidth} stroke={chart.grid} />
              <text x={-8} dy="0.32em" textAnchor="end">
                {formatGwTick(tick)}
              </text>
            </g>
          ))}
          <line y1={innerHeight} y2={innerHeight} x2={innerWidth} stroke={chart.axis} />
          {ticks.map((instant, i) => (
            <text
              key={instant}
              x={at(instant)}
              y={innerHeight + 18}
              textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
            >
              {formatUkTime(instant)}
            </text>
          ))}

          {showBand && geometry.band ? (
            <path d={geometry.band} fill={chart.band} stroke="none" />
          ) : null}
          <path d={geometry.actual ?? ''} fill="none" stroke={chart.ink} strokeWidth={2} />
          {geometry.compare ? (
            <path
              d={geometry.compare}
              fill="none"
              stroke={chart.series2}
              strokeWidth={2}
              strokeDasharray={DASH.compare}
              strokeLinecap="round"
            />
          ) : null}
          <path d={geometry.forecast ?? ''} fill="none" stroke={chart.series1} strokeWidth={2} />
          {showCorrected && geometry.corrected ? (
            <path
              d={geometry.corrected}
              fill="none"
              stroke={chart.corrected}
              strokeWidth={2.5}
              strokeDasharray={DASH.corrected}
            />
          ) : null}

          {point ? (
            <g transform={`translate(${at(point.start_time)},0)`}>
              <line y2={innerHeight} stroke={chart.axis} />
              {point.actual_mw != null ? (
                <circle
                  cy={y(point.actual_mw)}
                  r={4}
                  fill={chart.ink}
                  stroke={chart.surface}
                  strokeWidth={2}
                />
              ) : null}
              {point.forecast_mw != null ? (
                <circle
                  cy={y(point.forecast_mw)}
                  r={5}
                  fill={chart.series1}
                  stroke={chart.surface}
                  strokeWidth={2}
                />
              ) : null}
              {showCorrected && point.corrected_mw != null ? (
                <circle
                  cy={y(point.corrected_mw)}
                  r={4}
                  fill={chart.corrected}
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
            onPointerMove={(event) => setHovered(nearestHour(event))}
            onPointerLeave={() => setHovered(null)}
            onClick={(event) => onInspect(nearestHour(event))}
          />
        </g>
      </svg>
      {hovered !== null && point ? (
        <ChartTooltip
          x={MARGIN.left + at(point.start_time)}
          y={MARGIN.top}
          width={width}
          title={`${formatUkTime(point.start_time)} hour`}
        >
          <TooltipRow color={chart.series1} value={formatMw(point.forecast_mw)} label="Forecast" />
          {showCorrected ? (
            <TooltipRow
              color={chart.corrected}
              dash="4 2"
              value={formatMw(point.corrected_mw)}
              label="Learned correction"
            />
          ) : null}
          <TooltipRow color={chart.ink} value={formatMw(point.actual_mw)} label="Actual" />
          {compareValue != null && compare ? (
            <TooltipRow
              color={chart.series2}
              dash="2 2"
              value={formatMw(compareValue)}
              label={compare.label}
            />
          ) : null}
          <TooltipRow value={formatSignedMw(point.error_mw)} label="Forecast minus actual" />
        </ChartTooltip>
      ) : null}
    </div>
  )
}
