import { ExclamationTriangleIcon } from '@radix-ui/react-icons'
import { Button, Callout, Flex } from '@radix-ui/themes'

import { ApiError } from '@/shared/api/client'

/** One error block for every failed request: the API's problem detail, and a retry. */
export function QueryError({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const detail =
    error instanceof ApiError
      ? (error.problem?.detail ?? error.problem?.title ?? error.message)
      : 'The API could not be reached. Check that it is running.'
  const requestId = error instanceof ApiError ? error.requestId : undefined
  return (
    <Callout.Root color="red" role="alert">
      <Callout.Icon>
        <ExclamationTriangleIcon />
      </Callout.Icon>
      <Flex direction="column" gap="2" align="start">
        <Callout.Text>
          {detail}
          {requestId ? ` (request ${requestId})` : null}
        </Callout.Text>
        {onRetry ? (
          <Button size="1" variant="soft" color="red" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </Flex>
    </Callout.Root>
  )
}
