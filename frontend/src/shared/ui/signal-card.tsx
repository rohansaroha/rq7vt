import { Box, Text } from '@radix-ui/themes'
import type { ReactNode } from 'react'

import { Eyebrow } from './eyebrow'

/** The headline finding, in words: what the numbers on this screen add up to. */
export function SignalCard({
  eyebrow,
  title,
  children,
  footer,
}: {
  eyebrow: string
  title: ReactNode
  children?: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="signal-card" aria-label={eyebrow}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h3 className="card-title" style={{ marginTop: 8, fontSize: 17 }}>
        {title}
      </h3>
      {children ? (
        <Text as="div" size="2" color="gray" mt="2">
          {children}
        </Text>
      ) : null}
      {footer ? <Box mt="3">{footer}</Box> : null}
    </section>
  )
}
