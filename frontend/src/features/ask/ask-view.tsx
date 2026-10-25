import { PaperPlaneIcon } from '@radix-ui/react-icons'
import { Button, Flex, Skeleton, Text, TextField } from '@radix-ui/themes'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { accuracySummaryQuery, daysQuery, leadTimeQuery } from '@/features/accuracy/queries'
import { DEFAULT_GATE } from '@/features/decision/search'
import { metaQuery } from '@/features/meta/queries'
import { formatPercent } from '@/shared/format'
import { Chip } from '@/shared/ui/chip'
import { Eyebrow } from '@/shared/ui/eyebrow'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { StatTile } from '@/shared/ui/stat-tile'
import { TypedText } from '@/shared/ui/typed-text'

import { SUGGESTIONS, answerQuestion, type Answer, type AskData, type FollowUp } from './answers'

type Turn = { id: number; question: string; answer: Answer }

/** Everything the prototype answers from: the same API calls the other pages make. */
function useAskData(): { data?: AskData; error?: Error; retry: () => void } {
  const meta = useQuery(metaQuery())
  const gate = meta.data?.default_gate ?? DEFAULT_GATE
  const days = useQuery(daysQuery(gate))
  const corrected = useQuery(accuracySummaryQuery({ mode: 'gate', gate, forecast: 'corrected' }))
  const leadTime = useQuery(leadTimeQuery())
  const gates = meta.data?.gates ?? []
  const summaries = useQueries({
    queries: gates.map((g) => accuracySummaryQuery({ mode: 'gate', gate: g.time })),
  })
  const all = [meta, days, corrected, leadTime, ...summaries]
  const failed = all.find((q) => q.isError)
  const retry = () => all.filter((q) => q.isError).forEach((q) => void q.refetch())
  if (failed) return { error: failed.error ?? undefined, retry }
  if (!meta.data || !days.data || !corrected.data || !leadTime.data) return { retry }
  if (summaries.some((q) => !q.data)) return { retry }
  return {
    retry,
    data: {
      meta: meta.data,
      gate,
      days: days.data.days,
      corrected: corrected.data,
      leadTime: leadTime.data,
      summaries: Object.fromEntries(
        gates.flatMap((g, i) => {
          const summary = summaries[i]?.data
          return summary ? [[g.time, summary]] : []
        }),
      ),
    },
  }
}

export function AskView() {
  const { data, error, retry } = useAskData()
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const last = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (turns.length) last.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [turns.length])

  const ask = (question: string) => {
    const text = question.trim()
    if (!data || !text) return
    setTurns((previous) => [
      ...previous,
      { id: previous.length + 1, question: text, answer: answerQuestion(text, data) },
    ])
    setDraft('')
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    ask(draft)
  }

  const published = data?.summaries[data.gate]?.metrics.mae_mw
  const correctedMae = data?.corrected.metrics.mae_mw
  const cut =
    published != null && correctedMae != null && published > 0
      ? 1 - correctedMae / published
      : undefined

  return (
    <Flex direction="column" gap="5">
      <PageHeader
        eyebrow="Agent workspace"
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
        lead="Plain-English questions about the period’s wind forecasts, answered from the same numbers as the rest of the app, with the sources each answer used."
      />

      {error ? <QueryError error={error} onRetry={retry} /> : null}

      <section aria-label="Agent workspace" className="surface" style={{ padding: 20 }}>
        <Flex direction="column" gap="4">
          <div className="stat-grid">
            <StatTile loading={!data} label="Delivery days" value={data?.days.length ?? '–'} />
            <StatTile
              loading={!data}
              label="Hours scored"
              value={data ? data.days.reduce((n, d) => n + d.hours_scored, 0) : '–'}
            />
            <StatTile loading={!data} label="Auctions" value={data?.meta.gates.length ?? '–'} />
            <StatTile
              loading={!data}
              label="Correction gain"
              value={cut == null ? '–' : `−${formatPercent(cut, 0)}`}
              note="Typical miss, learned correction"
            />
          </div>

          <Flex justify="between" align="center" gap="3" wrap="wrap">
            <Eyebrow tone="muted">Try a question</Eyebrow>
            <Chip>Answers from the API · no language model</Chip>
          </Flex>
          <Flex gap="2" wrap="wrap" role="group" aria-label="Suggested questions">
            {SUGGESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                className="chip-button"
                disabled={!data}
                onClick={() => ask(question)}
              >
                {question}
              </button>
            ))}
          </Flex>

          {data ? (
            <div className="chat-log" aria-live="polite">
              {turns.map((turn) => (
                <Flex key={turn.id} direction="column" gap="3">
                  <div className="bubble-user">{turn.question}</div>
                  <AnswerCard answer={turn.answer} onAsk={ask} />
                </Flex>
              ))}
              <div ref={last} />
            </div>
          ) : error ? null : (
            <Skeleton height="120px" />
          )}

          <form onSubmit={onSubmit} aria-label="Ask a question">
            <Flex gap="2" align="center">
              <TextField.Root
                size="3"
                style={{ flex: 1 }}
                placeholder="Ask about a day, the buffer, the auctions or the correction…"
                aria-label="Your question"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button size="3" type="submit" disabled={!data || !draft.trim()}>
                <PaperPlaneIcon />
                Ask
              </Button>
            </Flex>
          </form>
        </Flex>
      </section>

      <Text size="1" color="gray">
        Prototype: answers are composed by rules and templates from the app’s own API, so every
        figure can be traced to its source. A production version would put a language model in front
        of the same endpoints, as its tools, and keep that grounding.
      </Text>
    </Flex>
  )
}

