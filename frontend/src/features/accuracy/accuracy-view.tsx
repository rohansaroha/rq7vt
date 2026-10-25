import { Flex, Grid, RadioCards, SegmentedControl, Skeleton, Text } from '@radix-ui/themes'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'

import { GatePicker } from '@/features/meta/gate-picker'
import { NoDataNotice } from '@/features/meta/no-data-notice'
import { metaQuery } from '@/features/meta/queries'
import type { Schema } from '@/shared/api/client'
import { ChartCard } from '@/shared/charts/chart-card'
import { chart } from '@/shared/charts/colors'
import { Legend, LegendItem } from '@/shared/charts/legend'
import { GLOSSARY } from '@/shared/glossary'
import { formatHours, formatMw, formatPercent, formatSignedMw } from '@/shared/format'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { RangeSlider } from '@/shared/ui/range-slider'
import { SignalCard } from '@/shared/ui/signal-card'
import { StatTile } from '@/shared/ui/stat-tile'

import { BufferPanel } from './buffer-panel'
import { DayBars, DaysLegendNote, DaysTable } from './day-bars'
import { HistogramTable } from './error-histogram'
import { HeatmapTable, LeadHeatmap } from './lead-heatmap'
import { LeadTimeChart, LeadTimeTable } from './lead-time-chart'
import {
  accuracySummaryQuery,
  daysQuery,
  leadTimeQuery,
  type Forecast,
  type Scoring,
} from './queries'
import type { AccuracySearch } from './search'
import {
  bufferTakeaway,
  correctionGain,
  daysTakeaway,
  heatTakeaway,
  leadTakeaway,
} from './takeaways'

const route = getRouteApi('/accuracy')

