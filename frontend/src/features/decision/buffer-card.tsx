import { ArrowRightIcon } from '@radix-ui/react-icons'
import { Button, Flex, Skeleton, Text } from '@radix-ui/themes'
import { Link } from '@tanstack/react-router'

import type { Schema } from '@/shared/api/client'
import { formatMw } from '@/shared/format'
import { Eyebrow } from '@/shared/ui/eyebrow'

/** The P90 shortfall at this gate over the period: the cover a 9:1 cost ratio implies. */
export function BufferCard({
  summary,
  corrected,
  gate,
}: {
  summary: Schema<'AccuracySummary'> | undefined
  /** The learned correction's summary, when the page shows it. */
  corrected?: Schema<'AccuracySummary'>
  gate: string
}) {
  return (
    <aside aria-labelledby="buffer-title" className="surface" style={{ padding: 16 }}>
      <Flex direction="column" gap="2">
        <Eyebrow tone="muted">Cover to hold</Eyebrow>
        <h2 className="card-title" id="buffer-title">
          Buffer to hold
        </h2>
        <Skeleton loading={!summary}>
          <Text size="7" weight="bold" className="stat-value">
            ≈ {formatMw(summary?.metrics.p90_mw)}
          </Text>
        </Skeleton>
        {corrected ? (
          <Text size="2" weight="medium" style={{ color: 'var(--green-11)' }}>
            With the learned correction: ≈ {formatMw(corrected.metrics.p90_mw)}
          </Text>
        ) : null}
        <Text size="2" color="gray">
          At these lead times, the wind fell short of the forecast by less than this in 9 of 10
          hours over the period (P90 shortfall).
        </Text>
        <Button asChild variant="outline" mt="1">
          <Link to="/accuracy" search={{ mode: 'gate', gate }}>
            Tune it to your costs <ArrowRightIcon />
          </Link>
        </Button>
      </Flex>
    </aside>
  )
}
