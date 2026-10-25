import { InfoCircledIcon } from '@radix-ui/react-icons'
import { Popover, Text } from '@radix-ui/themes'

/** A definition behind a small (i): opens on click or tap, so it works on touch screens too. */
export function InfoTip({ term, text }: { term: string; text: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger>
        <button type="button" className="info-button" aria-label={`What ${term} means`}>
          <InfoCircledIcon />
        </button>
      </Popover.Trigger>
      <Popover.Content size="1" maxWidth="300px">
        <Text as="p" size="2">
          {text}
        </Text>
      </Popover.Content>
    </Popover.Root>
  )
}
