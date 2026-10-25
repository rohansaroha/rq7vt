import type { ReactNode } from 'react'

import { Eyebrow } from './eyebrow'

/** What to keep an eye on, as short lines on a dark card. */
export function WatchList({ title = 'Watch list', items }: { title?: string; items: ReactNode[] }) {
  return (
    <section className="watch-list" aria-label={title}>
      <Eyebrow tone="on-dark">{title}</Eyebrow>
      <ul>
        {items.map((item, index) => (
          <li key={index}>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