export function AccuracyView() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const meta = useQuery(metaQuery())
  const gateMode = search.mode === 'gate'
  const forecast: Forecast = gateMode ? search.forecast : 'published'
  const corrected = forecast === 'corrected'
  const scoring: Scoring = gateMode
    ? { mode: 'gate', gate: search.gate, forecast }
    : { mode: 'horizon', horizon: search.horizon }
  const summary = useQuery({ ...accuracySummaryQuery(scoring), placeholderData: keepPreviousData })
  const published = useQuery({
    ...accuracySummaryQuery({ mode: 'gate', gate: search.gate }),
    enabled: corrected,
  })
  const days = useQuery({ ...daysQuery(search.gate), enabled: gateMode })
  const leadTime = useQuery(leadTimeQuery())

  const update = (next: Partial<AccuracySearch>, replace = false) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace, resetScroll: false })

  const pickHorizon = (horizon: number) => update({ mode: 'horizon', horizon })
  const data = summary.data
  const metrics = data?.metrics
  const before = corrected ? published.data?.metrics : undefined
  const was = (value: string) => (before ? `Published: ${value}` : null)
  const selectedBucket =
    search.mode === 'horizon' ? Math.min(11, Math.floor(search.horizon / 4)) : undefined
  const gain =
    corrected && data && published.data
      ? correctionGain(published.data, data, days.data?.days)
      : null

  return (
    <Flex direction="column" gap="5">
      <PageHeader
        eyebrow="Forecast accuracy"
        title={
          <>
            How far can you <em>trust</em> the forecast?
          </>
        }
        lead="The accuracy of the wind forecast over the period, scored the way you trade. Use it to size the extra cover you buy, and to see what learning from recent misses is worth."
      />

      <section aria-label="Scoring options" className="filters" style={{ padding: 16 }}>
        <Flex direction="column" gap="3">
          <Flex gap="5" align="end" wrap="wrap">
            <Flex direction="column" gap="2">
              <Text id="mode-label" size="1" weight="bold" color="gray">
                Score forecasts
              </Text>
              <RadioCards.Root
                aria-labelledby="mode-label"
                size="1"
                columns="2"
                gap="2"
                value={search.mode}
                onValueChange={(mode) => update({ mode: mode as AccuracySearch['mode'] })}
              >
                <RadioCards.Item value="gate">
                  <Flex direction="column">
                    <Text weight="bold">At bid time</Text>
                    <Text size="1" color="gray">
                      Last run before the gate
                    </Text>
                  </Flex>
                </RadioCards.Item>
                <RadioCards.Item value="horizon">
                  <Flex direction="column">
                    <Text weight="bold">Fixed lead time</Text>
                    <Text size="1" color="gray">
                      0 to 48 hours ahead
                    </Text>
                  </Flex>
                </RadioCards.Item>
              </RadioCards.Root>
            </Flex>
            {gateMode ? (
              meta.data ? (
                <GatePicker
                  gates={meta.data.gates}
                  value={search.gate}
                  onChange={(gate) => update({ gate })}
                />
              ) : null
            ) : (
              <HorizonControl
                horizon={search.horizon}
                onCommit={(horizon) => update({ horizon }, true)}
              />
            )}
            {gateMode ? (
              <Flex direction="column" gap="2">
                <Text id="forecast-label" size="1" weight="bold" color="gray">
                  Forecast
                </Text>
                <SegmentedControl.Root
                  aria-labelledby="forecast-label"
                  size="3"
                  value={forecast}
                  onValueChange={(value) => update({ forecast: value as Forecast })}
                >
                  <SegmentedControl.Item value="published">As published</SegmentedControl.Item>
                  <SegmentedControl.Item value="corrected">
                    Learned correction
                  </SegmentedControl.Item>
                </SegmentedControl.Root>
              </Flex>
            ) : null}
          </Flex>
          <Text size="2" color="gray">
            {data ? modeNote(data) : ' '}
          </Text>
        </Flex>
      </section>

      {meta.data ? <NoDataNotice meta={meta.data} /> : null}

      {summary.isError ? (
        <QueryError error={summary.error} onRetry={() => void summary.refetch()} />
      ) : null}

      {gain ? (
        <SignalCard eyebrow="Learned correction" title={gain.title}>
          {gain.body} Each day&apos;s factor is learned only from the four weeks already metered
          when you bid, so this is an honest, out-of-sample result.
        </SignalCard>
      ) : null}

      <div className={`stat-grid${summary.isPlaceholderData ? ' is-refreshing' : ''}`}>
        <StatTile
          loading={!metrics}
          label="Typical miss (MAE)"
          info={GLOSSARY.mae}
          value={formatMw(metrics?.mae_mw)}
          delta={was(formatMw(before?.mae_mw))}
          note="Average hourly error"
        />
        <StatTile
          loading={!metrics}
          label="RMSE"
          info={GLOSSARY.rmse}
          value={formatMw(metrics?.rmse_mw)}
          delta={was(formatMw(before?.rmse_mw))}
          note="Weighs big misses more"
        />
        <StatTile
          loading={!metrics}
          label="Bias"
          info={GLOSSARY.bias}
          value={formatSignedMw(metrics?.bias_mw)}
          delta={was(formatSignedMw(before?.bias_mw))}
          note={
            metrics?.bias_mw == null
              ? ' '
              : metrics.bias_mw >= 0
                ? 'Forecast above actual on average'
                : 'Forecast below actual on average'
          }
        />
        <StatTile
          loading={!metrics}
          label="nMAE"
          info={GLOSSARY.nmae}
          value={formatPercent(metrics?.nmae)}
          delta={was(formatPercent(before?.nmae))}
          note="MAE as a share of average output"
        />
        <StatTile
          loading={!metrics}
          label="P90 shortfall"
          info={GLOSSARY.p90}
          value={formatMw(metrics?.p90_mw)}
          delta={was(formatMw(before?.p90_mw))}
          note="9 in 10 hours were short by less"
        />
        <StatTile
          loading={!metrics}
          label="Coverage"
          info={GLOSSARY.coverage}
          value={formatPercent(metrics?.coverage, 0)}
          note={metrics ? `${metrics.hours_scored} of ${metrics.hours} hours scored` : ' '}
        />
      </div>

      {gateMode ? (
        days.isError ? (
          <QueryError error={days.error} onRetry={() => void days.refetch()} />
        ) : days.data ? (
          <ChartCard
            eyebrow={`Day by day · ${search.gate} gate`}
            title={daysTakeaway(days.data.days, forecast)}
            label="Typical miss by delivery day"
            legend={
              <Legend label="Chart key">
                <LegendItem
                  marker={{ kind: 'area', color: corrected ? chart.corrected : chart.series1 }}
                >
                  {corrected ? 'Typical miss, learned correction' : 'Typical miss, as published'}
                </LegendItem>
              </Legend>
            }
            chart={
              <Flex direction="column" gap="2">
                <DayBars
                  days={days.data.days}
                  forecast={forecast}
                  onOpen={(day) =>
                    void navigate({
                      to: '/',
                      search: { day, gate: search.gate, corrected },
                    })
                  }
                />
                <DaysLegendNote />
              </Flex>
            }
            table={<DaysTable days={days.data.days} gate={search.gate} />}
            howToRead={
              <ul>
                <li>One bar per delivery day: the average size of that day’s hourly misses.</li>
                <li>
                  Tall bars are the days a buyer relying on the forecast had to fix the most at
                  short notice. Hover for the bias and how many hours were short.
                </li>
                <li>Click a bar to open that day on the Decision page.</li>
              </ul>
            }
          />
        ) : (
          <Skeleton height="300px" />
        )
      ) : null}

      {leadTime.isError ? (
        <QueryError error={leadTime.error} onRetry={() => void leadTime.refetch()} />
      ) : leadTime.data ? (
        <ChartCard
          eyebrow="Multi-horizon view"
          title={leadTakeaway(leadTime.data.curve)}
          label="Error grows with lead time"
          description="How wrong the forecast was, by how far ahead it was published. Click a lead time to score it."
          legend={
            <Legend label="Chart key">
              <LegendItem marker={{ kind: 'line', color: chart.series1 }}>
                Typical miss (MAE)
              </LegendItem>
              <LegendItem marker={{ kind: 'line', color: chart.series2, dashed: true }}>
                P90 shortfall
              </LegendItem>
              {gateMode ? (
                <LegendItem marker={{ kind: 'area', color: chart.band }}>
                  Lead times you face at the gate
                </LegendItem>
              ) : (
                <LegendItem marker={{ kind: 'rule', color: chart.ink }}>
                  Selected lead time
                </LegendItem>
              )}
            </Legend>
          }
          chart={
            <LeadTimeChart
              curve={leadTime.data.curve}
              leadRange={gateMode && data?.lead_h ? data.lead_h : undefined}
              horizon={search.mode === 'horizon' ? search.horizon : undefined}
              onPick={pickHorizon}
            />
          }
          table={<LeadTimeTable curve={leadTime.data.curve} />}
          howToRead={
            <ul>
              <li>
                Across: how many hours before the delivery hour the forecast was published. Up: the
                size of the miss.
              </li>
              <li>
                Blue is the typical miss; the dashed line is the shortfall that 9 hours in 10 stay
                under. Both rise the further ahead you look.
              </li>
              <li>
                The shaded band is the range of lead times your auction forces on you: you bid a day
                ahead, so you can never use the freshest runs. This view scores the forecast as
                published.
              </li>
            </ul>
          }
        />
      ) : (
        <Skeleton height="320px" />
      )}

      <Grid columns={{ initial: '1', md: '2' }} gap="4">
        {leadTime.data ? (
          <ChartCard
            eyebrow="Where the misses concentrate"
            title={heatTakeaway(leadTime.data.heatmap)}
            label="Where the misses concentrate"
            description="Typical miss by delivery hour and lead time. Pick a lead-time column to score it above."
            chart={
              <LeadHeatmap
                heatmap={leadTime.data.heatmap}
                selectedBucket={selectedBucket}
                onPickBucket={(bucket) =>
                  pickHorizon(Math.round((bucket.from_h + bucket.to_h) / 2))
                }
              />
            }
            table={<HeatmapTable heatmap={leadTime.data.heatmap} />}
            howToRead={
              <ul>
                <li>Rows: the UK clock hour being forecast. Columns: how far ahead, in hours.</li>
                <li>Darker cells are bigger typical misses; the scale is below the grid.</li>
              </ul>
            }
          />
        ) : (
          <Skeleton height="420px" />
        )}
        {data ? (
          <ChartCard
            eyebrow="Choose your buffer"
            title={bufferTakeaway(data, search.ratio)}
            label="Choose your buffer"
            description="Error = forecast minus actual. Hours right of the line are shortfalls your buffer would not have covered."
            dimmed={summary.isPlaceholderData}
            chart={
              <BufferPanel
                summary={data}
                ratio={search.ratio}
                onRatioCommit={(ratio) => update({ ratio }, true)}
                color={corrected ? chart.corrected : chart.series1}
              />
            }
            table={
              <HistogramTable
                bins={data.histogram.bins}
                bufferMw={data.buffers.find((b) => b.cost_ratio === search.ratio)?.buffer_mw ?? 0}
              />
            }
            howToRead={
              <ul>
                <li>
                  Each bar counts hours by the size of the miss: right of zero the wind came in
                  short, left of it the wind beat the forecast.
                </li>
                <li>
                  Tell the slider how much worse being short is than being long. The best cover is
                  the error that this share of hours stayed under (q* = ratio ÷ (ratio + 1)).
                </li>
                <li>Bars past the dashed line are the hours that cover would not have saved.</li>
              </ul>
            }
          />
        ) : (
          <Skeleton height="420px" />
        )}
      </Grid>

      <Text size="1" color="gray">
        Data: Elexon FUELHH (fuel type WIND) and WINDFOR, delivery days{' '}
        {meta.data ? `${meta.data.period.first_day} to ${meta.data.period.last_day}` : ''}. The
        buffer uses the errors of the whole period, so it describes the period rather than what was
        known on each day; the learned correction only ever uses days known at the gate.
      </Text>
    </Flex>
  )
}

