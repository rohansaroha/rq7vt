import { Flex } from '@radix-ui/themes'
import type { ReactNode } from 'react'

import { Eyebrow } from './eyebrow'

/** Eyebrow, headline (wrap the key words in <em> for the accent) and one lead paragraph. */
export function PageHeader({
  eyebrow,
  title,
  lead,
  chips,
}: {
  eyebrow: string
  title: ReactNode
  lead: ReactNode
  chips?: ReactNode
}) {
  return (
    <Flex direction="column" gap="3" pt="3" pb="1">
      <Flex align="center" gap="3" wrap="wrap">
        <Eyebrow>{eyebrow}</Eyebrow>
        {chips}
      </Flex>
      <h1 className="page-title">{title}</h1>
      <p className="page-lead">{lead}</p>
    </Flex>
  )
}
