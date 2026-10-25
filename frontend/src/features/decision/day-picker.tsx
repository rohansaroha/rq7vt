import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons'
import { Flex, IconButton, Text, TextField } from '@radix-ui/themes'

import { addDays, clampDay, isDay } from '@/shared/dates'
import { formatDay } from '@/shared/format'

export function DayPicker({
  day,
  first,
  last,
  onChange,
}: {
  day: string
  first: string
  last: string
  onChange: (day: string) => void
}) {
  return (
    <Flex direction="column" gap="2">
      <Text as="label" htmlFor="delivery-day" size="1" weight="bold" color="gray">
        Delivery day
      </Text>
      <Flex align="center" gap="2" wrap="wrap">
        <IconButton
          variant="surface"
          color="gray"
          size="3"
          aria-label="Previous day"
          disabled={day <= first}
          onClick={() => onChange(addDays(day, -1))}
        >
          <ChevronLeftIcon />
        </IconButton>
        <TextField.Root
          id="delivery-day"
          type="date"
          size="3"
          value={day}
          min={first}
          max={last}
          onChange={(event) => {
            const value = event.target.value
            if (isDay(value)) onChange(clampDay(value, first, last))
          }}
        />
        <IconButton
          variant="surface"
          color="gray"
          size="3"
          aria-label="Next day"
          disabled={day >= last}
          onClick={() => onChange(addDays(day, 1))}
        >
          <ChevronRightIcon />
        </IconButton>
        <Text weight="bold">{formatDay(day)}</Text>
      </Flex>
    </Flex>
  )
}
