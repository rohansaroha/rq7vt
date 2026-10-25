import { Flex, Text } from '@radix-ui/themes'
import type { ReactNode } from 'react'

type Key =
  | { kind: 'line'; color: string; dashed?: boolean }
  | { kind: 'area'; color: string }
  | { kind: 'rule'; color: string }

export function LegendItem({ marker, children }: { marker: Key; children: ReactNode }) {
  return (
    <Flex as="span" align="center" gap="2">
      {marker.kind === 'rule' ? (
        <svg width="18" height="12" aria-hidden="true">
          <line x1="9" x2="9" y1="0" y2="12" stroke={marker.color} strokeWidth="2" />
        </svg>
      ) : marker.kind === 'line' ? (
        <svg width="18" height="10" aria-hidden="true">
          <line
            x1="1"
            x2="17"
            y1="5"
            y2="5"
            stroke={marker.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={marker.dashed ? '4 3' : undefined}
          />
        </svg>
      ) : (
        <svg width="18" height="10" aria-hidden="true">
          <rect width="18" height="10" rx="2" fill={marker.color} />
        </svg>
      )}
      <Text size="1" color="gray">
        {children}
      </Text>
    </Flex>
  )
}

export function Legend({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Flex role="list" aria-label={label} align="center" gap="4" wrap="wrap">
      {children}
    </Flex>
  )
}
