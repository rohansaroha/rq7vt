import { Button, Checkbox, Flex, Grid, Skeleton, Text } from '@radix-ui/themes'
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
import { DASH } from '@/shared/charts/marks'
import { formatDay, formatFactor, formatShortDay, formatUkTime } from '@/shared/format'
import { Chip } from '@/shared/ui/chip'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { SignalCard } from '@/shared/ui/signal-card'
import { WatchList } from '@/shared/ui/watch-list'

import { BidCallout } from './bid-callout'
import { BriefingCard } from './briefing-card'
import { BufferCard } from './buffer-card'
import { resolveDay } from './day'
import { DayPicker } from './day-picker'
import { DecisionChart, type CompareRun } from './decision-chart'
import { DecisionStats } from './decision-stats'
import { DecisionTable } from './decision-table'
import { HourInspector } from './hour-inspector'
import { energyHeadline, forecastSignal, watchItems } from './insights'
import { decisionQuery, runsQuery } from './queries'
import { RunsStrip } from './runs-strip'
import type { DecisionSearch } from './search'

const route = getRouteApi('/')

export function DecisionView() {
  const meta = useQuery(metaQuery())
  return (
    <Flex direction="column" gap="5">
      <PageHeader
        eyebrow="Day-ahead decision"
        title={
          <>
            What did the forecast say <em>when you bid</em>?
          </>
        }
        lead="Pick a delivery day and your auction. You see the last wind forecast published before that auction closed, next to what the wind actually did."
      />
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
  const gate = meta.gates.find((g) => g.time === search.gate)
  const showCorrected = search.corrected && data?.correction != null
  const signal = data ? forecastSignal(data, buffer.data) : undefined

  return (
    <Flex direction="column" gap="4">
      <Flex className="filters" gap="5" align="end" wrap="wrap" p="4">
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
        <Flex direction="column" gap="1">
          <Text as="label" size="2">
            <Flex gap="2" align="center" minHeight="36px">
              <Checkbox
                checked={search.band}
                onCheckedChange={(checked) => update({ band: checked === true }, true)}
              />
              Show likely range (P10–P90)
            </Flex>
          </Text>
          <Text as="label" size="2">
            <Flex gap="2" align="center" minHeight="36px">
              <Checkbox
                checked={search.corrected}
                onCheckedChange={(checked) => update({ corrected: checked === true }, true)}
              />
              Show learned correction
            </Flex>
          </Text>
        </Flex>
      </Flex>

      <NoDataNotice meta={meta} />

      {decision.isError ? (
        <QueryError error={decision.error} onRetry={() => void decision.refetch()} />
      ) : null}

      <section aria-label="Delivery day" className="surface" style={{ padding: 20 }}>
        <Flex direction="column" gap="4">
          <Flex justify="between" align="center" gap="3" wrap="wrap">
            <Flex gap="2" wrap="wrap">
              <Chip>GB wind · national</Chip>
              <Chip tone="accent">Delivery {formatShortDay(day)}</Chip>
              <Chip>
                {search.gate} gate{gate ? ` · ${gate.label}` : ''}
              </Chip>
            </Flex>
            {data?.run ? (
              <Chip>
                {runTime} run · {data.run.lead_h.min_h}–{data.run.lead_h.max_h} h ahead
              </Chip>
            ) : null}
          </Flex>
          {data ? <BidCallout decision={data} /> : null}
          <DecisionStats decision={data} showCorrected={showCorrected} />

          <Grid columns={{ initial: '1', md: '1fr 300px' }} gap="4" align="start">
            {data ? (
              <ChartCard
                inset
                eyebrow="Forecast vs actual"
                title={energyHeadline(data)}
                label={`Forecast at bid vs actual, ${formatDay(day)}`}
                dimmed={decision.isPlaceholderData}
                legend={
                  <Legend label="Chart key">
                    <LegendItem marker={{ kind: 'line', color: chart.ink }}>Actual</LegendItem>
                    <LegendItem marker={{ kind: 'line', color: chart.series1 }}>
                      Forecast at bid{runTime ? ` (${runTime} run)` : ''}
                    </LegendItem>
                    {showCorrected && data.correction ? (
                      <LegendItem
                        marker={{ kind: 'line', color: chart.corrected, dash: DASH.corrected }}
                      >
                        Learned correction ({formatFactor(data.correction.factor)})
                      </LegendItem>
                    ) : null}
                    {search.band ? (
                      <LegendItem marker={{ kind: 'area', color: chart.band }}>
                        Likely range for the actual (80%)
                      </LegendItem>
                    ) : null}
                    {compare ? (
                      <LegendItem
                        marker={{ kind: 'line', color: chart.series2, dash: DASH.compare }}
                      >
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
                      showCorrected={showCorrected}
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
                table={<DecisionTable points={data.points} showCorrected={showCorrected} />}
                howToRead={
                  <ul>
                    <li>
                      Across: the delivery day, 23:00 to 23:00 UK time. Up: national wind output.
                    </li>
                    <li>
                      The dark line is what the wind farms actually produced (metered, half-hourly).
                      The blue line is the forecast you could bid with at the gate.
                    </li>
                    <li>
                      Where blue sits above dark, the wind under-delivered: a buyer relying on the
                      forecast was short and had to buy the gap at short notice.
                    </li>
                    <li>
                      The shaded band is where the actual landed in 8 of 10 hours, given this
                      forecast, judged from the whole month at this gate.
                    </li>
                    <li>
                      The dashed green line (when switched on) is the learned correction: the same
                      forecast scaled by how the wind compared with it over the previous four weeks.
                    </li>
                  </ul>
                }
              />
            ) : (
              <Skeleton height="380px" />
            )}
            <Flex direction="column" gap="3">
              {data && signal ? (
                <SignalCard
                  eyebrow="Forecast signal"
                  title={signal.title}
                  footer={
                    data.correction && !search.corrected ? (
                      <Button
                        size="1"
                        variant="outline"
                        onClick={() => update({ corrected: true }, true)}
                      >
                        Show the learned correction
                      </Button>
                    ) : null
                  }
                >
                  {signal.body}
                </SignalCard>
              ) : (
                <Skeleton height="160px" />
              )}
              {data ? <WatchList items={watchItems(data, buffer.data)} /> : null}
              {showCorrected && data?.correction ? (
                <Text size="1" color="gray">
                  Correction for this day: {formatFactor(data.correction.factor)}, learned from{' '}
                  {formatShortDay(data.correction.trained_from)} to{' '}
                  {formatShortDay(data.correction.trained_to)} ({data.correction.days} days known at
                  the gate).
                </Text>
              ) : null}
            </Flex>
          </Grid>
        </Flex>
      </section>

      {data ? (
        <BriefingCard
          key={`${data.day}-${data.gate.time}`}
          decision={data}
          summary={buffer.data}
          gateLabel={gate?.label}
        />
      ) : null}

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
