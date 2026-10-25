import { Skeleton } from '@radix-ui/themes'
import { useQueries } from '@tanstack/react-query'

import { accuracySummaryQuery } from '@/features/accuracy/queries'
import type { Schema } from '@/shared/api/client'
import { formatMw, formatSignedMw } from '@/shared/format'

/** Published against learned correction at every auction, live from the API. */
export function CorrectionTable({ gates }: { gates: Schema<'GatePreset'>[] }) {
  const results = useQueries({
    queries: gates.flatMap((g) => [
      accuracySummaryQuery({ mode: 'gate', gate: g.time }),
      accuracySummaryQuery({ mode: 'gate', gate: g.time, forecast: 'corrected' }),
    ]),
  })
  if (results.some((r) => !r.data)) return <Skeleton height="140px" />
  const nine = (s: Schema<'AccuracySummary'> | undefined) =>
    s?.buffers.find((b) => b.cost_ratio === 9)?.buffer_mw
  return (
    <div className="table-scroll">
      <table className="data-table tabular">
        <thead>
          <tr>
            <th scope="col">Auction</th>
            <th scope="col">Typical miss</th>
            <th scope="col">Bias</th>
            <th scope="col">9:1 buffer</th>
          </tr>
        </thead>
        <tbody>
          {gates.map((g, i) => {
            const published = results[2 * i]?.data
            const corrected = results[2 * i + 1]?.data
            return (
              <tr key={g.id}>
                <th scope="row">
                  {g.time} · {g.label}
                </th>
                <td>
                  <span className="was">{formatMw(published?.metrics.mae_mw)}</span>{' '}
                  <span className="now">{formatMw(corrected?.metrics.mae_mw)}</span>
                </td>
                <td>
                  <span className="was">{formatSignedMw(published?.metrics.bias_mw)}</span>{' '}
                  <span className="now">{formatSignedMw(corrected?.metrics.bias_mw)}</span>
                </td>
                <td>
                  <span className="was">{formatMw(nine(published))}</span>{' '}
                  <span className="now">{formatMw(nine(corrected))}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
