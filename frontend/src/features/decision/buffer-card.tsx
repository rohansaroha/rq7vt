import { ArrowRightIcon } from '@radix-ui/react-icons'
import { Button, Flex, Skeleton, Text } from '@radix-ui/themes'
import { Link } from '@tanstack/react-router'

import type { Schema } from '@/shared/api/client'
import { formatMw } from '@/shared/format'
import { Eyebrow } from '@/shared/ui/eyebrow'

/** The P90 shortfall at this gate over the period: the cover a 9:1 cost ratio implies. */
export function BufferCard({
  summary,
  gate,
}: {
  summary: Schema<'AccuracySummary'> | undefined
  gate: string
}) {
  return (
    <aside aria-labelledby="buffer-title" className="surface" style={{ padding: 20 }}>
      <Flex direction="column" gap="2" height="100%">
        <Eyebrow tone="muted">Cover to hold</Eyebrow>
        <h2 className="card-title" id="buffer-title">
          Buffer to hold
        </h2>
        <Skeleton loading={!summary}>
          <Text size="7" weight="bold" className="stat-value">
            ≈ {formatMw(summary?.metrics.p90_mw)}
          </Text>
        </Skeleton>
        <Text size="2" color="gray">
          At these lead times, the wind fell short of the forecast by less than this in 9 of 10
          hours over the period (P90 shortfall).
        </Text>
        <Button asChild variant="outline" mt="auto">
          <Link to="/accuracy" search={{ mode: 'gate', gate }}>
            Tune it to your costs <ArrowRightIcon />
          </Link>
        </Button>
      </Flex>
    </aside>
  )
}
