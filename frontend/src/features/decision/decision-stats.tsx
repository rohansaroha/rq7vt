import type { Schema } from '@/shared/api/client'
import { formatGwh, formatMw, formatUkTime } from '@/shared/format'
import { StatTile } from '@/shared/ui/stat-tile'

/** The day in four numbers: forecast and actual energy, the typical and the worst miss. */
export function DecisionStats({ decision }: { decision: Schema<'DecisionResponse'> | undefined }) {
  const summary = decision?.summary
  const runTime = decision?.run ? formatUkTime(decision.run.publish_time) : undefined
  const worst = summary?.worst_shortfall
  return (
    <div className="stat-grid">
      <StatTile
        loading={!summary}
        label="Forecast at bid"
        value={formatGwh(summary?.forecast_energy_mwh)}
        note={runTime ? `Wind energy for the day, from the ${runTime} run` : 'No forecast'}
      />
      <StatTile
        loading={!summary}
        label="Actual"
        value={formatGwh(summary?.actual_energy_mwh)}
        note="Metered wind generation, half-hourly"
      />
      <StatTile
        loading={!summary}
        label="Typical miss"
        value={formatMw(summary?.mae_mw)}
        note={`Average hourly error (MAE), ${summary?.hours_scored ?? 0} of ${summary?.hours ?? 24} hours scored`}
      />
      <StatTile
        loading={!summary}
        label="Worst shortfall"
        value={worst ? formatMw(worst.error_mw) : 'None'}
        note={
          worst
            ? `At ${formatUkTime(worst.start_time)}, wind came in below the forecast`
            : 'Wind met or beat the forecast every hour'
        }
      />
    </div>
  )
}
