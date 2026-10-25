import { Flex, Heading, Text } from '@radix-ui/themes'
import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <Flex direction="column" gap="2">
      <Heading size="7">Page not found</Heading>
      <Text color="gray">
        Try the <Link to="/">decision view</Link> instead.
      </Text>
    </Flex>
  )
}
