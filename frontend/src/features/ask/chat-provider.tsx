import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { answerQuestion, type AskData } from './answers'
import { ChatContext, prefersMotion, type ChatMessage } from './chat-context'

const THINK_MS = 700

/**
 * One conversation for the whole app, so it carries on as you move between pages and
 * between the floating window and the full Ask page. It lives in memory only.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [thinking, setThinking] = useState(false)
  const [open, setOpen] = useState(false)
  const nextId = useRef(1)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const ask = useCallback((question: string, data: AskData) => {
    const text = question.trim()
    if (!text) return
    const answer = answerQuestion(text, data)
    setMessages((all) => [...all, { id: nextId.current++, role: 'user', text, at: Date.now() }])
    const reply = () =>
      setMessages((all) => [
        ...all,
        { id: nextId.current++, role: 'assistant', answer, at: Date.now() },
      ])
    if (!prefersMotion()) {
      reply()
      return
    }
    setThinking(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setThinking(false)
      reply()
    }, THINK_MS)
  }, [])

  const reset = useCallback(() => {
    window.clearTimeout(timer.current)
    setThinking(false)
    setMessages([])
  }, [])

  const value = useMemo(
    () => ({ messages, thinking, open, setOpen, ask, reset }),
    [messages, thinking, open, ask, reset],
  )
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
