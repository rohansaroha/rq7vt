import { Card, Flex, Skeleton, Text } from '@radix-ui/themes'
import type { ReactNode } from 'react'

/** A single figure with its label and a one-line note (label · value · note). */
export function StatTile({
  label,
  value,
  note,
  badge,
  loading = false,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  badge?: ReactNode
  loading?: boolean
}) {
  return (
    <Card size="2" className="stat-tile">
      <Flex direction="column" gap="1">
        <Flex align="center" justify="between" gap="2">
          <Text size="1" weight="medium" color="gray">
            {label}
          </Text>
          {badge}
        </Flex>
        <Skeleton loading={loading}>
          <Text as="div" size="6" weight="bold" className="stat-value">
            {value}
          </Text>
        </Skeleton>
        {note ? (
          <Skeleton loading={loading}>
            <Text as="div" size="1" color="gray">
              {note}
            </Text>
          </Skeleton>
        ) : null}
      </Flex>
    </Card>
  )
}
