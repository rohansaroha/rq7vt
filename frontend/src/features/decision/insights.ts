/**
 * The Decision screen's numbers, turned into sentences: the chart's headline, the
 * forecast signal, the watch list and the prototype daily briefing. Everything here is a
 * pure function of API responses, so it is easy to test and never invents a number.
 */
import type { Schema } from '@/shared/api/client'
import {
  formatDay,
  formatFactor,
  formatGwh,
  formatHours,
  formatMw,
  formatPercent,
  formatShortDay,
  formatUkTime,
  formatUkWeekday,
} from '@/shared/format'

type Decision = Schema<'DecisionResponse'>
type Summary = Schema<'AccuracySummary'>

const CLOSE = 0.05 // within 5% on the day's energy counts as "close"

export type Energy = { forecast: number; actual: number; change: number }

/** Forecast and actual energy for the day; `change` is (actual - forecast) / forecast. */
export function energy(decision: Decision): Energy | null {
  const forecast = decision.summary.forecast_energy_mwh
  const actual = decision.summary.actual_energy_mwh
  if (forecast == null || actual == null || forecast <= 0) return null
  return { forecast, actual, change: (actual - forecast) / forecast }
}

export function hoursShort(decision: Decision): number {
  return decision.points.filter((p) => p.error_mw != null && p.error_mw > 0).length
}

export function bufferAt(summary: Summary | undefined, ratio = 9): number | undefined {
  return summary?.buffers.find((b) => b.cost_ratio === ratio)?.buffer_mw
}

/** The chart's headline: how the day's wind compared with the forecast. */
export function energyHeadline(decision: Decision): string {
  const e = energy(decision)
  if (!decision.run) return `No forecast was published before the ${decision.gate.time} gate`
  if (!e) return 'Forecast at bid against what the wind did'
  if (e.change <= -CLOSE) return `Wind came in ${formatPercent(-e.change, 0)} below the forecast`
  if (e.change >= CLOSE) return `Wind came in ${formatPercent(e.change, 0)} above the forecast`
  return `The forecast was close: within ${formatPercent(Math.abs(e.change), 0)} on the day’s energy`
}

/** How this day's typical miss compares with the period at the same gate. */
function dayKind(decision: Decision, summary: Summary | undefined): string | null {
  const day = decision.summary.mae_mw
  const period = summary?.metrics.mae_mw
  if (day == null || period == null || period <= 0) return null
  const ratio = day / period
  if (ratio >= 1.5) return `A hard day: misses ran ${ratio.toFixed(1)}× the period’s norm`
  if (ratio <= 0.67) return `An easy day: misses about ${formatPercent(ratio, 0)} of the norm`
  return 'A typical day for this gate'
}

function shortLine(decision: Decision): string {
  const short = hoursShort(decision)
  const scored = decision.summary.hours_scored
  const mae = formatMw(decision.summary.mae_mw)
  if (scored === 0) return 'No hour could be scored.'
  if (short === scored) return `You were short in every hour, by ${mae} in a typical hour.`
  if (short === 0) return `The wind beat the forecast in every hour; the typical miss was ${mae}.`
  return `You were short in ${short} of ${scored} hours; the typical miss was ${mae}.`
}

/** A one-line steer, chosen by rules from the numbers (never free text). */
/** How much the learned correction cut the day's typical miss (negative: it made it worse). */
function correctionCut(decision: Decision): number | null {
  const corrected = decision.summary.corrected_mae_mw
  const mae = decision.summary.mae_mw
  if (!decision.correction || corrected == null || mae == null || mae <= 0) return null
  return 1 - corrected / mae
}

function steer(decision: Decision, summary: Summary | undefined): string {
  const e = energy(decision)
  const cut = correctionCut(decision)
  if (!e) return 'Too little data to judge this day.'
  if (e.change <= -CLOSE && cut != null && cut >= 0.1)
    return `${cut >= 0.5 ? 'Most' : 'Part'} of the miss was the forecast’s recent lean high: the learned correction would have cut the typical miss by ${formatPercent(cut, 0)}.`
  if (e.change <= -CLOSE)
    return `The miss was bigger than the recent lean explains. This is the kind of day the ${formatMw(bufferAt(summary))} cover is for.`
  if (e.change >= CLOSE)
    return 'Wind beat the forecast, so extra cover bought for this day would have left you long.'
  return 'A normal day. The forecast and the usual cover would have done their job.'
}

export function forecastSignal(
  decision: Decision,
  summary: Summary | undefined,
): { title: string; body: string } {
  if (!decision.run) {
    return {
      title: 'Nothing to bid with',
      body: `No run had been published before the ${decision.gate.time} gate for this day.`,
    }
  }
  return {
    title: dayKind(decision, summary) ?? energyHeadline(decision),
    body: `${shortLine(decision)} ${steer(decision, summary)}`,
  }
}

