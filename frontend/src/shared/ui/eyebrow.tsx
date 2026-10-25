import type { ReactNode } from 'react'

/** The small uppercase label that names a section before its headline. */
export function Eyebrow({
  children,
  tone = 'accent',
  id,
}: {
  children: ReactNode
  tone?: 'accent' | 'muted' | 'on-dark'
  id?: string
}) {
  return (
    <p className="eyebrow" data-tone={tone === 'accent' ? undefined : tone} id={id}>
      {children}
    </p>
  )
}
