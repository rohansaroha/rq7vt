/**
 * Delivery days are calendar dates (YYYY-MM-DD) with no time zone. Date arithmetic is
 * done at UTC noon, so no clock change or viewer time zone can move a day.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function isDay(value: string): boolean {
  if (!DAY.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** ISO dates compare correctly as strings. */
export function clampDay(day: string, first: string, last: string): string {
  if (day < first) return first
  if (day > last) return last
  return day
}
