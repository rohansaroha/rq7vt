import { VisuallyHidden } from '@radix-ui/themes'
import { useEffect, useState } from 'react'

const TOTAL_MS = 1400

function prefersMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches ?? false
}

/**
 * Text that types itself out, for the prototype's "written for you" feel. Screen readers
 * get the whole text at once, and anyone who prefers reduced motion just sees it.
 * Give it a `key` of the text, so a new text starts typing from the beginning.
 */
export function TypedText({ text, className }: { text: string; className?: string }) {
  const [animate] = useState(prefersMotion)
  const [count, setCount] = useState(animate ? 0 : text.length)

  useEffect(() => {
    if (!animate) return
    const started = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const next = Math.min(text.length, Math.ceil(((now - started) / TOTAL_MS) * text.length))
      setCount(next)
      if (next < text.length) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [animate, text])

  if (count >= text.length) return <p className={className}>{text}</p>
  return (
    <p className={className}>
      <span aria-hidden="true">{text.slice(0, count)}</span>
      <span className="caret" aria-hidden="true" />
      <VisuallyHidden>{text}</VisuallyHidden>
    </p>
  )
}
