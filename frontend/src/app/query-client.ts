import { QueryClient } from '@tanstack/react-query'

import { ApiError } from '@/shared/api/client'

/** Shared defaults. Historical data never changes, so most queries stay fresh for long. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // Retry network and server failures, never a 4xx: asking again won't fix our request.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
    },
  })
}
