import { Grid, Text } from '@radix-ui/themes'

import { Chip } from '@/shared/ui/chip'
import { Eyebrow } from '@/shared/ui/eyebrow'
import { PageHeader } from '@/shared/ui/page-header'

import { AskChat } from './ask-chat'

const ENDPOINTS = [
  '/accuracy/days',
  '/accuracy/summary · each auction',
  '/accuracy/summary · learned correction',
  '/accuracy/lead-time',
  '/meta',
]

const TOPICS = [
  'The worst and best delivery day, or any day by date',
  'How much extra cover to hold, as published and corrected',
  'Which auction gate bids on the best forecast',
  'Whether the forecast runs high, and what the learned correction is worth',
  'How the miss grows with lead time',
]

/** The Ask page: the same conversation as the floating window, full size. */
export function AskView() {
  return (
    <>
      <PageHeader
        eyebrow="Desk assistant"
        chips={
          <Chip tone="prototype" title="Answers are composed by rules and templates">
            Prototype
          </Chip>
        }
        title={
          <>
            Ask the <em>data</em>
          </>
        }
        lead="A chat for the buying desk: plain-English questions about the period’s wind forecasts, answered from the same numbers as the rest of the app, with the sources each answer used."
      />
      <Grid columns={{ initial: '1', md: 'minmax(0, 1fr) 300px' }} gap="4" align="start" mt="5">
        <AskChat variant="page" />
        <aside className="surface ask-aside" aria-label="How the assistant works">
          <Eyebrow tone="muted">What it can answer</Eyebrow>
          <ul className="ask-topics">
            {TOPICS.map((topic) => (
              <li key={topic}>{topic}</li>
            ))}
          </ul>
          <Eyebrow tone="muted">Grounded in the API</Eyebrow>
          <Text as="p" size="2" color="gray">
            Each answer is built from the endpoints the other pages use, and lists the ones it read:
          </Text>
          <div className="ask-endpoints">
            {ENDPOINTS.map((endpoint) => (
              <Chip key={endpoint}>{endpoint}</Chip>
            ))}
          </div>
          <Eyebrow tone="muted">Next step</Eyebrow>
          <Text as="p" size="2" color="gray">
            Put a language model in front of the same endpoints, as its tools. It picks the numbers
            and writes the reply; the numbers still come from the API, so answers stay checkable.
          </Text>
        </aside>
      </Grid>
    </>
  )
}
