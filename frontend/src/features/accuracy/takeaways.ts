/**
 * One-line findings for the Accuracy screen's charts, computed from the API responses.
 * Each chart's headline says what it shows, so the page reads top to bottom.
 */
import type { Schema } from '@/shared/api/client'
import { formatDay, formatMw, formatPercent, formatSignedMw } from '@/shared/format'

import type { Forecast } from './queries'

type Summary = Schema<'AccuracySummary'>
type DayRow = Schema<'DayRow'>

const pad = (hour: number) => `${String(hour).padStart(2, '0')}:00`

export function leadTakeaway(curve: Schema<'LeadTimePoint'>[]): string {
  const first = curve.find((p) => p.mae_mw != null)
  const last = [...curve].reverse().find((p) => p.mae_mw != null)
  if (!first || !last || first === last) return 'Error against lead time'
  return `The typical miss grows from ${formatMw(first.mae_mw)} at ${first.horizon_h} h to ${formatMw(last.mae_mw)} at ${last.horizon_h} h ahead`
}

export function heatTakeaway(heatmap: Schema<'Heatmap'>): string {
  let worst: { value: number; hour: number; bucket: number } | undefined
  heatmap.mae_mw.forEach((row, r) =>
    row.forEach((value, b) => {
      if (value != null && (!worst || value > worst.value)) worst = { value, hour: r, bucket: b }
    }),
  )
  const bucket = worst ? heatmap.buckets[worst.bucket] : undefined
  const hour = worst ? heatmap.hours_of_day[worst.hour] : undefined
  if (!worst || !bucket || hour == null) return 'Where the misses concentrate'
  return `Biggest misses: the ${pad(hour)} hour, forecast ${bucket.from_h}–${bucket.to_h} h ahead (${formatMw(worst.value)})`
}

export function bufferTakeaway(summary: Summary, ratio: number): string {
  const option = summary.buffers.find((b) => b.cost_ratio === ratio)
  if (!option) return 'Choose your buffer'
  return `At ${ratio}:1, hold ${formatMw(option.buffer_mw)}: it covered ${formatPercent(option.covered_share, 0)} of hours`
}

export function dayMae(row: DayRow, forecast: Forecast): number | null {
  return forecast === 'corrected' ? row.corrected_mae_mw : row.mae_mw
}

export function worstDay(days: DayRow[], forecast: Forecast): DayRow | undefined {
  return days.reduce<DayRow | undefined>((worst, row) => {
    const value = dayMae(row, forecast)
    if (value == null) return worst
    return !worst || value > (dayMae(worst, forecast) ?? -Infinity) ? row : worst
  }, undefined)
}

export function daysTakeaway(days: DayRow[], forecast: Forecast): string {
  const worst = worstDay(days, forecast)
  if (!worst) return 'Day by day'
  const value = dayMae(worst, forecast)
  return `${formatDay(worst.day)} was the hardest day: a typical miss of ${formatMw(value)}, short in ${worst.hours_short} of ${worst.hours_scored} hours`
}

/** How much the learned correction changed the headline numbers at this gate. */
export function correctionGain(
  published: Summary,
  corrected: Summary,
  days: DayRow[] | undefined,
): { title: string; body: string } {
  const before = published.metrics
  const after = corrected.metrics
  const cut =
    before.mae_mw != null && after.mae_mw != null && before.mae_mw > 0
      ? 1 - after.mae_mw / before.mae_mw
      : null
  const nine = (summary: Summary) => summary.buffers.find((b) => b.cost_ratio === 9)?.buffer_mw
  const helped = days?.filter(
    (d) => d.mae_mw != null && d.corrected_mae_mw != null && d.corrected_mae_mw < d.mae_mw,
  ).length
  const title =
    cut == null
      ? 'The learned correction'
      : cut >= 0
        ? `The learned correction cuts the typical miss by ${formatPercent(cut, 0)}`
        : `The learned correction raised the typical miss by ${formatPercent(-cut, 0)}`
  const parts = [
    `Typical miss ${formatMw(before.mae_mw)} → ${formatMw(after.mae_mw)}.`,
    `Bias ${formatSignedMw(before.bias_mw)} → ${formatSignedMw(after.bias_mw)}.`,
    `The 9:1 buffer goes from ${formatMw(nine(published))} to ${formatMw(nine(corrected))}, so less cover buys the same protection.`,
  ]
  if (days && helped != null) parts.push(`It helped on ${helped} of ${days.length} days.`)
  return { title, body: parts.join(' ') }
}
