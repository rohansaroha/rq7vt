import { Flex, Text } from '@radix-ui/themes'

import type { Schema } from '@/shared/api/client'
import { formatMw, formatUkTime } from '@/shared/format'
import { RangeSlider } from '@/shared/ui/range-slider'

import { GapBadge } from './gap-badge'

/** The keyboard-friendly way to read the chart: one hour at a time. */
export function HourInspector({
  points,
  index,
  onChange,
}: {
  points: Schema<'DecisionPoint'>[]
  index: number
  onChange: (index: number) => void
}) {
  const point = points[index]
  if (!point) return null
  const time = formatUkTime(point.start_time)
  return (
    <Flex align="center" gap="4" wrap="wrap" pt="3" className="inspector">
      <Text size="1" weight="bold" color="gray">
        Inspect an hour
      </Text>
      <RangeSlider
        label="Inspect an hour"
        valueText={`${time} hour`}
        value={index}
        min={0}
        max={points.length - 1}
        onChange={onChange}
      />
      <Flex align="center" gap="2" wrap="wrap" aria-live="polite">
        <Text size="2" className="tabular">
          {time} · forecast {formatMw(point.forecast_mw)} · actual {formatMw(point.actual_mw)}
        </Text>
        <GapBadge errorMw={point.error_mw} />
      </Flex>
    </Flex>
  )
}
