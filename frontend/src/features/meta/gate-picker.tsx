import { Flex, RadioCards, Text } from '@radix-ui/themes'

import type { Schema } from '@/shared/api/client'

/** Pick an auction by its gate closure. The value is the gate time, as the API takes it. */
export function GatePicker({
  gates,
  value,
  onChange,
}: {
  gates: Schema<'GatePreset'>[]
  value: string
  onChange: (gate: string) => void
}) {
  return (
    <Flex direction="column" gap="2">
      <Text id="gate-label" size="1" weight="bold" color="gray">
        Your auction (gate closes the day before)
      </Text>
      <RadioCards.Root
        aria-labelledby="gate-label"
        size="1"
        columns={{ initial: '3' }}
        gap="2"
        value={value}
        onValueChange={onChange}
      >
        {gates.map((gate) => (
          <RadioCards.Item key={gate.id} value={gate.time} title={gate.description}>
            <Flex direction="column">
              <Text weight="bold" className="tabular">
                {gate.time}
              </Text>
              <Text size="1" color="gray">
                {gate.label}
              </Text>
            </Flex>
          </RadioCards.Item>
        ))}
      </RadioCards.Root>
    </Flex>
  )
}
