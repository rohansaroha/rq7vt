import { Flex, Text } from '@radix-ui/themes'
import { useDeferredValue, useState } from 'react'

import type { Schema } from '@/shared/api/client'
import { formatMw, formatPercent } from '@/shared/format'
import { RangeSlider } from '@/shared/ui/range-slider'

import { ErrorHistogram } from './error-histogram'

/**
 * Size the cover from the cost of being short relative to being long (the newsvendor
 * rule). Every ratio's answer is already in the summary, so the slider never waits on
 * the network; the histogram re-renders from a deferred value so dragging stays smooth.
 */
export function BufferPanel({
  summary,
  ratio,
  onRatioCommit,
}: {
  summary: Schema<'AccuracySummary'>
  ratio: number
  onRatioCommit: (ratio: number) => void
}) {
  // While dragging, show the slider's value; otherwise the committed one from the URL.
  const [dragging, setDragging] = useState<number | null>(null)
  const live = dragging ?? ratio
  const deferred = useDeferredValue(live)

  const option = summary.buffers.find((b) => b.cost_ratio === live)
  const deferredOption = summary.buffers.find((b) => b.cost_ratio === deferred) ?? option
  const ratioText = live === 1 ? 'Equal cost' : `Short costs ${live}× more`

  return (
    <Flex direction="column" gap="3">
      <Flex direction="column" gap="1">
        <Text size="1" weight="bold" color="gray">
          How much more does being short cost than being long?
        </Text>
        <Flex align="center" gap="3" wrap="wrap">
          <RangeSlider
            label="Cost of being short relative to being long"
            valueText={ratioText}
            value={live}
            min={1}
            max={20}
            onChange={setDragging}
            onCommit={(value) => {
              onRatioCommit(value)
              setDragging(null)
            }}
          />
          <Text weight="bold" style={{ minWidth: 150 }}>
            {ratioText}
          </Text>
        </Flex>
      </Flex>
      {option ? (
        <Flex
          direction="column"
          gap="1"
          p="3"
          style={{ background: 'var(--orange-a2)', borderRadius: 'var(--radius-3)' }}
        >
          <Flex align="baseline" gap="2" wrap="wrap">
            <Text weight="bold">Hold</Text>
            <Text size="7" weight="bold" className="stat-value">
              {formatMw(option.buffer_mw)}
            </Text>
            <Text weight="bold">of extra cover</Text>
          </Flex>
          <Text size="1" color="gray" className="tabular">
            q* = {live} ÷ ({live} + 1) = {option.quantile.toFixed(2)}. Over this period it would
            have covered the shortfall in {formatPercent(option.covered_share, 0)} of hours.
          </Text>
        </Flex>
      ) : null}
      {deferredOption ? (
        <ErrorHistogram bins={summary.histogram.bins} bufferMw={deferredOption.buffer_mw} />
      ) : null}
    </Flex>
  )
}
