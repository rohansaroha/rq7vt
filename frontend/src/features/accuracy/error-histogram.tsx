import { Flex, Text } from '@radix-ui/themes'
import { scaleLinear } from 'd3-scale'
import { useState } from 'react'

import type { Schema } from '@/shared/api/client'
import { ChartTooltip } from '@/shared/charts/chart-tooltip'
import { chart } from '@/shared/charts/colors'
import { column } from '@/shared/charts/marks'
import { useElementWidth } from '@/shared/charts/use-element-width'
import { formatGwTick, formatMw, formatSignedMw } from '@/shared/format'

type Bin = Schema<'HistogramBin'>

const HEIGHT = 200
const MARGIN = { top: 28, right: 8, bottom: 24, left: 8 }
const MAX_BAR = 24
const GAP = 2

/** How the errors were spread, with the buffer drawn as a threshold. */
export function ErrorHistogram({
  bins,
  bufferMw,
  color = chart.series1,
}: {
  bins: Bin[]
  bufferMw: number
  color?: string
}) {
  const [frameRef, width] = useElementWidth<HTMLDivElement>()
  const [hovered, setHovered] = useState<Bin | null>(null)
  const first = bins[0]
  const last = bins[bins.length - 1]
  if (!first || !last) return <Text color="gray">No hours to show.</Text>

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const x = scaleLinear().domain([first.lower_mw, last.upper_mw]).range([0, innerWidth])
  const y = scaleLinear()
    .domain([0, Math.max(1, ...bins.map((b) => b.count))])
    .range([innerHeight, 0])
  const bufferX = Math.min(innerWidth, Math.max(0, x(bufferMw)))

  return (
    <Flex direction="column" gap="1">
      <div ref={frameRef} className="chart-frame">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Histogram of hourly errors; hours beyond the ${formatMw(bufferMw)} buffer are highlighted`}
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {bins.map((bin) => {
              const slot = x(bin.upper_mw) - x(bin.lower_mw)
              const w = Math.max(1, Math.min(MAX_BAR, slot - GAP))
              const h = innerHeight - y(bin.count)
              const left = x(bin.lower_mw) + (slot - w) / 2
              const beyond = bin.lower_mw >= bufferMw
              return (
                <g key={bin.lower_mw}>
                  {h > 0 ? (
                    <path
                      d={column(left, y(bin.count), w, h)}
                      fill={beyond ? chart.series2 : color}
                      opacity={hovered && hovered !== bin ? 0.6 : 1}
                    />
                  ) : null}
                  <rect
                    x={x(bin.lower_mw)}
                    width={slot}
                    height={innerHeight}
                    fill="transparent"
                    onPointerEnter={() => setHovered(bin)}
                    onPointerLeave={() => setHovered(null)}
                  />
                </g>
              )
            })}
            <line y1={innerHeight} y2={innerHeight} x2={innerWidth} stroke={chart.axis} />
            {x.ticks(5).map((tick) => (
              <text key={tick} x={x(tick)} y={innerHeight + 16} textAnchor="middle">
                {tick > 0 ? `+${formatGwTick(tick)}` : formatGwTick(tick)}
              </text>
            ))}
            <line
              x1={bufferX}
              x2={bufferX}
              y1={-6}
              y2={innerHeight}
              stroke={chart.ink}
              strokeWidth={2}
              strokeDasharray="4 3"
            />
            <text x={bufferX} y={-12} textAnchor="middle" style={{ fontWeight: 600 }}>
              Buffer {formatMw(bufferMw)}
            </text>
          </g>
        </svg>
        {hovered ? (
          <ChartTooltip
            x={MARGIN.left + x((hovered.lower_mw + hovered.upper_mw) / 2)}
            y={MARGIN.top}
            width={width}
            title={`${formatSignedMw(hovered.lower_mw)} to ${formatSignedMw(hovered.upper_mw)}`}
          >
            <Text size="2" weight="bold">
              {hovered.count} hours
            </Text>
          </ChartTooltip>
        ) : null}
      </div>
      <Flex justify="between" gap="3">
        <Text size="1" color="gray">
          Forecast too low: you are long
        </Text>
        <Text size="1" color="gray" align="right">
          Forecast too high: you are short
        </Text>
      </Flex>
    </Flex>
  )
}

export function HistogramTable({ bins, bufferMw }: { bins: Bin[]; bufferMw: number }) {
  return (
    <table className="data-table tabular">
      <thead>
        <tr>
          <th scope="col">Forecast − actual</th>
          <th scope="col">Hours</th>
          <th scope="col">Covered by the buffer</th>
        </tr>
      </thead>
      <tbody>
        {bins.map((bin) => (
          <tr key={bin.lower_mw}>
            <th scope="row">
              {formatSignedMw(bin.lower_mw)} to {formatSignedMw(bin.upper_mw)}
            </th>
            <td>{bin.count}</td>
            <td>{bin.upper_mw <= bufferMw ? 'Yes' : bin.lower_mw >= bufferMw ? 'No' : 'Partly'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
