import { queryOptions } from '@tanstack/react-query'

import { api, unwrap } from '@/shared/api/client'

export const decisionKeys = {
  all: ['decision'] as const,
  day: (day: string, gate: string) => [...decisionKeys.all, day, gate] as const,
  runs: (day: string) => [...decisionKeys.all, 'runs', day] as const,
}

export const decisionQuery = (day: string, gate: string) =>
  queryOptions({
    queryKey: decisionKeys.day(day, gate),
    queryFn: ({ signal }) =>
      unwrap(api.GET('/api/v1/forecasts/decision', { params: { query: { day, gate } }, signal })),
  })

export const runsQuery = (day: string) =>
  queryOptions({
    queryKey: decisionKeys.runs(day),
    queryFn: ({ signal }) =>
      unwrap(api.GET('/api/v1/forecasts/runs', { params: { query: { day } }, signal })),
  })
