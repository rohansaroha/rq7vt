import { describe, expect, it } from 'vitest'

import { formatDay, formatMw } from '@/shared/format'
import { fixtures } from '@/test/fixtures'

import { answerQuestion, matchIntent, parseDay, type AskData } from './answers'

const data: AskData = {
  meta: fixtures.meta,
  gate: '09:20',
  days: fixtures.days.days,
  summaries: {
    '09:20': fixtures.accuracyGate,
    '09:50': fixtures.accuracyGate0950,
    '15:30': fixtures.accuracyGate1530,
  },
  corrected: fixtures.accuracyGateCorrected,
  leadTime: fixtures.leadTime,
}

describe('parseDay', () => {
  it.each([
    ['How did 14 January go?', '2026-01-14'],
    ['what about jan 3rd', '2026-01-03'],
    ['show me 2026-01-28', '2026-01-28'],
    ['and the 28th?', '2026-01-28'],
    ['1 Feb', '2026-02-01'],
    ['Which day went worst?', null],
  ])('%s', (question, expected) => {
    expect(parseDay(question)).toBe(expected)
  })
})

describe('matchIntent', () => {
  it.each([
    ['Which day went worst?', 'worst-day'],
    ['Which day went best?', 'best-day'],
    ['How much cover should we hold?', 'buffer'],
    ['Which auction gives the best forecast?', 'best-gate'],
    ['Does the learned correction help?', 'correction'],
    ['Does it get better closer to delivery?', 'lead'],
    ['Does the forecast run high or low?', 'bias'],
    ['How did 14 January go?', 'day'],
    ['Will it rain tomorrow?', 'help'],
  ])('%s', (question, intent) => {
    expect(matchIntent(question)).toBe(intent)
  })
})

describe('answerQuestion', () => {
  it('names the worst day and offers to open it', () => {
    const worst = data.days.reduce((a, b) => ((b.mae_mw ?? 0) > (a.mae_mw ?? 0) ? b : a))
    const answer = answerQuestion('Which day went worst?', data)
    expect(answer.text).toContain(`${formatDay(worst.day)} went worst at the 09:20 gate`)
    expect(answer.followUps[0]).toMatchObject({ kind: 'day', day: worst.day, gate: '09:20' })
  })

  it('compares the auctions', () => {
    const answer = answerQuestion('Which auction gives the best forecast?', data)
    expect(answer.text).toMatch(/^The 15:30 auction/)
    expect(answer.figures).toHaveLength(3)
  })

  it('shows the correction as published → corrected', () => {
    const answer = answerQuestion('Does the learned correction help?', data)
    expect(answer.figures[0]).toEqual({
      label: 'Typical miss',
      value: formatMw(fixtures.accuracyGateCorrected.metrics.mae_mw),
      was: formatMw(fixtures.accuracyGate.metrics.mae_mw),
    })
  })

  it('stays inside the period', () => {
    const answer = answerQuestion('What happened on 2 Feb?', data)
    expect(answer.text).toMatch(/^I only have delivery days/)
  })

  it('says what it can answer when it does not understand', () => {
    expect(answerQuestion('Will it rain tomorrow?', data).intent).toBe('help')
  })
})
