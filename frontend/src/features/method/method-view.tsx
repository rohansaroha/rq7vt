import { Box, Card, Code, Flex, Grid, Heading, Text } from '@radix-ui/themes'
import type { ReactNode } from 'react'

import { chart } from '@/shared/charts/colors'
import { Legend, LegendItem } from '@/shared/charts/legend'

import { RuleDiagram } from './rule-diagram'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card size="3" asChild>
      <section aria-label={title}>
        <Heading as="h2" size="4" mb="3">
          {title}
        </Heading>
        <Flex direction="column" gap="2">
          {children}
        </Flex>
      </section>
    </Card>
  )
}

function Item({ term, children }: { term: string; children: ReactNode }) {
  return (
    <Text as="p" size="2">
      <Text weight="bold">{term}:</Text> {children}
    </Text>
  )
}

export function MethodView() {
  return (
    <Flex direction="column" gap="4" maxWidth="900px">
      <Flex direction="column" gap="1">
        <Heading as="h1" size="7">
          How the numbers are made
        </Heading>
        <Text color="gray">
          One rule decides which forecast you see, and a handful of measures say how much to trust
          it.
        </Text>
      </Flex>

      <Section title="The rule: the last run before the gate">
        <Text as="p" size="2">
          For each delivery hour, we take the latest WINDFOR forecast run published before your
          auction&apos;s gate closed on the day before delivery, and compare it with the FUELHH
          actual for that hour. Runs published later, including one that lands as the gate closes,
          are better informed, but you could not have traded on them, so they never count as what
          you saw. At the 09:20 gate that is the 07:30 run; at 09:50, the 09:30 run; at 15:30, the
          11:30 run. What counts is when each run actually arrived, not the timetable: on 15 January
          the 11:30 run came at 12:25.
        </Text>
        <Box mt="2">
          <RuleDiagram />
        </Box>
        <Legend label="Diagram key">
          <LegendItem marker={{ kind: 'line', color: chart.series1 }}>
            Run used for the bid
          </LegendItem>
          <LegendItem marker={{ kind: 'line', color: 'var(--gray-9)' }}>
            Older runs, also available
          </LegendItem>
          <LegendItem marker={{ kind: 'line', color: chart.series2 }}>
            Published after the gate
          </LegendItem>
        </Legend>
      </Section>

      <Grid columns={{ initial: '1', md: '2' }} gap="4">
        <Section title="Data">
          <Item term="Actuals">
            Elexon FUELHH, fuel type WIND: average MW over each half-hour, for wind farms with
            operational metering.
          </Item>
          <Item term="Forecasts">
            Elexon WINDFOR: hourly MW in eight runs a day, published at 02:30, 04:30, 07:30, 09:30,
            11:30, 15:30, 18:30 and 22:30 (UK time, which is UTC in January). All the runs published
            on a day cover the same 73 hours, from 21:00 the evening before to 21:00 two days after:
            the 13 January runs cover 21:00 on 12 January to 21:00 on 15 January. The first run of
            the day looks 66.5 hours ahead, the last 46.5.
          </Item>
          <Item term="Period">
            Purchase decisions made 1 to 31 January 2026, so delivery days 2 January to 1 February.
          </Item>
        </Section>
        <Section title="Accuracy measures">
          <Text as="p" size="2">
            Error = forecast minus actual. A positive error means the wind under-delivered and you
            were short.
          </Text>
          <Item term="MAE">the typical miss on an hour, in MW.</Item>
          <Item term="RMSE">
            weighs big misses more; far above MAE means occasional big surprises.
          </Item>
          <Item term="Bias">the average error with its sign: whether the forecast leans high.</Item>
          <Item term="nMAE">
            MAE as a share of average output, used instead of MAPE, which breaks when the wind is
            near zero.
          </Item>
          <Item term="P90 shortfall">9 hours in 10 were short by less than this.</Item>
        </Section>
      </Grid>

      <Section title="Choosing a buffer">
        <Text as="p" size="2">
          If being short costs c<sub>short</sub> per MWh and being long costs c<sub>long</sub>, the
          buffer with the lowest expected cost is the error quantile at
        </Text>
        <Code size="3" variant="ghost">
          q* = c_short ÷ (c_short + c_long)
        </Code>
        <Text as="p" size="2">
          When a shortfall costs nine times as much as a surplus, q* = 0.9: hold the P90 shortfall.
          When both cost the same, hold the median error. This is the classic newsvendor result.
        </Text>
      </Section>

      <Section title="Assumptions">
        <Item term="Delivery day">
          23:00 to 23:00 UK time, as the GB day-ahead auctions define it, so every hour is scored
          against the forecast its own auction saw.
        </Item>
        <Item term="Auctions">
          The default gate is 09:20 UK (EPEX GB hourly); 09:50 (Nord Pool N2EX) and 15:30 (EPEX GB
          half-hourly) are presets.
        </Item>
        <Item term="Alignment">
          Forecasts are hourly and actuals half-hourly, so accuracy is scored on the hour against
          the half-hour that starts it.
        </Item>
        <Item term="Time">Everything is stored in UTC and shown in UK time.</Item>
        <Item term="Gaps">
          Where a run or an actual is missing, the hour is left out and the coverage figure drops.
          At fixed lead times beyond 43 hours, some late-evening and night hours (22:00 to 02:00)
          drop out as well, because no run published that early reaches them.
        </Item>
        <Item term="In-sample">
          The likely range and the buffer use the errors of the whole period: they describe the
          period, not what was knowable on each day.
        </Item>
      </Section>
    </Flex>
  )
}
