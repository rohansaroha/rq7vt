/**
 * Real API responses, computed by the backend on its synthetic test month
 * (`make web-fixtures`). JSON imports widen string literals, hence the casts.
 */
import type { Schema } from '@/shared/api/client'

import accuracyGate from './fixtures/accuracy-gate-0920.json'
import accuracyHorizon6 from './fixtures/accuracy-horizon-6.json'
import decision1530 from './fixtures/decision-2026-01-14-1530.json'
import decision from './fixtures/decision-2026-01-14.json'
import leadTime from './fixtures/lead-time.json'
import meta from './fixtures/meta.json'
import runs from './fixtures/runs-2026-01-14.json'

export const fixtures = {
  meta: meta as Schema<'MetaResponse'>,
  decision: decision as Schema<'DecisionResponse'>,
  decision1530: decision1530 as Schema<'DecisionResponse'>,
  runs: runs as Schema<'RunsResponse'>,
  accuracyGate: accuracyGate as Schema<'AccuracySummary'>,
  accuracyHorizon6: accuracyHorizon6 as Schema<'AccuracySummary'>,
  leadTime: leadTime as Schema<'LeadTimeResponse'>,
}
