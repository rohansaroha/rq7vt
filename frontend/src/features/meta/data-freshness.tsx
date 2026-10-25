import { Text } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'

import { formatUkDateTime } from '@/shared/format'

import { metaQuery } from './queries'

export function DataFreshness() {
  const { data } = useQuery(metaQuery())
  if (!data) return null
  return (
    <Text size="1" color="gray">
      {data.data_as_of ? `Data as of ${formatUkDateTime(data.data_as_of)}` : 'No data loaded yet'}
    </Text>
  )
}
