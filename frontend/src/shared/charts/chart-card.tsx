import { Box, Card, Flex, Heading, SegmentedControl, Text } from '@radix-ui/themes'
import { useState, type ReactNode } from 'react'

/**
 * A chart with its title, legend and a table twin. The table is the accessible way to
 * read every value (charts are images to a screen reader); `dimmed` holds the previous
 * render at reduced opacity while new data loads, instead of flashing a skeleton.
 */
export function ChartCard({
  title,
  description,
  legend,
  chart,
  table,
  dimmed = false,
}: {
  title: string
  description?: ReactNode
  legend?: ReactNode
  chart: ReactNode
  table: ReactNode
  dimmed?: boolean
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  return (
    <Card size="2" asChild>
      <section aria-label={title}>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="start" gap="3" wrap="wrap">
            <Box>
              <Heading as="h2" size="3">
                {title}
              </Heading>
              {description ? (
                <Text as="p" size="2" color="gray" mt="1">
                  {description}
                </Text>
              ) : null}
            </Box>
            <SegmentedControl.Root
              size="1"
              value={view}
              onValueChange={(value) => setView(value as 'chart' | 'table')}
              aria-label={`Show ${title} as`}
            >
              <SegmentedControl.Item value="chart">Chart</SegmentedControl.Item>
              <SegmentedControl.Item value="table">Table</SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>
          {legend}
          <Box className={dimmed ? 'is-refreshing' : undefined}>
            {view === 'chart' ? chart : <Box className="table-scroll">{table}</Box>}
          </Box>
        </Flex>
      </section>
    </Card>
  )
}
