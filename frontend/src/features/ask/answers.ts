/**
 * The Ask prototype's "agent": it matches a question to one of a few intents and composes
 * the answer from API responses with templates. No language model is involved, so every
 * figure in an answer comes straight from the data. A production version would put a
 * model in front of the same endpoints (as its tools) and keep this grounding.
 */
import type { Schema } from '@/shared/api/client'
import {
  formatDay,
  formatFactor,
  formatGwh,
  formatMw,
  formatPercent,
  formatSignedMw,
  formatUkTime,
} from '@/shared/format'

type Summary = Schema<'AccuracySummary'>
type DayRow = Schema<'DayRow'>

export type AskData = {
  meta: Schema<'MetaResponse'>
  gate: string // the gate the day-by-day answers use
  days: DayRow[]
  summaries: Record<string, Summary> // as published, by gate time
  corrected: Summary // learned correction, at `gate`
  leadTime: Schema<'LeadTimeResponse'>
}

export type Intent =
  | 'worst-day'
  | 'best-day'
  | 'day'
  | 'buffer'
  | 'best-gate'
  | 'correction'
  | 'lead'
  | 'bias'
  | 'help'

export type Figure = { label: string; value: string; was?: string }

export type FollowUp =
  | { kind: 'ask'; question: string }
  | { kind: 'day'; label: string; day: string; gate: string; corrected?: boolean }
  | { kind: 'accuracy'; label: string; mode: 'gate' | 'horizon'; forecast?: 'corrected' }

export type Answer = {
  intent: Intent
  eyebrow: string
  text: string
  figures: Figure[]
  sources: string[]
  followUps: FollowUp[]
}

export const SUGGESTIONS = [
  'Which day went worst?',
  'How much cover should we hold?',
  'Which auction gives the best forecast?',
  'Does the learned correction help?',
  'How did 14 January go?',
  'Does the forecast run high or low?',
  'Does it get better closer to delivery?',
] as const

const MONTHS: Record<string, { month: number; year: number }> = {
  dec: { month: 12, year: 2025 },
  december: { month: 12, year: 2025 },
  jan: { month: 1, year: 2026 },
  january: { month: 1, year: 2026 },
  feb: { month: 2, year: 2026 },
  february: { month: 2, year: 2026 },
}

