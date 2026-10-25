import { Flex, Text } from '@radix-ui/themes'
import { useState, type CSSProperties } from 'react'

import type { Schema } from '@/shared/api/client'
import { SEQUENTIAL } from '@/shared/charts/colors'
import { formatMw } from '@/shared/format'

type Heatmap = Schema<'Heatmap'>
type Cell = { hour: number; bucket: number }

const pad = (hour: number) => `${String(hour).padStart(2, '0')}:00`

/** Bin a value into the sequential ramp: light = small miss, dark = big miss. */
function colorFor(value: number, min: number, max: number): string {
  if (max <= min) return SEQUENTIAL[0] ?? 'transparent'
  const step = Math.floor(((value - min) / (max - min)) * (SEQUENTIAL.length - 1) + 0.5)
  return SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.max(0, step))] ?? 'transparent'
}

/**
 * Typical miss by delivery hour (rows) and lead time (columns). The column headers are
 * buttons: picking one scores that lead time above.
 */
export function LeadHeatmap({
  heatmap,
  selectedBucket,
  onPickBucket,
}: {
  heatmap: Heatmap
  selectedBucket: number | undefined
  onPickBucket: (bucket: Schema<'LeadBucket'>) => void
}) {
  const [cell, setCell] = useState<Cell | null>(null)
  const values = heatmap.mae_mw.flat().filter((v): v is number => v != null)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const columns = { '--heat-columns': heatmap.buckets.length } as CSSProperties
  const hovered = cell ? heatmap.mae_mw[cell.hour]?.[cell.bucket] : undefined
  const hoveredBucket = cell ? heatmap.buckets[cell.bucket] : undefined

  return (
    <Flex direction="column" gap="2">
      <Text size="1" weight="bold" color="gray" ml="7">
        Lead time (hours)
      </Text>
      <div className="heatmap" style={columns}>
        <span />
        {heatmap.buckets.map((bucket, b) => (
          <button
            key={bucket.from_h}
            type="button"
            className="heat-column"
            aria-pressed={b === selectedBucket}
            aria-label={`Score lead time ${bucket.from_h} to ${bucket.to_h} hours`}
            onClick={() => onPickBucket(bucket)}
          >
            {bucket.from_h}–{bucket.to_h}
          </button>
        ))}
      </div>
      <div
        role="img"
        aria-label="Heatmap of the typical miss by delivery hour and lead time"
        className="heatmap"
        style={columns}
        onPointerLeave={() => setCell(null)}
      >
        {heatmap.hours_of_day.map((hour, row) => (
          <Row
            key={hour}
            label={hour % 3 === 0 ? pad(hour) : ''}
            cells={heatmap.mae_mw[row] ?? []}
            min={min}
            max={max}
            selectedBucket={selectedBucket}
            onHover={(bucket) => setCell({ hour: row, bucket })}
          />
        ))}
      </div>
      <Flex align="center" gap="2" ml="7" wrap="wrap">
        <Text size="1" color="gray" className="tabular">
          {formatMw(min)}
        </Text>
        <Flex aria-hidden="true" gap="0" style={{ flex: '0 1 180px' }}>
          {SEQUENTIAL.map((color) => (
            <span key={color} style={{ flex: 1, height: 10, background: color }} />
          ))}
        </Flex>
        <Text size="1" color="gray" className="tabular">
          {formatMw(max)} typical miss
        </Text>
      </Flex>
      <Text size="2" ml="7" className="tabular" aria-live="polite">
        {cell && hoveredBucket
          ? `${pad(heatmap.hours_of_day[cell.hour] ?? 0)}, lead ${hoveredBucket.from_h}–${hoveredBucket.to_h} h: typical miss ${formatMw(hovered)}`
          : 'Point at a cell to read it.'}
      </Text>
    </Flex>
  )
}

function Row({
  label,
  cells,
  min,
  max,
  selectedBucket,
  onHover,
}: {
  label: string
  cells: (number | null)[]
  min: number
  max: number
  selectedBucket: number | undefined
  onHover: (bucket: number) => void
}) {
  return (
    <>
      <Text size="1" color="gray" className="tabular" style={{ lineHeight: '14px' }}>
        {label}
      </Text>
      {cells.map((value, b) => (
        <span
          key={b}
          className="heat-cell"
          data-selected={b === selectedBucket}
          style={{ background: value == null ? 'var(--gray-a2)' : colorFor(value, min, max) }}
          onPointerEnter={() => onHover(b)}
          onClick={() => onHover(b)}
        />
      ))}
    </>
  )
}

export function HeatmapTable({ heatmap }: { heatmap: Heatmap }) {
  return (
    <table className="data-table tabular">
      <thead>
        <tr>
          <th scope="col">Hour (UK)</th>
          {heatmap.buckets.map((b) => (
            <th scope="col" key={b.from_h}>
              {b.from_h}–{b.to_h} h
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {heatmap.hours_of_day.map((hour, row) => (
          <tr key={hour}>
            <th scope="row">{pad(hour)}</th>
            {(heatmap.mae_mw[row] ?? []).map((value, b) => (
              <td key={b}>{value == null ? '–' : Math.round(value).toLocaleString('en-GB')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
