import { ChatBubbleIcon, Cross2Icon } from '@radix-ui/react-icons'
import { useRouterState } from '@tanstack/react-router'
import type { KeyboardEvent } from 'react'

import { AskChat } from './ask-chat'
import { useChat } from './chat-context'

/** The floating "Ask the data" button and the chat window it opens, on every page but /ask. */
export function ChatLauncher() {
  const chat = useChat()
  const onAskPage = useRouterState({ select: (state) => state.location.pathname === '/ask' })
  if (onAskPage) return null

  const close = () => chat.setOpen(false)
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close()
  }

  return (
    <>
      {chat.open ? (
        <div className="chat-panel" role="dialog" aria-label="Ask the data" onKeyDown={onKeyDown}>
          <AskChat variant="panel" onClose={close} />
        </div>
      ) : null}
      <button
        type="button"
        className="chat-launcher"
        data-open={chat.open}
        aria-expanded={chat.open}
        aria-label={chat.open ? 'Close the chat' : 'Ask the data'}
        onClick={() => chat.setOpen(!chat.open)}
      >
        {chat.open ? (
          <Cross2Icon width={18} height={18} />
        ) : (
          <ChatBubbleIcon width={18} height={18} />
        )}
        <span className="chat-launcher-label">{chat.open ? 'Close' : 'Ask the data'}</span>
      </button>
    </>
  )
}
