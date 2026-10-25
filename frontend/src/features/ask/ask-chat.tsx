import { Cross2Icon, EnterFullScreenIcon, PaperPlaneIcon, ResetIcon } from '@radix-ui/react-icons'
import { Text } from '@radix-ui/themes'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

import { Chip } from '@/shared/ui/chip'
import { QueryError } from '@/shared/ui/query-error'
import { TurbineIcon } from '@/shared/ui/turbine-icon'
import { TypedText } from '@/shared/ui/typed-text'

import { SUGGESTIONS, type Answer, type FollowUp } from './answers'
import { useChat, type ChatMessage } from './chat-context'
import { useAskData } from './use-ask-data'

const CLOCK = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

/**
 * The "Ask the data" messenger: questions in dark bubbles on the right, answers in white
 * bubbles on the left with their figures, sources and quick replies, and a composer at the
 * bottom. `panel` is the floating window; `page` fills the Ask page.
 */
export function AskChat({ variant, onClose }: { variant: 'panel' | 'page'; onClose?: () => void }) {
  const { data, error, retry } = useAskData(true)
  const chat = useChat()
  const [draft, setDraft] = useState('')
  const body = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const busy = !data || chat.thinking
  // Replies already in the conversation when this view opened do not type themselves again.
  const [seenUpTo] = useState(() => chat.messages.at(-1)?.id ?? 0)

  // Keep the newest message in view.
  useEffect(() => {
    const el = body.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.messages.length, chat.thinking])

  // The floating window takes focus when it opens, so you can type straight away.
  useEffect(() => {
    if (variant === 'panel') input.current?.focus()
  }, [variant])

  const send = (question: string) => {
    if (!data || chat.thinking || !question.trim()) return
    chat.ask(question, data)
    setDraft('')
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    send(draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send(draft)
    }
  }

  return (
    <section className="chat" data-variant={variant} aria-label="Ask the data">
      <header className="chat-header">
        <span className="chat-avatar" aria-hidden="true">
          <TurbineIcon size={20} color="#fff" />
        </span>
        <div className="chat-who">
          <span className="chat-name">Desk assistant</span>
          <span className="chat-status">
            <span className="chat-dot" aria-hidden="true" />
            Prototype · answers from the API
          </span>
        </div>
        <div className="chat-actions">
          {chat.messages.length ? (
            <button
              type="button"
              className="chat-icon-button"
              aria-label="Start a new chat"
              title="New chat"
              onClick={chat.reset}
            >
              <ResetIcon />
            </button>
          ) : null}
          {variant === 'panel' ? (
            <>
              <Link
                to="/ask"
                className="chat-icon-button"
                aria-label="Open the full page"
                title="Full page"
                onClick={onClose}
              >
                <EnterFullScreenIcon />
              </Link>
              <button
                type="button"
                className="chat-icon-button"
                aria-label="Close the chat"
                title="Close"
                onClick={onClose}
              >
                <Cross2Icon />
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="chat-body" ref={body} role="log" aria-live="polite" aria-label="Conversation">
        <div className="msg msg-bot">
          <span className="chat-avatar small" aria-hidden="true">
            <TurbineIcon size={14} color="#fff" />
          </span>
          <div className="msg-stack">
            <div className="bubble bubble-bot">
              <p className="bubble-text">
                Hi, I’m the desk assistant. Ask me about January’s wind forecasts: a day, the cover
                to hold, the auctions, or the learned correction. I answer from this app’s own
                numbers and show my sources.
              </p>
            </div>
            <div className="quick-replies" role="group" aria-label="Suggested questions">
              {SUGGESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="quick-reply"
                  disabled={busy}
                  onClick={() => send(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        </div>

        {chat.messages.map((message, index) => (
          <Message
            key={message.id}
            message={message}
            fresh={message.id > seenUpTo}
            latest={index === chat.messages.length - 1}
            busy={busy}
            onAsk={send}
          />
        ))}

        {chat.thinking ? (
          <div className="msg msg-bot" aria-label="The assistant is typing">
            <span className="chat-avatar small" aria-hidden="true">
              <TurbineIcon size={14} color="#fff" />
            </span>
            <div className="bubble bubble-bot typing" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}

        {error ? <QueryError error={error} onRetry={retry} /> : null}
      </div>

      <form className="chat-composer" onSubmit={onSubmit} aria-label="Ask a question">
        <textarea
          ref={input}
          rows={1}
          className="chat-input"
          placeholder={data ? 'Ask about a day, the cover, the auctions…' : 'Loading the numbers…'}
          aria-label="Your question"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="submit"
          className="chat-send"
          aria-label="Send"
          disabled={busy || !draft.trim()}
        >
          <PaperPlaneIcon />
        </button>
      </form>
      <p className="chat-note">
        Prototype: rules and templates over the app’s API, no language model. Every figure is
        traceable.
      </p>
    </section>
  )
}

function Message({
  message,
  fresh,
  latest,
  busy,
  onAsk,
}: {
  message: ChatMessage
  fresh: boolean
  latest: boolean
  busy: boolean
  onAsk: (question: string) => void
}) {
  const time = <time className="msg-time">{CLOCK.format(message.at)}</time>
  if (message.role === 'user') {
    return (
      <div className="msg msg-user">
        <div className="msg-stack">
          <div className="bubble bubble-user">{message.text}</div>
          {time}
        </div>
      </div>
    )
  }
  return (
    <div className="msg msg-bot">
      <span className="chat-avatar small" aria-hidden="true">
        <TurbineIcon size={14} color="#fff" />
      </span>
      <div className="msg-stack">
        <AnswerBubble answer={message.answer} fresh={fresh} />
        {latest && message.answer.followUps.length ? (
          <div className="quick-replies" role="group" aria-label="Follow-up questions">
            {message.answer.followUps.map((followUp) => (
              <FollowUpButton
                key={followUpKey(followUp)}
                followUp={followUp}
                disabled={busy}
                onAsk={onAsk}
              />
            ))}
          </div>
        ) : null}
        {time}
      </div>
    </div>
  )
}

function AnswerBubble({ answer, fresh }: { answer: Answer; fresh: boolean }) {
  return (
    <article className="bubble bubble-bot" aria-label={answer.eyebrow}>
      <p className="bubble-eyebrow">{answer.eyebrow}</p>
      <TypedText text={answer.text} className="bubble-text" animate={fresh} />
      {answer.figures.length ? (
        <dl className="bubble-figures tabular">
          {answer.figures.map((figure) => (
            <div key={figure.label}>
              <dt>{figure.label}</dt>
              <dd>
                {figure.was ? (
                  <>
                    <span className="was">{figure.was}</span> →{' '}
                    <span className="now">{figure.value}</span>
                  </>
                ) : (
                  figure.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {answer.sources.length ? (
        <div className="bubble-sources">
          <Text size="1" color="gray">
            Sources
          </Text>
          {answer.sources.map((source) => (
            <Chip key={source}>{source}</Chip>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function followUpKey(followUp: FollowUp): string {
  return followUp.kind === 'ask' ? followUp.question : followUp.label
}

function FollowUpButton({
  followUp,
  disabled,
  onAsk,
}: {
  followUp: FollowUp
  disabled: boolean
  onAsk: (question: string) => void
}) {
  switch (followUp.kind) {
    case 'ask':
      return (
        <button
          type="button"
          className="quick-reply"
          disabled={disabled}
          onClick={() => onAsk(followUp.question)}
        >
          {followUp.question}
        </button>
      )
    case 'day':
      return (
        <Link
          className="quick-reply"
          data-kind="link"
          to="/"
          search={{ day: followUp.day, gate: followUp.gate, corrected: followUp.corrected }}
        >
          {followUp.label} →
        </Link>
      )
    case 'accuracy':
      return (
        <Link
          className="quick-reply"
          data-kind="link"
          to="/accuracy"
          search={{ mode: followUp.mode, forecast: followUp.forecast }}
        >
          {followUp.label} →
        </Link>
      )
  }
}
