import { useQueries, useQuery } from '@tanstack/react-query'

import { accuracySummaryQuery, daysQuery, leadTimeQuery } from '@/features/accuracy/queries'
import { DEFAULT_GATE } from '@/features/decision/search'
import { metaQuery } from '@/features/meta/queries'

import type { AskData } from './answers'

/**
 * Everything the chat answers from: the same API calls the other pages make, so the
 * cache they fill is shared. Nothing is fetched until `enabled` (the chat is open).
 */
export function useAskData(enabled = true): {
  data?: AskData
  error?: Error
  retry: () => void
} {
  const meta = useQuery({ ...metaQuery(), enabled })
  const gate = meta.data?.default_gate ?? DEFAULT_GATE
  const ready = enabled && meta.data != null
  const days = useQuery({ ...daysQuery(gate), enabled: ready })
  const corrected = useQuery({
    ...accuracySummaryQuery({ mode: 'gate', gate, forecast: 'corrected' }),
    enabled: ready,
  })
  const leadTime = useQuery({ ...leadTimeQuery(), enabled: ready })
  const gates = meta.data?.gates ?? []
  const summaries = useQueries({
    queries: gates.map((g) => ({
      ...accuracySummaryQuery({ mode: 'gate', gate: g.time }),
      enabled: ready,
    })),
  })
  const all = [meta, days, corrected, leadTime, ...summaries]
  const failed = all.find((q) => q.isError)
  const retry = () => all.filter((q) => q.isError).forEach((q) => void q.refetch())
  if (failed) return { error: failed.error ?? undefined, retry }
  if (!meta.data || !days.data || !corrected.data || !leadTime.data) return { retry }
  if (summaries.some((q) => !q.data)) return { retry }
  return {
    retry,
    data: {
      meta: meta.data,
      gate,
      days: days.data.days,
      corrected: corrected.data,
      leadTime: leadTime.data,
      summaries: Object.fromEntries(
        gates.flatMap((g, i) => {
          const summary = summaries[i]?.data
          return summary ? [[g.time, summary]] : []
        }),
      ),
    },
  }
}
