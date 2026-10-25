import { Text } from '@radix-ui/themes'

import type { Schema } from '@/shared/api/client'
import { formatHours, formatUkTime, formatUkWeekday } from '@/shared/format'

/** One sentence that answers the page's question: which forecast did you bid with? */
export function BidCallout({ decision }: { decision: Schema<'DecisionResponse'> }) {
  const { run } = decision
  return (
    <Text as="p" size="2" style={{ color: 'var(--brand-ink)', margin: 0 }}>
      {run ? (
        <>
          You bid with the <strong>{formatUkTime(run.publish_time)} run</strong> published on{' '}
          {formatUkWeekday(run.publish_time)}. For this delivery day (23:00{' '}
          {formatUkWeekday(decision.starts_at)} to 23:00 {formatUkWeekday(decision.ends_at)}) it was
          looking{' '}
          <strong>
            {formatHours(run.lead_h.min_h)} to {formatHours(run.lead_h.max_h)}
          </strong>{' '}
          ahead.
        </>
      ) : (
        <>
          No forecast had been published before the {decision.gate.time} gate for this day, so there
          was nothing to bid with. The actuals are still shown.
        </>
      )}
    </Text>
  )
}
