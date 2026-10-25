import { Badge, Flex, Text } from '@radix-ui/themes'
import { Fragment } from 'react'

import type { Schema } from '@/shared/api/client'
import { formatMw, formatUkTime, formatUkWeekday } from '@/shared/format'
import { Eyebrow } from '@/shared/ui/eyebrow'

import { driftLine } from './insights'

type Status = 'used' | 'earlier' | 'after'

const STATUS: Record<
  Status,
  { label: string; color: 'blue' | 'gray'; variant: 'soft' | 'outline' }
> = {
  used: { label: 'Used for bid', color: 'blue', variant: 'soft' },
  earlier: { label: 'Earlier run', color: 'gray', variant: 'soft' },
  after: { label: 'After gate', color: 'gray', variant: 'outline' },
}

/** Every run published the day before delivery, with the gate drawn where it fell. */
export function RunsStrip({
  runs,
  usedPublishTime,
  gate,
  compare,
  onCompare,
}: {
  runs: Schema<'ForecastRun'>[]
  usedPublishTime: string | undefined
  gate: Schema<'Gate'>
  compare: string | undefined
  onCompare: (publishTime: string | undefined) => void
}) {
  // API timestamps are UTC ISO strings, so they compare correctly as text. A run published
  // as the gate closes is too late to bid on, so it already counts as after the gate.
  const firstAfterGate = runs.findIndex((run) => run.publish_time >= gate.closes_at)
  const first = runs[0]
  const drift = driftLine(runs, usedPublishTime)
  return (
    <section aria-labelledby="runs-title" className="surface" style={{ padding: 20 }}>
      <Flex direction="column" gap="3">
        <div>
          <Eyebrow tone="muted">Forecast drift</Eyebrow>
          <h2 className="card-title" id="runs-title" style={{ marginTop: 6 }}>
            Every forecast run for this day
          </h2>
          <Text as="p" size="2" color="gray" mt="1">
            {first ? `Runs published on ${formatUkWeekday(first.publish_time)}. ` : null}
            Later runs are usually closer, but only runs before the gate could be traded on. Pick a
            run to compare it on the chart.
          </Text>
          {drift ? (
            <Text as="p" size="2" mt="2" weight="medium" style={{ color: 'var(--brand-ink)' }}>
              {drift}
            </Text>
          ) : null}
        </div>
        {runs.length === 0 ? (
          <Text color="gray">No runs were published the day before.</Text>
        ) : (
          <Flex gap="2" wrap="wrap" align="stretch" role="group" aria-label="Forecast runs">
            {runs.map((run, index) => {
              const status: Status =
                run.publish_time === usedPublishTime
                  ? 'used'
                  : run.publish_time >= gate.closes_at
                    ? 'after'
                    : 'earlier'
              const comparing = compare === run.publish_time && status !== 'used'
              return (
                <Fragment key={run.publish_time}>
                  {index === firstAfterGate ? (
                    <div className="gate-marker" aria-hidden="true">
                      <span>Gate</span>
                      <span />
                      <span>{gate.time}</span>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="run-button"
                    data-state={status === 'used' ? 'used' : comparing ? 'compare' : undefined}
                    aria-pressed={status === 'used' || comparing}
                    aria-label={`${formatUkTime(run.publish_time)} run, ${STATUS[status].label}, MAE ${formatMw(run.mae_mw)}`}
                    onClick={() =>
                      onCompare(status === 'used' || comparing ? undefined : run.publish_time)
                    }
                  >
                    <Text weight="bold" className="tabular">
                      {formatUkTime(run.publish_time)}
                    </Text>
                    <Badge color={STATUS[status].color} variant={STATUS[status].variant}>
                      {STATUS[status].label}
                    </Badge>
                    <Text size="1" color="gray">
                      MAE {formatMw(run.mae_mw)}
                    </Text>
                  </button>
                </Fragment>
              )
            })}
          </Flex>
        )}
      </Flex>
    </section>
  )
}
