import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { formatMw } from '@/shared/format'
import { lastRequest, serveApi } from '@/test/api-handlers'
import { fixtures } from '@/test/fixtures'
import { renderApp } from '@/test/render'

const SUMMARY = '/api/v1/accuracy/summary'

describe('Accuracy view', () => {
  it('scores the run at the 09:20 gate by default', async () => {
    const requests = serveApi()
    renderApp('/accuracy')

    expect(
      await screen.findByText(formatMw(fixtures.accuracyGate.metrics.mae_mw)),
    ).toBeInTheDocument()
    expect(lastRequest(requests, SUMMARY)?.searchParams.get('gate')).toBe('09:20')
    expect(
      await screen.findByRole('img', { name: /typical miss and the P90 shortfall/ }),
    ).toBeVisible()
  })

  it('resizes the buffer from the cost ratio without asking the API again', async () => {
    const requests = serveApi()
    const user = userEvent.setup()
    renderApp('/accuracy')
    const slider = await screen.findByRole('slider', { name: /Cost of being short/ })
    const before = requests.length

    await act(async () => slider.focus())
    await user.keyboard('{ArrowRight}')

    const ratio10 = fixtures.accuracyGate.buffers.find((b) => b.cost_ratio === 10)
    expect(await screen.findByText('Short costs 10× more')).toBeInTheDocument()
    expect(screen.getAllByText(formatMw(ratio10?.buffer_mw)).length).toBeGreaterThan(0)
    expect(requests.filter((url) => url.pathname === SUMMARY).length).toBe(
      requests.slice(0, before).filter((url) => url.pathname === SUMMARY).length,
    )
  })

  it('scores a lead time picked in the heatmap', async () => {
    const requests = serveApi()
    const user = userEvent.setup()
    renderApp('/accuracy')

    await user.click(await screen.findByRole('button', { name: 'Score lead time 4 to 7 hours' }))

    expect(
      await screen.findByText(/Latest run published at least 6 hours before each hour/),
    ).toBeInTheDocument()
    const request = lastRequest(requests, SUMMARY)
    expect(request?.searchParams.get('mode')).toBe('horizon')
    expect(request?.searchParams.get('horizon_h')).toBe('6')
    expect(screen.getByRole('slider', { name: 'Lead time' })).toHaveAttribute('aria-valuenow', '6')
  })
})
