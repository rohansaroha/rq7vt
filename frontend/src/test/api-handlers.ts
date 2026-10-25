import { http, HttpResponse } from 'msw'

import type { Schema } from '@/shared/api/client'

import { fixtures } from './fixtures'
import { server } from './server'

/** Serve the whole API from fixtures, recording each request's URL for assertions. */
export function serveApi() {
  const requests: URL[] = []
  const record = (request: Request) => {
    const url = new URL(request.url)
    requests.push(url)
    return url
  }
  server.use(
    http.get('*/api/v1/health', () =>
      HttpResponse.json({ status: 'ok', database: 'ok', version: '0.1.0' }),
    ),
    http.get('*/api/v1/meta', () => HttpResponse.json(fixtures.meta)),
    http.get('*/api/v1/forecasts/decision', ({ request }) => {
      const url = record(request)
      return HttpResponse.json(
        url.searchParams.get('gate') === '15:30' ? fixtures.decision1530 : fixtures.decision,
      )
    }),
    http.get('*/api/v1/forecasts/runs', ({ request }) => {
      record(request)
      return HttpResponse.json(fixtures.runs)
    }),
    http.get('*/api/v1/accuracy/summary', ({ request }) => {
      const url = record(request)
      const query = url.searchParams
      if (query.get('mode') === 'horizon') return HttpResponse.json(fixtures.accuracyHorizon6)
      if (query.get('forecast') === 'corrected') {
        return HttpResponse.json(fixtures.accuracyGateCorrected)
      }
      const byGate: Record<string, Schema<'AccuracySummary'>> = {
        '09:50': fixtures.accuracyGate0950,
        '15:30': fixtures.accuracyGate1530,
      }
      return HttpResponse.json(byGate[query.get('gate') ?? ''] ?? fixtures.accuracyGate)
    }),
    http.get('*/api/v1/accuracy/days', ({ request }) => {
      record(request)
      return HttpResponse.json(fixtures.days)
    }),
    http.get('*/api/v1/accuracy/lead-time', ({ request }) => {
      record(request)
      return HttpResponse.json(fixtures.leadTime)
    }),
  )
  return requests
}

export function lastRequest(requests: URL[], path: string): URL | undefined {
  return requests.filter((url) => url.pathname === path).at(-1)
}
