import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { formatDay } from '@/shared/format'
import { serveApi } from '@/test/api-handlers'
import { fixtures } from '@/test/fixtures'
import { renderApp } from '@/test/render'

async function suggestion(name: string, scope: HTMLElement = document.body) {
  const button = await within(scope).findByRole('button', { name })
  await waitFor(() => expect(button).toBeEnabled())
  return button
}

describe('Ask the data (prototype messenger)', () => {
  it('answers a suggested question from the API data, with its sources', async () => {
    serveApi()
    const user = userEvent.setup()
    renderApp('/ask')
    const worst = fixtures.days.days.reduce((a, b) => ((b.mae_mw ?? 0) > (a.mae_mw ?? 0) ? b : a))

    await user.click(await suggestion('Which day went worst?'))

    const log = screen.getByRole('log', { name: 'Conversation' })
    expect(
      within(log).getByText('Which day went worst?', { selector: '.bubble-user' }),
    ).toBeVisible()
    const answer = await within(log).findByRole('article', {
      name: `${formatDay(worst.day)} · 09:20 gate`,
    })
    expect(answer).toHaveTextContent('/accuracy/days · 09:20 gate')
    expect(screen.getByText('Prototype')).toBeInTheDocument()
  })

  it('answers a typed question about one day and links to it', async () => {
    serveApi()
    const user = userEvent.setup()
    renderApp('/ask')
    const input = await screen.findByRole('textbox', { name: 'Your question' })
    await suggestion('Which day went worst?')

    await user.type(input, 'How did 14 January go?{Enter}')

    expect(
      await screen.findByRole('article', { name: 'Wed 14 Jan 2026 · 09:20 gate' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open Wed 14 Jan 2026/ })).toHaveAttribute(
      'href',
      '/?day=2026-01-14&gate=09%3A20',
    )
    expect(input).toHaveValue('')
  })

  it('says what it can answer when it does not understand', async () => {
    serveApi()
    const user = userEvent.setup()
    renderApp('/ask')
    const input = await screen.findByRole('textbox', { name: 'Your question' })
    await suggestion('Which day went worst?')

    await user.type(input, 'Will it rain tomorrow?{Enter}')

    expect(await screen.findByRole('article', { name: 'What I can answer' })).toBeInTheDocument()
  })

  it('opens as a floating chat on the other pages', async () => {
    serveApi()
    const user = userEvent.setup()
    renderApp('/?day=2026-01-14')

    const [launch] = await screen.findAllByRole('button', { name: 'Ask the data' })
    await user.click(launch!)
    const window = await screen.findByRole('dialog', { name: 'Ask the data' })
    await user.click(await suggestion('Which auction gives the best forecast?', window))

    expect(
      await within(window).findByRole('article', { name: 'Auctions compared' }),
    ).toBeInTheDocument()
    await user.click(within(window).getByRole('button', { name: 'Close the chat' }))
    expect(screen.queryByRole('dialog', { name: 'Ask the data' })).not.toBeInTheDocument()
  })
})
