import type { ReactNode } from 'react'

/** A small bordered tag: context (market, day, gate) or a status such as "Prototype". */
export function Chip({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'prototype'
  title?: string
}) {
  return (
    <span className="chip" data-tone={tone === 'neutral' ? undefined : tone} title={title}>
      {children}
    </span>
  )
}
