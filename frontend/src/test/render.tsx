import { Theme } from '@radix-ui/themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'

import { AppProviders } from '@/app/providers'
import { createAppRouter } from '@/app/router'

function testQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
}

export function renderWithProviders(ui: ReactElement) {
  return render(
    <QueryClientProvider client={testQueryClient()}>
      <Theme>{ui}</Theme>
    </QueryClientProvider>,
  )
}

/** The whole app (router, loaders, URL state) at `url`, against the mock API. */
export function renderApp(url: string) {
  const queryClient = testQueryClient()
  const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: [url] }))
  const view = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...view, router }
}
