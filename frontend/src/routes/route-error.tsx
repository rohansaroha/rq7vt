import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'

import { QueryError } from '@/shared/ui/query-error'

/** Shown when a route's loader fails, e.g. the API is down when the page opens. */
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  const failure = error instanceof Error ? error : new Error(String(error))
  return <QueryError error={failure} onRetry={() => void router.invalidate()} />
}
