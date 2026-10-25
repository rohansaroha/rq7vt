import { Table } from '@radix-ui/themes'

import type { Schema } from '@/shared/api/client'
import { formatMw, formatSignedMw, formatUkTime } from '@/shared/format'

/** The chart's values as a table: the accessible twin of the decision chart. */
export function DecisionTable({
  points,
  showCorrected = false,
}: {
  points: Schema<'DecisionPoint'>[]
  showCorrected?: boolean
}) {
  return (
    <Table.Root size="1" variant="ghost" className="tabular">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Hour (UK)</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell justify="end">Forecast</Table.ColumnHeaderCell>
          {showCorrected ? (
            <Table.ColumnHeaderCell justify="end">Learned correction</Table.ColumnHeaderCell>
          ) : null}
          <Table.ColumnHeaderCell justify="end">Actual</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell justify="end">Forecast − actual</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell justify="end">Likely range</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell justify="end">Run</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {points.map((p) => (
          <Table.Row key={p.start_time}>
            <Table.RowHeaderCell>{formatUkTime(p.start_time)}</Table.RowHeaderCell>
            <Table.Cell justify="end">{formatMw(p.forecast_mw)}</Table.Cell>
            {showCorrected ? (
              <Table.Cell justify="end">{formatMw(p.corrected_mw)}</Table.Cell>
            ) : null}
            <Table.Cell justify="end">{formatMw(p.actual_mw)}</Table.Cell>
            <Table.Cell justify="end">{formatSignedMw(p.error_mw)}</Table.Cell>
            <Table.Cell justify="end">
              {p.likely_low_mw != null && p.likely_high_mw != null
                ? `${formatMw(p.likely_low_mw)} – ${formatMw(p.likely_high_mw)}`
                : '–'}
            </Table.Cell>
            <Table.Cell justify="end">
              {p.publish_time ? formatUkTime(p.publish_time) : '–'}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  )
}
