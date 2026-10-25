import { z } from 'zod'

import { DEFAULT_GATE } from '@/features/decision/search'

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export const accuracySearchSchema = z.object({
  mode: z.enum(['gate', 'horizon']).default('gate').catch('gate'),
  gate: z.string().regex(HHMM).default(DEFAULT_GATE).catch(DEFAULT_GATE),
  horizon: z.number().int().min(0).max(48).default(24).catch(24),
  ratio: z.number().int().min(1).max(20).default(9).catch(9),
})

export type AccuracySearch = z.infer<typeof accuracySearchSchema>