function modeNote(summary: Schema<'AccuracySummary'>): string {
  const lead = summary.lead_h
  const leadText = lead
    ? ` Each hour was forecast ${formatHours(lead.min_h)} to ${formatHours(lead.max_h)} ahead (median ${formatHours(lead.median_h)}).`
    : ''
  return `${summary.selection.description}.${leadText}`
}

/** Shows the value while dragging; asks the API only when the slider is released. */
function HorizonControl({
  horizon,
  onCommit,
}: {
  horizon: number
  onCommit: (horizon: number) => void
}) {
  const [dragging, setDragging] = useState<number | null>(null)
  const live = dragging ?? horizon
  return (
    <Flex direction="column" gap="2" style={{ flex: '1 1 320px' }}>
      <Text size="1" weight="bold" color="gray">
        Lead time
      </Text>
      <Flex align="center" gap="3">
        <RangeSlider
          label="Lead time"
          valueText={`${live} hours ahead`}
          value={live}
          min={0}
          max={48}
          onChange={setDragging}
          onCommit={(value) => {
            onCommit(value)
            setDragging(null)
          }}
        />
        <Text weight="bold" className="tabular" style={{ minWidth: 92 }}>
          {live} h ahead
        </Text>
      </Flex>
    </Flex>
  )
}
