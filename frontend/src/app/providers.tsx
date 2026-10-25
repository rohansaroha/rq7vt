import { Theme } from '@radix-ui/themes'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

export function AppProviders({
  queryClient,
  children,
}: {
  queryClient: QueryClient
  children: ReactNode
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme accentColor="indigo" grayColor="slate" radius="medium" appearance="light">
        {children}
      </Theme>
    </QueryClientProvider>
  )
}
