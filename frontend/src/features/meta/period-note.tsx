import { Text } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'

import { formatDay } from '@/shared/format'

import { metaQuery } from './queries'

/** The delivery days the app covers, from the API. */
export function PeriodNote() {
  const { data } = useQuery(metaQuery())
  if (!data) return null
  return (
    <Text size="1" color="gray">
      Delivery days {formatDay(data.period.first_day)} to {formatDay(data.period.last_day)}
    </Text>
  )
}
