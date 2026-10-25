import { z } from 'zod'

import { isDay } from '@/shared/dates'

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
export const DEFAULT_GATE = '09:20'

/**
 * The Decision view's state lives in the URL, so any view can be bookmarked or shared.
 * Invalid values fall back to defaults instead of breaking the page.
 */
export const decisionSearchSchema = z.object({
  day: z.string().refine(isDay).optional().catch(undefined),
  gate: z.string().regex(HHMM).default(DEFAULT_GATE).catch(DEFAULT_GATE),
  compare: z.string().optional().catch(undefined),
  band: z.boolean().default(true).catch(true),
  corrected: z.boolean().default(false).catch(false),
})

export type DecisionSearch = z.infer<typeof decisionSearchSchema>
