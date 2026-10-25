import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'

import { HealthBadge } from './health-badge'

describe('HealthBadge', () => {
  it('shows the API version when the API and database are up', async () => {
    server.use(
      http.get('*/api/v1/health', () =>
        HttpResponse.json({ status: 'ok', database: 'ok', version: '0.1.0' }),
      ),
    )

    renderWithProviders(<HealthBadge />)

    expect(await screen.findByText('API v0.1.0')).toBeInTheDocument()
  })

  it('says the database is unavailable when the API reports it down', async () => {
    server.use(
      http.get('*/api/v1/health', () =>
        HttpResponse.json(
          { status: 'degraded', database: 'unavailable', version: '0.1.0' },
          { status: 503 },
        ),
      ),
    )

    renderWithProviders(<HealthBadge />)

    expect(await screen.findByText('Database unavailable')).toBeInTheDocument()
  })

  it('says the API is unavailable when it cannot be reached', async () => {
    server.use(http.get('*/api/v1/health', () => HttpResponse.error()))

    renderWithProviders(<HealthBadge />)

    expect(await screen.findByText('API unavailable')).toBeInTheDocument()
  })
})
