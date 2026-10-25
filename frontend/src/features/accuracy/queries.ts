import { queryOptions } from '@tanstack/react-query'

import { api, unwrap } from '@/shared/api/client'

/** Which forecast is scored: the run at an auction's gate, or a fixed lead time. */
export type Scoring = { mode: 'gate'; gate: string } | { mode: 'horizon'; horizon: number }

export const accuracyKeys = {
  all: ['accuracy'] as const,
  summary: (scoring: Scoring) => [...accuracyKeys.all, 'summary', scoring] as const,
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
                ? { mode: 'gate', gate: scoring.gate }
                : { mode: 'horizon', horizon_h: scoring.horizon },
          },
          signal,
        }),
      ),
  })

export const leadTimeQuery = () =>
  queryOptions({
    queryKey: accuracyKeys.leadTime(),
    queryFn: ({ signal }) => unwrap(api.GET('/api/v1/accuracy/lead-time', { signal })),
  })
