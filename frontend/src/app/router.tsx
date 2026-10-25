import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  type RouterHistory,
} from '@tanstack/react-router'

import { AppShell } from '@/app/app-shell'
import { accuracySummaryQuery, leadTimeQuery } from '@/features/accuracy/queries'
import { accuracySearchSchema } from '@/features/accuracy/search'
import { resolveDay } from '@/features/decision/day'
import { decisionQuery, runsQuery } from '@/features/decision/queries'
import { decisionSearchSchema } from '@/features/decision/search'
import { metaQuery } from '@/features/meta/queries'
import { DecisionPage } from '@/routes/decision-page'
import { NotFoundPage } from '@/routes/not-found-page'
import { RouteError } from '@/routes/route-error'

export type RouterContext = { queryClient: QueryClient }

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: AppShell,
  notFoundComponent: NotFoundPage,
})

// Loaders start every request a page needs at once, before it renders, and again when a
// link is hovered (preload on intent). TanStack Query owns caching and freshness.
const decisionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: decisionSearchSchema,
  loaderDeps: ({ search }) => ({ day: search.day, gate: search.gate }),
  loader: async ({ context: { queryClient }, deps }) => {
    const meta = await queryClient.ensureQueryData(metaQuery())
    const day = resolveDay(deps.day, meta.period)
    void queryClient.prefetchQuery(decisionQuery(day, deps.gate))
    void queryClient.prefetchQuery(runsQuery(day))
    void queryClient.prefetchQuery(accuracySummaryQuery({ mode: 'gate', gate: deps.gate }))
  },
  component: DecisionPage,
})

const accuracyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accuracy',
  validateSearch: accuracySearchSchema,
  loaderDeps: ({ search }) => ({ mode: search.mode, gate: search.gate, horizon: search.horizon }),
  loader: ({ context: { queryClient }, deps }) => {
    void queryClient.prefetchQuery(metaQuery())
    void queryClient.prefetchQuery(
      accuracySummaryQuery(
        deps.mode === 'gate'
          ? { mode: 'gate', gate: deps.gate }
          : { mode: 'horizon', horizon: deps.horizon },
      ),
    )
    void queryClient.prefetchQuery(leadTimeQuery())
  },
  // Code-split: this page's code (and its charts) download only when first needed.
  component: lazyRouteComponent(() => import('@/routes/accuracy-page'), 'AccuracyPage'),
})

const methodRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/method',
  component: lazyRouteComponent(() => import('@/routes/method-page'), 'MethodPage'),
})

const routeTree = rootRoute.addChildren([decisionRoute, accuracyRoute, methodRoute])

export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    context: { queryClient },
    history,
    defaultPreload: 'intent',
    // Let TanStack Query decide what is stale; the router should always ask it.
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteError,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