function AnswerCard({ answer, onAsk }: { answer: Answer; onAsk: (question: string) => void }) {
  return (
    <article className="answer-card" aria-label={answer.eyebrow}>
      <Flex direction="column" gap="3">
        <Eyebrow>{answer.eyebrow}</Eyebrow>
        <TypedText key={answer.text} text={answer.text} className="briefing-text" />
        {answer.figures.length ? (
          <Flex direction="column" gap="2">
            {answer.figures.map((figure) => (
              <div key={figure.label} className="figure-row tabular">
                <Text color="gray">{figure.label}</Text>
                <Text align="right">
                  {figure.was ? (
                    <>
                      <span className="was">{figure.was}</span> →{' '}
                      <span className="now">{figure.value}</span>
                    </>
                  ) : (
                    <strong>{figure.value}</strong>
                  )}
                </Text>
              </div>
            ))}
          </Flex>
        ) : null}
        {answer.sources.length ? (
          <Flex gap="2" wrap="wrap" align="center">
            <Text size="1" color="gray">
              Sources
            </Text>
            {answer.sources.map((source) => (
              <Chip key={source}>{source}</Chip>
            ))}
          </Flex>
        ) : null}
        <Flex gap="2" wrap="wrap">
          {answer.followUps.map((followUp) => (
            <FollowUpButton key={followUpKey(followUp)} followUp={followUp} onAsk={onAsk} />
          ))}
        </Flex>
      </Flex>
    </article>
  )
}

function followUpKey(followUp: FollowUp): string {
  return followUp.kind === 'ask' ? followUp.question : followUp.label
}

function FollowUpButton({
  followUp,
  onAsk,
}: {
  followUp: FollowUp
  onAsk: (question: string) => void
}) {
  switch (followUp.kind) {
    case 'ask':
      return (
        <button type="button" className="chip-button" onClick={() => onAsk(followUp.question)}>
          {followUp.question}
        </button>
      )
    case 'day':
      return (
        <Link
          className="chip-button"
          to="/"
          search={{ day: followUp.day, gate: followUp.gate, corrected: followUp.corrected }}
        >
          {followUp.label} →
        </Link>
      )
    case 'accuracy':
      return (
        <Link
          className="chip-button"
          to="/accuracy"
          search={{ mode: followUp.mode, forecast: followUp.forecast }}
        >
          {followUp.label} →
        </Link>
      )
  }
}
