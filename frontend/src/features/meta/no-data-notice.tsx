import { ExclamationTriangleIcon } from '@radix-ui/react-icons'
import { Callout, Code } from '@radix-ui/themes'

import type { Schema } from '@/shared/api/client'

/** An empty database is a setup step, not an error: say what to run. */
export function NoDataNotice({ meta }: { meta: Schema<'MetaResponse'> }) {
  if (meta.datasets.some((dataset) => dataset.rows > 0)) return null
  return (
    <Callout.Root color="amber">
      <Callout.Icon>
        <ExclamationTriangleIcon />
      </Callout.Icon>
      <Callout.Text>
        No data has been loaded yet. Run <Code>make ingest</Code> to fetch January 2026 from Elexon
        (about a minute), then reload this page.
      </Callout.Text>
    </Callout.Root>
  )
}
