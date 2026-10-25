import { http, HttpResponse } from 'msw'

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
      return HttpResponse.json(
        url.searchParams.get('mode') === 'horizon'
          ? fixtures.accuracyHorizon6
          : fixtures.accuracyGate,
      )
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