export function watchItems(decision: Decision, summary: Summary | undefined): string[] {
  const items: string[] = []
  const worst = decision.summary.worst_shortfall
  items.push(
    worst
      ? `Worst hour ${formatUkTime(worst.start_time)}: ${formatMw(worst.error_mw)} short`
      : 'No hour came in below the forecast',
  )
  const buffer = bufferAt(summary)
  if (buffer != null && decision.summary.hours_scored > 0) {
    const beyond = decision.points.filter((p) => p.error_mw != null && p.error_mw > buffer).length
    items.push(
      beyond === 0
        ? `The 9:1 cover (${formatMw(buffer)}) covered every hour`
        : `${beyond} ${beyond === 1 ? 'hour' : 'hours'} broke through the 9:1 cover of ${formatMw(buffer)}`,
    )
  }
  const { correction, summary: day } = decision
  if (correction && day.mae_mw != null && day.corrected_mae_mw != null) {
    items.push(
      `Learned correction ${formatFactor(correction.factor)}: typical miss ${formatMw(day.mae_mw)} → ${formatMw(day.corrected_mae_mw)}`,
    )
  } else if (decision.run) {
    items.push('Not enough history yet for a learned correction')
  }
  return items
}

export type Briefing = { text: string; sources: string[] }

/**
 * The prototype daily briefing: a short note for the trading desk, written by a template
 * from the same numbers as the screen. A live version would hand these numbers to a
 * language model as its only facts.
 */
export function writeBriefing(
  decision: Decision,
  summary: Summary | undefined,
  gateLabel: string | undefined,
): Briefing {
  const { run, summary: day, correction, gate } = decision
  const header = `Day-ahead briefing · ${formatDay(decision.day)} · ${gate.time} gate${gateLabel ? ` (${gateLabel})` : ''}`
  if (!run) {
    return {
      text: `${header}\n\nNo WINDFOR run had been published before the gate, so there was no forecast to bid with. Metered output for the day was ${formatGwh(day.actual_energy_mwh)}.`,
      sources: [`FUELHH · ${decision.actuals.length} half-hours`],
    }
  }
  const e = energy(decision)
  const lines: string[] = [header, '']
  const lead = `${formatHours(run.lead_h.min_h)} to ${formatHours(run.lead_h.max_h)}`
  let opening = `At the gate you had the ${formatUkTime(run.publish_time)} WINDFOR run, published ${formatUkWeekday(run.publish_time)} and looking ${lead} ahead.`
  if (e) {
    const direction = e.change < 0 ? 'less' : 'more'
    opening += ` It expected ${formatGwh(e.forecast)} of wind over the delivery day; metering shows ${formatGwh(e.actual)}, ${formatPercent(Math.abs(e.change), 0)} ${direction}.`
  }
  lines.push(opening)

  const period = summary?.metrics.mae_mw
  let misses = shortLine(decision)
  if (period != null) misses += ` The period’s norm at this gate is ${formatMw(period)}.`
  if (day.worst_shortfall) {
    misses += ` The biggest gap came at ${formatUkTime(day.worst_shortfall.start_time)}: ${formatMw(day.worst_shortfall.error_mw)} short.`
  }
  lines.push('', misses)

  const buffer = bufferAt(summary)
  if (buffer != null && day.hours_scored > 0) {
    const covered = decision.points.filter((p) => p.error_mw != null && p.error_mw <= buffer).length
    lines.push(
      '',
      `Cover: if being short costs nine times being long, this gate calls for about ${formatMw(buffer)} of extra cover. On this day it would have covered ${covered} of ${day.hours_scored} hours.`,
    )
  }
  if (correction && day.corrected_mae_mw != null) {
    const cut = correctionCut(decision)
    const overshoot =
      cut != null && cut < 0
        ? ' On a day the forecast already had right, the correction overshoots: it fixes the month’s lean, not each day.'
        : ''
    lines.push(
      '',
      `Learned correction: scaling the forecast by ${formatFactor(correction.factor)}, learned from ${formatShortDay(correction.trained_from)} to ${formatShortDay(correction.trained_to)}, would have expected ${formatGwh(day.corrected_forecast_energy_mwh)} and moved the typical miss from ${formatMw(day.mae_mw)} to ${formatMw(day.corrected_mae_mw)}.${overshoot}`,
    )
  }
  lines.push('', `Takeaway: ${steer(decision, summary)}`)

  const sources = [
    `WINDFOR ${formatUkTime(run.publish_time)} run`,
    `FUELHH · ${decision.actuals.length} half-hours`,
  ]
  if (summary) sources.push(`${gate.time} gate · ${summary.metrics.hours_scored} hours scored`)
  if (correction)
    sources.push(`Correction · ${correction.days} days to ${formatShortDay(correction.trained_to)}`)
  return { text: lines.join('\n'), sources }
}

/** How the forecast drifted across the day's runs, in one sentence. */
export function driftLine(
  runs: Schema<'ForecastRun'>[],
  usedPublishTime: string | undefined,
): string | null {
  const scored = runs.filter((run) => run.mae_mw != null)
  const used = scored.find((run) => run.publish_time === usedPublishTime)
  const best = scored.reduce<Schema<'ForecastRun'> | undefined>(
    (a, b) => (a && (a.mae_mw ?? Infinity) <= (b.mae_mw ?? Infinity) ? a : b),
    undefined,
  )
  if (!used || !best || used.mae_mw == null || best.mae_mw == null) return null
  if (best.publish_time === used.publish_time)
    return 'The run you bid with was the closest of the day.'
  const gain = used.mae_mw - best.mae_mw
  const when = best.publish_time > used.publish_time ? 'a later' : 'an earlier'
  return `The closest was ${when} run, ${formatUkTime(best.publish_time)}: ${formatMw(best.mae_mw)} typical miss, ${formatMw(gain)} better than the run you bid with.`
}
