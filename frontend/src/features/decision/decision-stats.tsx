import type { Schema } from '@/shared/api/client'
import { GLOSSARY } from '@/shared/glossary'
import { formatGwh, formatMw, formatUkTime } from '@/shared/format'
import { StatTile } from '@/shared/ui/stat-tile'

/** The day in four numbers: forecast and actual energy, the typical and the worst miss. */
export function DecisionStats({
  decision,
  showCorrected = false,
}: {
  decision: Schema<'DecisionResponse'> | undefined
  showCorrected?: boolean
}) {
  const summary = decision?.summary
  const runTime = decision?.run ? formatUkTime(decision.run.publish_time) : undefined
  const worst = summary?.worst_shortfall
  const corrected = showCorrected && decision?.correction ? summary : undefined
  return (
    <div className="stat-grid">
      <StatTile
        loading={!summary}
        label="Forecast at bid"
        info={GLOSSARY.energy}
        value={formatGwh(summary?.forecast_energy_mwh)}
        delta={
          corrected
            ? `Learned correction: ${formatGwh(corrected.corrected_forecast_energy_mwh)}`
            : null
        }
        note={runTime ? `Wind energy for the day, from the ${runTime} run` : 'No forecast'}
      />
      <StatTile
        loading={!summary}
        label="Actual"
        info={GLOSSARY.actual}
        value={formatGwh(summary?.actual_energy_mwh)}
        note="Metered wind generation, half-hourly"
      />
      <StatTile
        loading={!summary}
        label="Typical miss"
        info={GLOSSARY.mae}
        value={formatMw(summary?.mae_mw)}
        delta={corrected ? `Learned correction: ${formatMw(corrected.corrected_mae_mw)}` : null}
        note={`Average hourly error (MAE), ${summary?.hours_scored ?? 0} of ${summary?.hours ?? 24} hours scored`}
      />
      <StatTile
        loading={!summary}
        label="Worst shortfall"
        info={GLOSSARY.worstShortfall}
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
