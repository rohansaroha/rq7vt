/**
 * Display formatting. Times are always shown in UK time, whatever the viewer's own
 * time zone, because that is the clock the GB market trades on.
 */

const UK = 'Europe/London'
const MINUS = '−'
const DASH = '–'

const integer = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

export const EMPTY = DASH

export function formatMw(mw: number | null | undefined): string {
  return mw == null ? EMPTY : `${integer.format(mw)} MW`
}

/** Signed, with a true minus sign: +1,200 MW or −300 MW. */
export function formatSignedMw(mw: number | null | undefined): string {
  if (mw == null) return EMPTY
  const sign = mw > 0 ? '+' : mw < 0 ? MINUS : ''
  return `${sign}${integer.format(Math.abs(mw))} MW`
}

/** Axis ticks: 0, 4 GW, 12.5 GW. */
export function formatGwTick(mw: number): string {
  if (mw === 0) return '0'
  const gw = mw / 1000
  return `${gw < 0 ? MINUS : ''}${compact.format(Math.abs(gw))} GW`
}

export function formatGwh(mwh: number | null | undefined): string {
  return mwh == null ? EMPTY : `${integer.format(mwh / 1000)} GWh`
}

export function formatPercent(share: number | null | undefined, digits = 1): string {
  if (share == null) return EMPTY
  return `${(share * 100).toFixed(digits)}%`
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return EMPTY
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`
}

const clock = new Intl.DateTimeFormat('en-GB', { timeZone: UK, hour: '2-digit', minute: '2-digit' })
const ukParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const dayParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

// Labels are assembled from parts: ICU versions disagree on separators ("Wed, 14 Jan"
// or "Wed 14 Jan", "06:00" or "at 06:00"), and the app should read the same everywhere.
function parts(format: Intl.DateTimeFormat, date: Date): Record<string, string> {
  return Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]))
}

/** "08:30", UK time. */
export function formatUkTime(instant: string): string {
  return clock.format(new Date(instant))
}

/** "Tue 13 Jan", the UK calendar day of an instant. */
export function formatUkWeekday(instant: string): string {
  const p = parts(ukParts, new Date(instant))
  return `${p.weekday} ${p.day} ${p.month}`
}

/** "3 Feb 2026, 06:00", UK time. */
export function formatUkDateTime(instant: string): string {
  const p = parts(ukParts, new Date(instant))
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`
}

/** "Wed 14 Jan 2026" for a delivery day (a calendar date, YYYY-MM-DD). */
export function formatDay(day: string): string {
  const p = parts(dayParts, new Date(`${day}T12:00:00Z`))
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`
}
