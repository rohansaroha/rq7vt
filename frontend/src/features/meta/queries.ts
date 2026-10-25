import { queryOptions } from '@tanstack/react-query'

import { api, unwrap } from '@/shared/api/client'

export const metaKeys = {
  all: ['meta'] as const,
}

/** Period, auctions, horizons and data freshness: the app builds its controls from this. */
export const metaQuery = () =>
  queryOptions({
    queryKey: metaKeys.all,
    queryFn: ({ signal }) => unwrap(api.GET('/api/v1/meta', { signal })),
    staleTime: 60_000,
  })