const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** A delivery day named in the question ("14 Jan", "January 14th", "2026-01-14", "the 28th"). */
export function parseDay(question: string): string | null {
  const q = question.toLowerCase()
  const isoMatch = /\b(20\d\d)-(\d{2})-(\d{2})\b/.exec(q)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  const names = Object.keys(MONTHS).join('|')
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${names})\\b`).exec(q)
  const monthFirst = new RegExp(`\\b(${names})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`).exec(q)
  const [dayText, monthText] = dayFirst
    ? [dayFirst[1], dayFirst[2]]
    : monthFirst
      ? [monthFirst[2], monthFirst[1]]
      : [undefined, undefined]
  if (dayText && monthText) {
    const month = MONTHS[monthText]
    if (month) return iso(month.year, month.month, Number(dayText))
  }
  const ordinal = /\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/.exec(q)
  if (ordinal) return iso(2026, 1, Number(ordinal[1]))
  return null
}

export function matchIntent(question: string): Intent {
  const q = question.toLowerCase()
  if (parseDay(q)) return 'day'
  if (/\b(worst|hardest|toughest|biggest miss)\b/.test(q)) return 'worst-day'
  if (/\b(best|easiest|calmest|most accurate)\b.*\bday\b|\bday\b.*\b(best|easiest)\b/.test(q))
    return 'best-day'
  if (/(buffer|cover|reserve|hedge|how much .*(hold|buy|keep))/.test(q)) return 'buffer'
  if (/(auction|gate|epex|n2ex|nord ?pool|market|09:20|09:50|15:30)/.test(q)) return 'best-gate'
  if (/(correct|learn|smarter|adjust|improv)/.test(q)) return 'correction'
  if (/(lead time|ahead|horizon|closer|earlier|fresh)/.test(q)) return 'lead'
  if (/(bias|lean|high or low|too high|too low|optimistic|over.?forecast|under.?forecast)/.test(q))
    return 'bias'
  return 'help'
}

function nineToOne(summary: Summary | undefined) {
  return summary?.buffers.find((b) => b.cost_ratio === 9)
}

function maeRatio(row: DayRow, period: number | null | undefined): string {
  if (row.mae_mw == null || !period) return ''
  return `, ${(row.mae_mw / period).toFixed(1)}× the period’s ${formatMw(period)}`
}

function shortText(row: DayRow): string {
  if (row.hours_scored === 0) return 'no hour could be scored'
  if (row.hours_short === row.hours_scored)
    return 'the wind fell short of the forecast in every hour'
  if (row.hours_short === 0) return 'the wind beat the forecast in every hour'
  return `the wind fell short in ${row.hours_short} of ${row.hours_scored} hours`
}

function dayFigures(row: DayRow): Figure[] {
  return [
    { label: 'Forecast at bid', value: formatGwh(row.forecast_energy_mwh) },
    { label: 'Actual', value: formatGwh(row.actual_energy_mwh) },
    {
      label: 'Typical miss, learned correction',
      value: formatMw(row.corrected_mae_mw),
      was: formatMw(row.mae_mw),
    },
    { label: 'Hours short', value: `${row.hours_short} of ${row.hours_scored}` },
  ]
}

function daysSource(data: AskData) {
  return `/accuracy/days · ${data.gate} gate · ${data.days.length} days`
}

function describeDay(data: AskData, row: DayRow, opening: string): Answer {
  const period = data.summaries[data.gate]?.metrics.mae_mw
  const worst = row.worst_shortfall
  let text = `${opening} The typical miss was ${formatMw(row.mae_mw)}${maeRatio(row, period)}, and ${shortText(row)}.`
  if (worst)
    text += ` The worst hour was ${formatUkTime(worst.start_time)}, ${formatMw(worst.error_mw)} short.`
  if (row.correction_factor != null && row.corrected_mae_mw != null) {
    text += ` The learned correction (${formatFactor(row.correction_factor)}) would have made the typical miss ${formatMw(row.corrected_mae_mw)}.`
  }
  return {
    intent: 'day',
    eyebrow: `${formatDay(row.day)} · ${data.gate} gate`,
    text,
    figures: dayFigures(row),
    sources: [daysSource(data)],
    followUps: [
      { kind: 'day', label: `Open ${formatDay(row.day)}`, day: row.day, gate: data.gate },
      { kind: 'ask', question: 'Which day went worst?' },
      { kind: 'ask', question: 'Does the learned correction help?' },
    ],
  }
}

function extreme(rows: DayRow[], pick: 'max' | 'min'): DayRow | undefined {
  return rows.reduce<DayRow | undefined>((best, row) => {
    if (row.mae_mw == null) return best
    if (!best || best.mae_mw == null) return row
    return (pick === 'max' ? row.mae_mw > best.mae_mw : row.mae_mw < best.mae_mw) ? row : best
  }, undefined)
}

export function answerQuestion(question: string, data: AskData): Answer {
  const intent = matchIntent(question)
  const gate = data.gate
  const published = data.summaries[gate]
  switch (intent) {
    case 'worst-day':
    case 'best-day': {
      const row = extreme(data.days, intent === 'worst-day' ? 'max' : 'min')
      if (!row) return help(data)
      const answer = describeDay(
        data,
        row,
        `${formatDay(row.day)} went ${intent === 'worst-day' ? 'worst' : 'best'} at the ${gate} gate.`,
      )
      return {
        ...answer,
        intent,
        followUps: [
          { kind: 'day', label: `Open ${formatDay(row.day)}`, day: row.day, gate },
          {
            kind: 'ask',
            question: intent === 'worst-day' ? 'Which day went best?' : 'Which day went worst?',
          },
          { kind: 'ask', question: 'Does the learned correction help?' },
        ],
      }
    }
    case 'day': {
      const day = parseDay(question)
      const row = data.days.find((d) => d.day === day)
      const { first_day, last_day } = data.meta.period
      if (!day || !row) {
        return {
          ...help(data),
          intent: 'day',
          text: `I only have delivery days ${formatDay(first_day)} to ${formatDay(last_day)}. Try a day in that range, such as 14 January.`,
        }
      }
      const opening =
        row.forecast_energy_mwh != null && row.actual_energy_mwh != null
          ? `On ${formatDay(row.day)} the forecast at the ${gate} gate expected ${formatGwh(row.forecast_energy_mwh)} of wind; it delivered ${formatGwh(row.actual_energy_mwh)}.`
          : `On ${formatDay(row.day)}:`
      return describeDay(data, row, opening)
    }
    case 'buffer': {
      const before = nineToOne(published)
      const after = nineToOne(data.corrected)
      const three = published?.buffers.find((b) => b.cost_ratio === 3)
      if (!before) return help(data)
      return {
        intent,
        eyebrow: `Cover to hold · ${gate} gate`,
        text: `If being short costs nine times as much as being long, hold about ${formatMw(before.buffer_mw)} of extra cover at the ${gate} gate: over the period that covered ${formatPercent(before.covered_share, 0)} of hours. With the learned correction, ${formatMw(after?.buffer_mw)} gives the same protection.`,
        figures: [
          { label: '9:1 cover, as published', value: formatMw(before.buffer_mw) },
          {
            label: '9:1 cover, learned correction',
            value: formatMw(after?.buffer_mw),
            was: formatMw(before.buffer_mw),
          },
          { label: '3:1 cover, as published', value: formatMw(three?.buffer_mw) },
        ],
        sources: [`/accuracy/summary · ${gate} gate`, `/accuracy/summary · learned correction`],
        followUps: [
          { kind: 'accuracy', label: 'Tune the cost ratio', mode: 'gate' },
          { kind: 'ask', question: 'Which auction gives the best forecast?' },
        ],
      }
    }
    case 'best-gate': {
      const rows = data.meta.gates
        .map((g) => ({ gate: g, mae: data.summaries[g.time]?.metrics.mae_mw }))
        .filter((r): r is { gate: Schema<'GatePreset'>; mae: number } => r.mae != null)
      const best = rows.reduce<(typeof rows)[number] | undefined>(
        (a, b) => (!a || b.mae < a.mae ? b : a),
        undefined,
      )
      if (!best) return help(data)
      const others = rows
        .filter((r) => r !== best)
        .map((r) => `${formatMw(r.mae)} at ${r.gate.time}`)
        .join(' and ')
      const latest = rows.reduce((a, b) => (b.gate.time > a.gate.time ? b : a), best)
      const why =
        latest === best
          ? 'bids on the freshest forecast, so it misses least'
          : 'misses least, even though later gates see later runs'
      return {
        intent,
        eyebrow: 'Auctions compared',
        text: `The ${best.gate.time} auction (${best.gate.label}) ${why}: a typical ${formatMw(best.mae)}, against ${others}.${latest === best ? ' Later gates see later runs, and every hour earlier adds error.' : ''}`,
        figures: rows.map((r) => ({
          label: `${r.gate.time} · ${r.gate.label}`,
          value: formatMw(r.mae),
        })),
        sources: rows.map((r) => `/accuracy/summary · ${r.gate.time} gate`),
        followUps: [
          { kind: 'ask', question: 'Does it get better closer to delivery?' },
          { kind: 'ask', question: 'How much cover should we hold?' },
        ],
      }
    }
    case 'correction': {
      const before = published?.metrics
      const after = data.corrected.metrics
      if (!before || before.mae_mw == null || after.mae_mw == null) return help(data)
      const helped = data.days.filter(
        (d) => d.mae_mw != null && d.corrected_mae_mw != null && d.corrected_mae_mw < d.mae_mw,
      ).length
      const cut = 1 - after.mae_mw / before.mae_mw
      return {
        intent,
        eyebrow: `Learned correction · ${gate} gate`,
        text: `${cut > 0 ? 'Yes.' : 'Not here.'} Scaling each day’s forecast by how the wind compared with it over the four weeks already metered moves the typical miss at the ${gate} gate from ${formatMw(before.mae_mw)} to ${formatMw(after.mae_mw)} (${cut >= 0 ? '−' : '+'}${formatPercent(Math.abs(cut), 0)}) and the lean from ${formatSignedMw(before.bias_mw)} to ${formatSignedMw(after.bias_mw)}. It helped on ${helped} of ${data.days.length} days.`,
        figures: [
          { label: 'Typical miss', value: formatMw(after.mae_mw), was: formatMw(before.mae_mw) },
          {
            label: 'Bias',
            value: formatSignedMw(after.bias_mw),
            was: formatSignedMw(before.bias_mw),
          },
          { label: 'P90 shortfall', value: formatMw(after.p90_mw), was: formatMw(before.p90_mw) },
        ],
        sources: [`/accuracy/summary · ${gate} gate`, daysSource(data)],
        followUps: [
          {
            kind: 'accuracy',
            label: 'See it on the Accuracy page',
            mode: 'gate',
            forecast: 'corrected',
          },
          { kind: 'ask', question: 'How much cover should we hold?' },
        ],
      }
    }
    case 'lead': {
      const at = (h: number) => data.leadTime.curve.find((p) => p.horizon_h === h)?.mae_mw
      const lead = published?.lead_h
      const near = at(0)
      const far = at(48)
      const verdict =
        near != null && far != null && near < far
          ? 'Yes: the closer to delivery, the better.'
          : 'Not clearly, in this period.'
      return {
        intent,
        eyebrow: 'Multi-horizon view',
        text: `${verdict} Published just before the hour, the forecast misses by ${formatMw(near)} in a typical hour; 24 hours ahead, ${formatMw(at(24))}; 48 hours ahead, ${formatMw(far)}.${lead ? ` Bidding at the ${gate} gate means living with ${lead.min_h} to ${lead.max_h} hours ahead.` : ''}`,
        figures: [0, 12, 24, 36, 48].map((h) => ({
          label: `${h} hours ahead`,
          value: formatMw(at(h)),
        })),
        sources: ['/accuracy/lead-time'],
        followUps: [
          { kind: 'accuracy', label: 'Open the multi-horizon view', mode: 'horizon' },
          { kind: 'ask', question: 'Which auction gives the best forecast?' },
        ],
      }
    }
    case 'bias': {
      const bias = published?.metrics.bias_mw
      const scored = data.days.reduce((n, d) => n + d.hours_scored, 0)
      const short = data.days.reduce((n, d) => n + d.hours_short, 0)
      if (bias == null || scored === 0) return help(data)
      const high = bias >= 0
      return {
        intent,
        eyebrow: `Bias · ${gate} gate`,
        text: `It ran ${high ? 'high' : 'low'}. At the ${gate} gate the forecast sat ${formatMw(Math.abs(bias))} ${high ? 'above' : 'below'} metered output on average, and the wind fell short of it in ${formatPercent(short / scored, 0)} of hours. A steady lean like that is what the learned correction takes out.`,
        figures: [
          { label: 'Average error (bias)', value: formatSignedMw(bias) },
          { label: 'Hours short', value: `${short} of ${scored}` },
          {
            label: 'Bias, learned correction',
            value: formatSignedMw(data.corrected.metrics.bias_mw),
            was: formatSignedMw(bias),
          },
        ],
        sources: [`/accuracy/summary · ${gate} gate`, daysSource(data)],
        followUps: [
          { kind: 'ask', question: 'Does the learned correction help?' },
          { kind: 'ask', question: 'Which day went worst?' },
        ],
      }
    }
    case 'help':
      return help(data)
  }
}

function help(data: AskData): Answer {
  return {
    intent: 'help',
    eyebrow: 'What I can answer',
    text: `I am a prototype that answers from this app’s numbers only, so I stick to a few kinds of question: the worst or best day, any delivery day from ${formatDay(data.meta.period.first_day)} to ${formatDay(data.meta.period.last_day)}, how much cover to hold, which auction is best, whether the forecast leans high, and what the learned correction is worth.`,
    figures: [],
    sources: [],
    followUps: SUGGESTIONS.slice(0, 4).map((question) => ({ kind: 'ask', question })),
  }
}
