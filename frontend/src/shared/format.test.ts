import { describe, expect, it } from 'vitest'

import { addDays, clampDay, isDay } from './dates'
import {
  formatDay,
  formatGwTick,
  formatGwh,
  formatHours,
  formatMw,
  formatSignedMw,
  formatUkDateTime,
  formatUkTime,
  formatUkWeekday,
} from './format'

describe('formatting', () => {
  it('formats megawatts, signed values and energy', () => {
    expect(formatMw(1234.6)).toBe('1,235 MW')
    expect(formatMw(null)).toBe('–')
    expect(formatSignedMw(300)).toBe('+300 MW')
    expect(formatSignedMw(-300)).toBe('−300 MW')
    expect(formatGwh(321_318)).toBe('321 GWh')
    expect(formatGwTick(12_500)).toBe('12.5 GW')
    expect(formatHours(14.5)).toBe('14.5 h')
    expect(formatHours(26)).toBe('26 h')
  })

  it('shows times on the UK clock, including summer time', () => {
    expect(formatUkTime('2026-01-13T08:30:00Z')).toBe('08:30')
    expect(formatUkTime('2026-07-01T08:30:00Z')).toBe('09:30')
  })

  it('labels days and instants the same way on every ICU version', () => {
    expect(formatDay('2026-01-14')).toBe('Wed 14 Jan 2026')
    expect(formatUkWeekday('2026-01-13T08:30:00Z')).toBe('Tue 13 Jan')
    expect(formatUkDateTime('2026-02-03T06:00:00Z')).toBe('3 Feb 2026, 06:00')
  })
})

describe('delivery days', () => {
  it('adds days across months and clock changes', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-01-02', -1)).toBe('2026-01-01')
  })

  it('rejects impossible dates and clamps to the period', () => {
    expect(isDay('2026-02-30')).toBe(false)
    expect(isDay('2026-1-5')).toBe(false)
    expect(isDay('2026-01-14')).toBe(true)
    expect(clampDay('2025-12-31', '2026-01-02', '2026-02-01')).toBe('2026-01-02')
  })
})
