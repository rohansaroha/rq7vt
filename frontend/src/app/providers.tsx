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
      <Theme accentColor="green" grayColor="sand" radius="none" appearance="light">
        {children}
      </Theme>
    </QueryClientProvider>
  )
}
