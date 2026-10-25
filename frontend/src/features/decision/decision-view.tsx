import { Checkbox, Flex, Grid, Heading, Skeleton, Text } from '@radix-ui/themes'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'

import { accuracySummaryQuery } from '@/features/accuracy/queries'
import { GatePicker } from '@/features/meta/gate-picker'
import { NoDataNotice } from '@/features/meta/no-data-notice'
import { metaQuery } from '@/features/meta/queries'
import type { Schema } from '@/shared/api/client'
import { ChartCard } from '@/shared/charts/chart-card'
import { chart } from '@/shared/charts/colors'
import { Legend, LegendItem } from '@/shared/charts/legend'
import { formatDay, formatUkTime } from '@/shared/format'
import { QueryError } from '@/shared/ui/query-error'

import { BidCallout } from './bid-callout'
import { BufferCard } from './buffer-card'
import { resolveDay } from './day'
import { DayPicker } from './day-picker'
import { DecisionChart, type CompareRun } from './decision-chart'
import { DecisionStats } from './decision-stats'
import { DecisionTable } from './decision-table'
import { HourInspector } from './hour-inspector'
import { decisionQuery, runsQuery } from './queries'
import { RunsStrip } from './runs-strip'
import type { DecisionSearch } from './search'

const route = getRouteApi('/')

export function DecisionView() {
  const meta = useQuery(metaQuery())
  return (
    <Flex direction="column" gap="4">
      <Flex direction="column" gap="1">
        <Heading as="h1" size="7">
          What did the forecast say when you bid?
        </Heading>
        <Text color="gray">
          Pick a delivery day and your auction. You see the last wind forecast published before that
          auction closed, next to what the wind actually did.
        </Text>
      </Flex>
      {meta.isError ? (
        <QueryError error={meta.error} onRetry={() => void meta.refetch()} />
      ) : meta.data ? (
        <DecisionContent meta={meta.data} />
      ) : (
        <Skeleton height="480px" />
      )}
    </Flex>
  )
}

function DecisionContent({ meta }: { meta: Schema<'MetaResponse'> }) {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const day = resolveDay(search.day, meta.period)

  const decision = useQuery({
    ...decisionQuery(day, search.gate),
    placeholderData: keepPreviousData,
  })
  const runs = useQuery({ ...runsQuery(day), placeholderData: keepPreviousData })
  const buffer = useQuery(accuracySummaryQuery({ mode: 'gate', gate: search.gate }))

  // Which hour the inspector shows; it starts on the day's worst shortfall.
  const [inspected, setInspected] = useState<{ day: string; index: number } | null>(null)

  const update = (next: Partial<DecisionSearch>, replace = false) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace, resetScroll: false })

  const data = decision.data
  const worstIndex = data?.summary.worst_shortfall
    ? data.points.findIndex((p) => p.start_time === data.summary.worst_shortfall?.start_time)
    : 0
  const index = inspected?.day === day ? inspected.index : Math.max(0, worstIndex)

  const compareRun = runs.data?.runs.find(
    (run) => run.publish_time === search.compare && run.publish_time !== data?.run?.publish_time,
  )
  const compare: CompareRun | undefined = compareRun
    ? { label: `${formatUkTime(compareRun.publish_time)} run`, points: compareRun.points }
    : undefined
  const runTime = data?.run ? formatUkTime(data.run.publish_time) : undefined

  return (
    <Flex direction="column" gap="4">
      <Flex
        className="filters"
        gap="5"
        align="end"
        wrap="wrap"
        p="4"
        style={{ background: 'var(--color-panel-solid)', borderRadius: 'var(--radius-4)' }}
      >
        <DayPicker
          day={day}
          first={meta.period.first_day}
          last={meta.period.last_day}
          onChange={(next) => update({ day: next, compare: undefined })}
        />
        <GatePicker
          gates={meta.gates}
          value={search.gate}
          onChange={(gate) => update({ gate, compare: undefined })}
        />
        <Text as="label" size="2">
          <Flex gap="2" align="center" minHeight="44px">
            <Checkbox
              checked={search.band}
              onCheckedChange={(checked) => update({ band: checked === true }, true)}
            />
            Show likely range
          </Flex>
        </Text>
      </Flex>

      <NoDataNotice meta={meta} />

      {decision.isError ? (
        <QueryError error={decision.error} onRetry={() => void decision.refetch()} />
      ) : null}

      {data ? <BidCallout decision={data} /> : null}

      <DecisionStats decision={data} />

      {data ? (
        <ChartCard
          title={`Forecast at bid vs actual, ${formatDay(day)}`}
          dimmed={decision.isPlaceholderData}
          legend={
            <Legend label="Chart key">
              <LegendItem marker={{ kind: 'line', color: chart.ink }}>Actual</LegendItem>
              <LegendItem marker={{ kind: 'line', color: chart.series1 }}>
                Forecast at bid{runTime ? ` (${runTime} run)` : ''}
              </LegendItem>
              {search.band ? (
                <LegendItem marker={{ kind: 'area', color: chart.band }}>
                  Likely range for the actual (80%)
                </LegendItem>
              ) : null}
              {compare ? (
                <LegendItem marker={{ kind: 'line', color: chart.series2, dashed: true }}>
                  {compare.label} (compare)
                </LegendItem>
              ) : null}
            </Legend>
          }
          chart={
            <>
              <DecisionChart
                points={data.points}
                actuals={data.actuals}
                compare={compare}
                showBand={search.band}
                startsAt={data.starts_at}
                endsAt={data.ends_at}
                inspected={index}
                onInspect={(i) => setInspected({ day, index: i })}
                label={`Line chart of actual wind generation and the forecast at bid for ${formatDay(day)}`}
              />
              <HourInspector
                points={data.points}
                index={index}
                onChange={(i) => setInspected({ day, index: i })}
              />
            </>
          }
          table={<DecisionTable points={data.points} />}
        />
      ) : (
        <Skeleton height="380px" />
      )}

      <Grid columns={{ initial: '1', md: '3fr 1fr' }} gap="4">
        {runs.isError ? (
          <QueryError error={runs.error} onRetry={() => void runs.refetch()} />
        ) : runs.data && data ? (
          <RunsStrip
            runs={runs.data.runs}
            usedPublishTime={data.run?.publish_time}
            gate={data.gate}
            compare={search.compare}
            onCompare={(publishTime) => update({ compare: publishTime }, true)}
          />
        ) : (
          <Skeleton height="160px" />
        )}
        <BufferCard summary={buffer.data} gate={search.gate} />
      </Grid>

      <Text size="1" color="gray">
        Actuals: Elexon FUELHH (fuel type WIND). Forecasts: Elexon WINDFOR. Times are UK time. The
        likely range is the spread of errors at this gate over the whole period, by hour.
      </Text>
    </Flex>
  )
}
