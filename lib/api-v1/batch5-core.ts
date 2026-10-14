import { z } from 'zod'
import { object, list, id, digest, utc, type AuditResult, type AuditSpec } from './batch4-audit-core.ts'
export { input, object, list, id, digest, utc, text, count, signed, cents, finding, metric, unique, cycles } from './batch4-audit-core.ts'
export type { AuditResult, AuditSpec, Finding } from './batch4-audit-core.ts'
export const base = { dataClass: 'synthetic', nonpersonalMetadata: true }
export const hash = 'sha256:' + 'a'.repeat(64), otherHash = 'sha256:' + 'b'.repeat(64)
export const time = '2026-01-01T00:00:00.000Z', later = '2026-02-01T00:00:00.000Z'
export const records = <T extends z.ZodRawShape>(shape: T, minimum = 1) => list(object({ id, ...shape }), minimum, 32)
export const spec = <S extends z.ZodType>(id: string, description: string, schema: S,
  sample: Record<string, unknown>, adverse: Record<string, unknown>, codes: string[], metricKeys: string[],
  run: (value: z.output<S>) => AuditResult): AuditSpec => ({ id, description, input: schema,
    sample: { ...base, ...sample }, adverse: { ...base, ...adverse }, codes, expectedCodes: codes.slice(0, 1), metricKeys,
    run: value => run(schema.parse(value)) })
export const field = object({ name: id, type: z.enum(['text', 'identifier', 'minor-units', 'utc', 'integer', 'boolean']), required: z.boolean(), nullable: z.boolean() })
export const pin = object({ id, revision: digest })
export const interval = { startsAt: utc, endsAt: utc.nullable() }
