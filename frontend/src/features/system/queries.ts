import { queryOptions } from '@tanstack/react-query'

import { api, ApiError, type Schema } from '@/shared/api/client'

export const systemKeys = {
  all: ['system'] as const,
  health: () => [...systemKeys.all, 'health'] as const,
}

function isHealth(value: unknown): value is Schema<'HealthResponse'> {
  return typeof value === 'object' && value !== null && 'database' in value
}

export const healthQuery = () =>
  queryOptions({
    queryKey: systemKeys.health(),
    // A 503 still carries a health report (database down), which is worth showing.
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET('/api/v1/health', { signal })
      if (data) return data
      if (isHealth(error)) return error
      throw new ApiError(response.status, undefined)
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  })
