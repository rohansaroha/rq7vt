import { Badge } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'

import { healthQuery } from './queries'

export function HealthBadge() {
  const { data, isPending, isError } = useQuery(healthQuery())

  if (isPending) {
    return (
      <Badge color="gray" variant="soft">
        Checking API…
      </Badge>
    )
  }
  if (isError) {
    return (
      <Badge color="red" variant="soft" title="Start it with make api (or make dev)">
        API unavailable
      </Badge>
    )
  }
  if (data.database !== 'ok') {
    return (
      <Badge color="red" variant="soft" title="Start it with make db, or make local-db">
        Database unavailable
      </Badge>
    )
  }
  return (
    <Badge color="green" variant="soft">
      API v{data.version}
    </Badge>
  )
}
