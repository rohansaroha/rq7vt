import { Box, Flex, SegmentedControl, Text } from '@radix-ui/themes'
import { useState, type ReactNode } from 'react'

import { Eyebrow } from '@/shared/ui/eyebrow'
import { HowToRead } from '@/shared/ui/how-to-read'

/**
 * A chart under an eyebrow and a headline that says what it shows, with its legend, a
 * "how to read this" note and a table twin. The table is the accessible way to read
 * every value (charts are images to a screen reader); `dimmed` keeps the previous render
 * at reduced opacity while new data loads, instead of flashing a skeleton.
 */
export function ChartCard({
  eyebrow,
  title,
  label,
  description,
  legend,
  chart,
  table,
  howToRead,
  dimmed = false,
  inset = false,
}: {
  eyebrow?: string
  title: ReactNode
  /** The section's accessible name; defaults to the title, when that is plain text. */
  label?: string
  description?: ReactNode
  legend?: ReactNode
  chart: ReactNode
  table: ReactNode
  howToRead?: ReactNode
  dimmed?: boolean
  /** Inside another panel: a flat tile instead of a raised card. */
  inset?: boolean
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const name = label ?? (typeof title === 'string' ? title : 'Chart')
  return (
    <section
      aria-label={name}
      className={inset ? 'stat-tile' : 'surface'}
      style={{ padding: inset ? 16 : 20, minWidth: 0 }}
    >
      <Flex direction="column" gap="3">
        <Flex justify="between" align="start" gap="3" wrap="wrap">
          <Box style={{ flex: '1 1 300px', minWidth: 0 }}>
            {eyebrow ? <Eyebrow tone="muted">{eyebrow}</Eyebrow> : null}
            <h2 className="card-title" style={{ marginTop: eyebrow ? 6 : 0 }}>
              {title}
            </h2>
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
            aria-label={`Show ${name} as`}
          >
            <SegmentedControl.Item value="chart">Chart</SegmentedControl.Item>
            <SegmentedControl.Item value="table">Table</SegmentedControl.Item>
          </SegmentedControl.Root>
        </Flex>
        {legend}
        <Box className={dimmed ? 'is-refreshing' : undefined}>
          {view === 'chart' ? chart : <Box className="table-scroll">{table}</Box>}
        </Box>
        {howToRead ? <HowToRead>{howToRead}</HowToRead> : null}
      </Flex>
    </section>
  )
}
