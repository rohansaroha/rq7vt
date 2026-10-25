import { Box, Flex, Text } from '@radix-ui/themes'
import type { ReactNode } from 'react'

/** A tooltip pinned inside a chart's (position: relative) frame, flipped near the right edge. */
export function ChartTooltip({
  x,
  y,
  width,
  title,
  children,
}: {
  x: number
  y: number
  width: number
  title: string
  children: ReactNode
}) {
  const flip = x > width - 220
  return (
    <Box
      className="chart-tooltip"
      style={{
        left: flip ? undefined : x + 12,
        right: flip ? width - x + 12 : undefined,
        top: y,
      }}
    >
      <Text as="div" size="1" color="gray" mb="1">
        {title}
      </Text>
      <Flex direction="column" gap="1">
        {children}
      </Flex>
    </Box>
  )
}

/** Value first (strong), then the series name: the reader already knows which series. */
export function TooltipRow({
  color,
  dashed,
  value,
  label,
}: {
  color?: string
  dashed?: boolean
  value: string
  label: string
}) {
  return (
    <Flex align="center" gap="2">
      {color ? (
        <svg width="12" height="8" aria-hidden="true">
          <line
            x1="1"
            x2="11"
            y1="4"
            y2="4"
            stroke={color}
            strokeWidth="2"
            strokeDasharray={dashed ? '3 2' : undefined}
          />
        </svg>
      ) : (
        <span style={{ width: 12 }} />
      )}
      <Text size="2" weight="bold">
        {value}
      </Text>
      <Text size="1" color="gray">
        {label}
      </Text>
    </Flex>
  )
}
