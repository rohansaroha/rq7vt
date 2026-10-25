import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { formatDay } from '@/shared/format'
import { serveApi } from '@/test/api-handlers'
import { fixtures } from '@/test/fixtures'
import { renderApp } from '@/test/render'

describe('Ask the data (prototype)', () => {
  it('answers a suggested question from the API data', async () => {
    serveApi()
    const user = userEvent.setup()
    renderApp('/ask')
    const worst = fixtures.days.days.reduce((a, b) => ((b.mae_mw ?? 0) > (a.mae_mw ?? 0) ? b : a))

    const suggestion = await screen.findByRole('button', { name: 'Which day went worst?' })
    await waitFor(() => expect(suggestion).toBeEnabled())
    await user.click(suggestion)

    const answer = await screen.findByRole('article', {
      name: `${formatDay(worst.day)} · 09:20 gate`,
    })
    expect(answer).toHaveTextContent('/accuracy/days · 09:20 gate')
    expect(screen.getByText('Prototype')).toBeInTheDocument()
  })

  it('answers a typed question about one day', async () => {
    serveApi()
    const user = userEvent.setup()
    renderApp('/ask')
    const input = await screen.findByRole('textbox', { name: 'Your question' })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Which day went worst?' })).toBeEnabled(),
    )

    await user.type(input, 'How did 14 January go?{Enter}')

    expect(
      await screen.findByRole('article', { name: 'Wed 14 Jan 2026 · 09:20 gate' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open Wed 14 Jan 2026/ })).toHaveAttribute(
      'href',
      '/?day=2026-01-14&gate=09%3A20',
    )
  })

  it('says what it can answer when it does not understand', async () => {
    serveApi()
    const user = userEvent.setup()
    renderApp('/ask')
    const input = await screen.findByRole('textbox', { name: 'Your question' })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Which day went worst?' })).toBeEnabled(),
    )

    await user.type(input, 'Will it rain tomorrow?{Enter}')

    expect(await screen.findByRole('article', { name: 'What I can answer' })).toBeInTheDocument()
  })
})
