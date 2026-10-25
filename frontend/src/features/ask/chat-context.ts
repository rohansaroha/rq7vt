import { createContext, useContext } from 'react'

import type { Answer, AskData } from './answers'

export type ChatMessage =
  | { id: number; role: 'user'; text: string; at: number }
  | { id: number; role: 'assistant'; answer: Answer; at: number }

export type Chat = {
  messages: ChatMessage[]
  /** The assistant is "typing": a short pause before an answer, for the messenger feel. */
  thinking: boolean
  /** The floating chat window is open. */
  open: boolean
  setOpen: (open: boolean) => void
  ask: (question: string, data: AskData) => void
  reset: () => void
}

export const ChatContext = createContext<Chat | null>(null)

export function useChat(): Chat {
  const chat = useContext(ChatContext)
  if (!chat) throw new Error('useChat must be used inside <ChatProvider>')
  return chat
}

export function prefersMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches ?? false
}
