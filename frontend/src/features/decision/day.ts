import { clampDay } from '@/shared/dates'

/** The delivery day to show: the one asked for (kept inside the period), else the latest. */
export function resolveDay(
  requested: string | undefined,
  period: { first_day: string; last_day: string },
): string {
  return clampDay(requested ?? period.last_day, period.first_day, period.last_day)
}
