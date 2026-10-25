import { Card, Flex, Grid, Heading, RadioCards, Skeleton, Text } from '@radix-ui/themes'
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
import { formatHours, formatMw, formatPercent, formatSignedMw } from '@/shared/format'
import { QueryError } from '@/shared/ui/query-error'
import { RangeSlider } from '@/shared/ui/range-slider'
import { StatTile } from '@/shared/ui/stat-tile'

import { BufferPanel } from './buffer-panel'
import { HistogramTable } from './error-histogram'
import { HeatmapTable, LeadHeatmap } from './lead-heatmap'
import { LeadTimeChart, LeadTimeTable } from './lead-time-chart'
import { accuracySummaryQuery, leadTimeQuery, type Scoring } from './queries'
import type { AccuracySearch } from './search'

const route = getRouteApi('/accuracy')

export function AccuracyView() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const meta = useQuery(metaQuery())
  const scoring: Scoring =
    search.mode === 'gate'
      ? { mode: 'gate', gate: search.gate }
      : { mode: 'horizon', horizon: search.horizon }
  const summary = useQuery({ ...accuracySummaryQuery(scoring), placeholderData: keepPreviousData })
  const leadTime = useQuery(leadTimeQuery())

  const update = (next: Partial<AccuracySearch>, replace = false) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace, resetScroll: false })

  const pickHorizon = (horizon: number) => update({ mode: 'horizon', horizon })
  const data = summary.data
  const metrics = data?.metrics
  const selectedBucket =
    search.mode === 'horizon' ? Math.min(11, Math.floor(search.horizon / 4)) : undefined

  return (
    <Flex direction="column" gap="4">
      <Flex direction="column" gap="1">
        <Heading as="h1" size="7">
          How far can you trust the forecast?
        </Heading>
        <Text color="gray">
          The accuracy of the wind forecast over the period, scored the way you trade. Use it to
          size the extra cover you buy.
        </Text>
      </Flex>

      <Card size="2" asChild>
        <section aria-label="Scoring options">
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
              {search.mode === 'gate' ? (
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
            </Flex>
            <Text size="2" color="gray">
              {data ? modeNote(data) : ' '}
            </Text>
          </Flex>
        </section>
      </Card>

      {meta.data ? <NoDataNotice meta={meta.data} /> : null}

      {summary.isError ? (
        <QueryError error={summary.error} onRetry={() => void summary.refetch()} />
      ) : null}

      <div className={`stat-grid${summary.isPlaceholderData ? ' is-refreshing' : ''}`}>
        <StatTile
          loading={!metrics}
          label="Typical miss (MAE)"
          value={formatMw(metrics?.mae_mw)}
          note="Average hourly error"
        />
        <StatTile
          loading={!metrics}
          label="RMSE"
          value={formatMw(metrics?.rmse_mw)}
          note="Weighs big misses more"
        />
        <StatTile
          loading={!metrics}
          label="Bias"
          value={formatSignedMw(metrics?.bias_mw)}
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
          value={formatPercent(metrics?.nmae)}
          note="MAE as a share of average output"
        />
        <StatTile
          loading={!metrics}
          label="P90 shortfall"
          value={formatMw(metrics?.p90_mw)}
          note="9 in 10 hours were short by less"
        />
        <StatTile
          loading={!metrics}
          label="Coverage"
          value={formatPercent(metrics?.coverage, 0)}
          note={metrics ? `${metrics.hours_scored} of ${metrics.hours} hours scored` : ' '}
        />
      </div>

      {leadTime.isError ? (
        <QueryError error={leadTime.error} onRetry={() => void leadTime.refetch()} />
      ) : leadTime.data ? (
        <ChartCard
          title="Error grows with lead time"
          description="How wrong the forecast was, by how far ahead it was published. Click a lead time to score it."
          legend={
            <Legend label="Chart key">
              <LegendItem marker={{ kind: 'line', color: chart.series1 }}>
                Typical miss (MAE)
              </LegendItem>
              <LegendItem marker={{ kind: 'line', color: chart.series2, dashed: true }}>
                P90 shortfall
              </LegendItem>
              {search.mode === 'gate' ? (
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
              leadRange={search.mode === 'gate' && data?.lead_h ? data.lead_h : undefined}
              horizon={search.mode === 'horizon' ? search.horizon : undefined}
              onPick={pickHorizon}
            />
          }
          table={<LeadTimeTable curve={leadTime.data.curve} />}
        />
      ) : (
        <Skeleton height="320px" />
      )}

      <Grid columns={{ initial: '1', md: '2' }} gap="4">
        {leadTime.data ? (
          <ChartCard
            title="Where the misses concentrate"
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
          />
        ) : (
          <Skeleton height="420px" />
        )}
        {data ? (
          <ChartCard
            title="Choose your buffer"
            description="Error = forecast minus actual. Hours right of the line are shortfalls your buffer would not have covered."
            dimmed={summary.isPlaceholderData}
            chart={
              <BufferPanel
                summary={data}
                ratio={search.ratio}
                onRatioCommit={(ratio) => update({ ratio }, true)}
              />
            }
            table={
              <HistogramTable
                bins={data.histogram.bins}
                bufferMw={data.buffers.find((b) => b.cost_ratio === search.ratio)?.buffer_mw ?? 0}
              />
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
        known on each day.
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
