import { describe, expect, it } from 'vitest'

import { formatGwh } from '@/shared/format'
import { fixtures } from '@/test/fixtures'

import { energyHeadline, forecastSignal, watchItems, writeBriefing } from './insights'

const decision = fixtures.decision

describe('insights', () => {
  it('headlines how the wind compared with the forecast', () => {
    const short = {
      ...decision,
      summary: {
        ...decision.summary,
        actual_energy_mwh: decision.summary.forecast_energy_mwh! / 2,
      },
    }
    expect(energyHeadline(short)).toBe('Wind came in 50% below the forecast')
    const long = {
      ...decision,
      summary: {
        ...decision.summary,
        actual_energy_mwh: decision.summary.forecast_energy_mwh! * 1.2,
      },
    }
    expect(energyHeadline(long)).toBe('Wind came in 20% above the forecast')
  })

  it('says when there was nothing to bid with', () => {
    const none = { ...decision, run: null }
    expect(forecastSignal(none, fixtures.accuracyGate).title).toBe('Nothing to bid with')
  })

  it('watches the worst hour, the 9:1 cover and the correction', () => {
    const items = watchItems(decision, fixtures.accuracyGate)
    expect(items).toHaveLength(3)
    expect(items[0]).toMatch(/^Worst hour 13:00: /)
    expect(items[2]).toMatch(/^Learned correction ×0\.\d\d: typical miss/)
  })

  it('writes the briefing from the numbers it was given, and cites them', () => {
    const briefing = writeBriefing(decision, fixtures.accuracyGate, 'EPEX hourly')
    expect(briefing.text).toContain(
      'Day-ahead briefing · Wed 14 Jan 2026 · 09:20 gate (EPEX hourly)',
    )
    expect(briefing.text).toContain('07:30 WINDFOR run')
    expect(briefing.text).toContain(formatGwh(decision.summary.forecast_energy_mwh))
    expect(briefing.text).toContain(formatGwh(decision.summary.actual_energy_mwh))
    expect(briefing.sources).toEqual([
      'WINDFOR 07:30 run',
      'FUELHH · 48 half-hours',
      `09:20 gate · ${fixtures.accuracyGate.metrics.hours_scored} hours scored`,
      'Correction · 28 days to 12 Jan',
    ])
  })
})
