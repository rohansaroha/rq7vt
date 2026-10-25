import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { lastRequest, serveApi } from '@/test/api-handlers'
import { fixtures } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

const DECISION = '/api/v1/forecasts/decision'

describe('Decision view', () => {
  it('says which run was used at the gate and how far ahead it looked', async () => {
    serveApi()
    renderApp('/?day=2026-01-14')

    const callout = await screen.findByText(/You bid with the/)
    expect(callout).toHaveTextContent('07:30 run')
    expect(callout).toHaveTextContent('15.5 h to 38.5 h')
    expect(screen.getByText('Wed 14 Jan 2026')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Line chart of actual wind generation/ })).toBeVisible()
  })

  it('refetches with the new gate when the auction changes', async () => {
    const requests = serveApi()
    const user = userEvent.setup()
    renderApp('/?day=2026-01-14')
    await screen.findByText(/You bid with the/)

    await user.click(screen.getByRole('radio', { name: /15:30/ }))

    expect(await screen.findByText(/11:30 run/, { selector: 'strong' })).toBeInTheDocument()
    expect(lastRequest(requests, DECISION)?.searchParams.get('gate')).toBe('15:30')
  })

  it('moves to the next delivery day', async () => {
    const requests = serveApi()
    const user = userEvent.setup()
    renderApp('/?day=2026-01-14')
    await screen.findByText(/You bid with the/)

    await user.click(screen.getByRole('button', { name: 'Next day' }))

    expect(await screen.findByText('Thu 15 Jan 2026')).toBeInTheDocument()
    expect(lastRequest(requests, DECISION)?.searchParams.get('day')).toBe('2026-01-15')
  })

  it('adds a run to the chart key when it is picked for comparison', async () => {
    serveApi()
    const user = userEvent.setup()
    renderApp('/?day=2026-01-14')
    const runs = await screen.findByRole('group', { name: 'Forecast runs' })

    await user.click(within(runs).getByRole('button', { name: /^11:30 run, After gate/ }))

    expect(await screen.findByText('11:30 run (compare)')).toBeInTheDocument()
    expect(within(runs).getByRole('button', { name: /^11:30 run/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('draws the learned correction when it is switched on', async () => {
    serveApi()
    const user = userEvent.setup()
    renderApp('/?day=2026-01-14')
    await screen.findByText(/You bid with the/)

    await user.click(screen.getByRole('checkbox', { name: 'Show learned correction' }))

    const factor = fixtures.decision.correction?.factor.toFixed(2)
    expect(await screen.findByText(`Learned correction (×${factor})`)).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(`Correction for this day: ×${factor}, learned from 16 Dec`)),
    ).toBeInTheDocument()
  })

  it('writes the daily briefing from the day’s numbers, labelled as a prototype', async () => {
    serveApi()
    const user = userEvent.setup()
    renderApp('/?day=2026-01-14')

    await user.click(await screen.findByRole('button', { name: 'Write the briefing' }))

    const briefing = await screen.findByText(/Day-ahead briefing · Wed 14 Jan 2026 · 09:20 gate/)
    expect(briefing).toHaveTextContent('07:30 WINDFOR run')
    expect(briefing).toHaveTextContent(`×${fixtures.decision.correction?.factor.toFixed(2)}`)
    const card = screen.getByRole('region', { name: 'Daily briefing' })
    expect(within(card).getByText('Prototype')).toBeInTheDocument()
    expect(within(card).getByText('WINDFOR 07:30 run')).toBeInTheDocument()
  })

  it('shows every hour in the table view', async () => {
    serveApi()
    const user = userEvent.setup()
    renderApp('/?day=2026-01-14')
    await screen.findByText(/You bid with the/)

    const card = screen.getByRole('region', { name: /Forecast at bid vs actual/ })
    await user.click(within(card).getByRole('radio', { name: 'Table' }))

    expect(within(card).getAllByRole('rowheader')).toHaveLength(24)
  })

  it('shows the API problem when the request fails', async () => {
    serveApi()
    server.use(
      http.get('*/api/v1/forecasts/decision', () =>
        HttpResponse.json(
          {
            type: '/problems/out-of-range',
            title: 'Out of range',
            status: 422,
            detail: 'Pick a day in January.',
          },
          { status: 422, headers: { 'x-request-id': 'abc123' } },
        ),
      ),
    )
    renderApp('/?day=2026-01-14')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Pick a day in January. (request abc123)',
    )
  })
})

describe('Decision view before any data is loaded', () => {
  it('says to run the ingestion', async () => {
    serveApi()
    server.use(
      http.get('*/api/v1/meta', () =>
        HttpResponse.json({
          ...fixtures.meta,
          data_as_of: null,
          datasets: fixtures.meta.datasets.map((d) => ({ ...d, rows: 0 })),
        }),
      ),
    )
    renderApp('/?day=2026-01-14')

    expect(await screen.findByText(/No data has been loaded yet/)).toBeInTheDocument()
  })
})
