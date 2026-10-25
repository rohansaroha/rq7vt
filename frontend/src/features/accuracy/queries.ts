import { queryOptions } from '@tanstack/react-query'

import { api, unwrap } from '@/shared/api/client'

export type Forecast = 'published' | 'corrected'

/**
 * Which forecast is scored: the run at an auction's gate (as published, or with the
 * learned correction applied), or the latest run at a fixed lead time.
 */
export type Scoring =
  { mode: 'gate'; gate: string; forecast?: Forecast } | { mode: 'horizon'; horizon: number }

export const accuracyKeys = {
  all: ['accuracy'] as const,
  summary: (scoring: Scoring) =>
    [
      ...accuracyKeys.all,
      'summary',
      scoring.mode === 'gate' ? { ...scoring, forecast: scoring.forecast ?? 'published' } : scoring,
    ] as const,
  days: (gate: string) => [...accuracyKeys.all, 'days', gate] as const,
  leadTime: () => [...accuracyKeys.all, 'lead-time'] as const,
}

export const accuracySummaryQuery = (scoring: Scoring) =>
  queryOptions({
    queryKey: accuracyKeys.summary(scoring),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/api/v1/accuracy/summary', {
          params: {
            query:
              scoring.mode === 'gate'
                ? { mode: 'gate', gate: scoring.gate, forecast: scoring.forecast ?? 'published' }
                : { mode: 'horizon', horizon_h: scoring.horizon },
          },
          signal,
        }),
      ),
  })

export const daysQuery = (gate: string) =>
  queryOptions({
    queryKey: accuracyKeys.days(gate),
    queryFn: ({ signal }) =>
      unwrap(api.GET('/api/v1/accuracy/days', { params: { query: { gate } }, signal })),
  })

export const leadTimeQuery = () =>
  queryOptions({
    queryKey: accuracyKeys.leadTime(),
    queryFn: ({ signal }) => unwrap(api.GET('/api/v1/accuracy/lead-time', { signal })),
  })
