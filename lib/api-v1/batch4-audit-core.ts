import { z } from 'zod'
import { demandDigest } from '../x402/demand6/digest.ts'
import type { HandlerContract } from './types.ts'
export const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/)
export const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/)
export const count = z.number().int().min(0).max(1000000)
export const signed = z.number().int().min(-1000000000).max(1000000000)
export const utc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/).refine(s => {
  const d = new Date(s); return Number.isFinite(d.getTime()) && d.toISOString() === s && d.getUTCFullYear() >= 1600 && d.getUTCFullYear() <= 2099
})
export const text = z.string().min(1).max(200)
export const cents = z.string().regex(/^(0|[1-9][0-9]{0,15})$/)
export const list = <T extends z.ZodType>(schema: T, minimum = 0, maximum = 64) => z.array(schema).min(minimum).max(maximum)
export const object = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict()
export const input = <T extends z.ZodRawShape>(shape: T) => object({ dataClass: z.enum(['public', 'synthetic']), nonpersonalMetadata: z.literal(true), ...shape })
export type Finding = { code: string; recordIds: string[] }
export type Metric = { key: string; recordId: string; value: string }
export const finding = (code: string, ...recordIds: string[]): Finding => ({ code, recordIds })
export const metric = (key: string, recordId: string, value: number | bigint | string): Metric => ({ key, recordId, value: String(value) })
export function unique(values: string[]) { if (new Set(values).size !== values.length) throw Error('duplicate_ids_not_supported') }
export function cycles(rows: { id: string; parentId: string | null }[]) {
  unique(rows.map(r => r.id)); const byId = new Map(rows.map(r => [r.id, r])), cyclic = new Set<string>()
  for (const r of rows) { const path: string[] = []; let current: string | null = r.id
    while (current && byId.has(current)) { if (path.includes(current)) { path.slice(path.indexOf(current)).forEach(k => cyclic.add(k)); break }; path.push(current); current = byId.get(current)!.parentId }
  }
  return cyclic
}
export type AuditResult = { findings: Finding[]; metrics: Metric[] }
export type AuditSpec = { id: string; description: string; input: z.ZodType; codes: string[]; metricKeys: string[];
  sample: Record<string, unknown>; adverse: Record<string, unknown>; expectedCodes: string[];
  run(value: unknown): AuditResult }
export function auditHandler(spec: AuditSpec, amount: string): HandlerContract {
  const report = object({ method: z.literal(spec.id + '/1'), findings: list(object({ code: z.enum(spec.codes as [string, ...string[]]), recordIds: list(id, 0, 64) }), 0, 256),
    metrics: list(object({ key: z.enum(spec.metricKeys as [string, ...string[]]), recordId: id, value: z.string().regex(/^-?\d+(?:\.\d+|\/\d+)?$/).max(80) }), 0, 256),
    authoritativeSourcesConsulted: z.literal(false), domainValidationEstablished: z.literal(false) })
  const output = object({ version: z.literal('maha-typed-metadata-audit/1'), productId: z.literal(spec.id), inputHash: digest,
    result: report, resultHash: digest, chargedAmount: z.literal(amount), limitations: list(z.string().min(1).max(800), 1, 8) }).superRefine((r, ctx) => {
    if (r.resultHash !== demandDigest(r.result)) ctx.addIssue({ code: 'custom', message: 'result_hash_mismatch' })
  })
  const boundedInput = spec.input.refine(i => Buffer.byteLength(JSON.stringify(i)) <= 32768, 'metadata_input_over_32KiB')
  return { input: boundedInput, output, execute: async supplied => {
    const i = boundedInput.parse(supplied), computed = spec.run(i)
    const result = report.parse({ method: spec.id + '/1', ...computed, authoritativeSourcesConsulted: false, domainValidationEstablished: false })
    const data = output.parse({ version: 'maha-typed-metadata-audit/1', productId: spec.id, inputHash: demandDigest(i), result, resultHash: demandDigest(result), chargedAmount: amount,
      limitations: ['Public or synthetic nonpersonal metadata only; these are caller declarations, not automatic privacy detection.',
        'Checks inspect only supplied records, units, identities and source bindings; no external sources, models, hardware control or professional certification.',
        'Negative findings describe metadata, not legal effect, clinical efficacy, safety, fraud, causal effects or confirmed delivery.',
        'Result content is retained for 24 hours and minimal receipt metadata for 90 days; recovery does not extend deadlines. Hashes are not anonymization.'] })
    if (Buffer.byteLength(JSON.stringify(data)) > 65000) throw Error('metadata_result_over_65KB')
    return data
  } }
}
export function auditSchemas(spec: AuditSpec, amount: string) {
  const handler = auditHandler(spec, amount)
  return { input: z.toJSONSchema(spec.input), output: z.toJSONSchema(handler.output) }
}
