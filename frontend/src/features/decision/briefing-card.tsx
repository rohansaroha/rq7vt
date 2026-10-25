import { CheckIcon, CopyIcon, MagicWandIcon } from '@radix-ui/react-icons'
import { Button, Flex, Spinner, Text } from '@radix-ui/themes'
import { useEffect, useMemo, useState } from 'react'

import type { Schema } from '@/shared/api/client'
import { formatUkTime } from '@/shared/format'
import { Chip } from '@/shared/ui/chip'
import { Eyebrow } from '@/shared/ui/eyebrow'
import { TypedText } from '@/shared/ui/typed-text'

import { writeBriefing } from './insights'

type State = 'idle' | 'reading' | 'written'

const READING_MS = 750

/**
 * The prototype daily briefing: a note for the trading desk, written on request from
 * this screen's numbers. It is a template, labelled as a prototype; a production version
 * would give the same numbers to a language model as its only facts. Mount it with a
 * `key` per day and gate, so a new day starts unwritten.
 */
export function BriefingCard({
  decision,
  summary,
  gateLabel,
}: {
  decision: Schema<'DecisionResponse'>
  summary: Schema<'AccuracySummary'> | undefined
  gateLabel: string | undefined
}) {
  const [state, setState] = useState<State>('idle')
  const [copied, setCopied] = useState(false)
  const briefing = useMemo(
    () => writeBriefing(decision, summary, gateLabel),
    [decision, summary, gateLabel],
  )

  useEffect(() => {
    if (state !== 'reading') return
    const motion = window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches
    const timer = window.setTimeout(() => setState('written'), motion ? READING_MS : 0)
    return () => window.clearTimeout(timer)
  }, [state])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(briefing.text)
      setCopied(true)
    } catch {
      // Clipboard access can be refused (permissions, insecure context): nothing to do.
    }
  }

  const run = decision.run ? `the ${formatUkTime(decision.run.publish_time)} run` : 'the actuals'
  return (
    <section aria-label="Daily briefing" className="surface" style={{ padding: 20 }}>
      <Flex direction="column" gap="3">
        <Flex justify="between" align="start" gap="3" wrap="wrap">
          <Flex direction="column" gap="2">
            <Flex align="center" gap="2" wrap="wrap">
              <Eyebrow>Daily briefing</Eyebrow>
              <Chip tone="prototype" title="Written by a template from this page's numbers">
                Prototype
              </Chip>
            </Flex>
            <h2 className="card-title">A note for the trading desk, from this page’s numbers</h2>
          </Flex>
          <Flex gap="2" wrap="wrap">
            {state === 'written' ? (
              <Button variant="outline" onClick={() => void copy()}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? 'Copied' : 'Copy text'}
              </Button>
            ) : null}
            <Button
              onClick={() => setState('reading')}
              disabled={state === 'reading'}
              aria-label={state === 'written' ? 'Write the briefing again' : 'Write the briefing'}
            >
              <MagicWandIcon />
              {state === 'written' ? 'Write again' : 'Write the briefing'}
            </Button>
          </Flex>
        </Flex>

        {state === 'idle' ? (
          <Text as="p" size="2" color="gray">
            One click turns the forecast, the actuals, this gate’s month of errors and the learned
            correction into a short briefing you could paste into the desk’s chat.
          </Text>
        ) : null}
        {state === 'reading' ? (
          <Flex align="center" gap="2" role="status">
            <Spinner />
            <Text size="2" color="gray">
              Reading 24 hours, {run} and the month at this gate…
            </Text>
          </Flex>
        ) : null}
        {state === 'written' ? (
          <Flex direction="column" gap="3">
            <TypedText key={briefing.text} text={briefing.text} className="briefing-text" />
            <Flex gap="2" wrap="wrap" align="center">
              <Text size="1" color="gray">
                Sources
              </Text>
              {briefing.sources.map((source) => (
                <Chip key={source}>{source}</Chip>
              ))}
            </Flex>
          </Flex>
        ) : null}
        <Text as="p" size="1" color="gray" style={{ margin: 0 }}>
          Prototype: written by a template from the numbers on this page, so every figure is
          traceable. A live version would hand the same numbers to a language model as its only
          facts.
        </Text>
      </Flex>
    </section>
  )
}
