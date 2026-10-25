import { Flex, Skeleton, Text } from '@radix-ui/themes'
import type { ReactNode } from 'react'

import { InfoTip } from './info-tip'

/** A single figure: label (with its definition), value, a change line and a one-line note. */
export function StatTile({
  label,
  value,
  note,
  badge,
  info,
  delta,
  loading = false,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  badge?: ReactNode
  info?: string
  delta?: ReactNode
  loading?: boolean
}) {
  return (
    <div className="stat-tile">
      <Flex direction="column" gap="1">
        <Flex align="center" justify="between" gap="2" minHeight="20px">
          <Flex align="center" gap="1">
            <span className="stat-label">{label}</span>
            {info ? <InfoTip term={label} text={info} /> : null}
          </Flex>
          {badge}
        </Flex>
        <Skeleton loading={loading}>
          <Text as="div" size="6" weight="bold" className="stat-value">
            {value}
          </Text>
        </Skeleton>
        {delta ? (
          <Text as="div" size="1" className="delta">
            {delta}
          </Text>
        ) : null}
        {note ? (
          <Skeleton loading={loading}>
            <Text as="div" size="1" color="gray">
              {note}
            </Text>
          </Skeleton>
        ) : null}
      </Flex>
    </div>
  )
}
