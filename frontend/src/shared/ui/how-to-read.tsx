import type { ReactNode } from 'react'

/** A closed-by-default explainer under a chart: what the axes, lines and colours mean. */
export function HowToRead({
  children,
  summary = 'How to read this',
}: {
  children: ReactNode
  summary?: string
}) {
  return (
    <details className="how-to-read">
      <summary>{summary}</summary>
      {children}
    </details>
  )
}
