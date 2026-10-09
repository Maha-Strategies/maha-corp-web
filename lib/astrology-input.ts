import { z } from 'zod'
import { buildBirthReport } from './birth-report.ts'
export const astrologyChartInput = z.object({ instantUtc: z.iso.datetime(), latitudeDegrees: z.number().min(-90).max(90), longitudeDegrees: z.number().min(-180).max(180), uncertaintyMinutes: z.number().min(0).max(120), referenceInstantUtc: z.iso.datetime() }).strict()
export type AstrologyChartInput = z.infer<typeof astrologyChartInput>
export const secondaryChartInput = z.object({ kind: z.enum(['corporate', 'partner']), label: z.string().trim().min(1).max(80), chart: astrologyChartInput }).strict()
export function checkedBirthReport(input: AstrologyChartInput) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:00(?:\.000)?Z$/.test(input.instantUtc)) throw new Error('unsupported_birth_precision')
  return buildBirthReport({ date: input.instantUtc.slice(0, 10), time: input.instantUtc.slice(11, 16), timeZone: 'UTC', latitudeDegrees: input.latitudeDegrees, longitudeDegrees: input.longitudeDegrees, birthTimeUncertaintyMinutes: input.uncertaintyMinutes, timingInstantUtc: input.referenceInstantUtc })
}
