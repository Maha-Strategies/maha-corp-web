import { z } from 'zod'
import { amountWithinBand, type ValuePricing } from './value-staircase.ts'
import { assertExecutionCost, type ExecutionCost } from './cost-policy.ts'
export const DOMAINS = ['context', 'verify', 'compute', 'celestial', 'intel', 'library'] as const
export type Domain = typeof DOMAINS[number]
export const PRICE_FLOOR_UNITS = 10000
export const TARGET_COUNT = 1000
export const RETENTION_SECONDS = 86400
export const PUBLICATION_RECOVERY_SECONDS = 30 * 86400
export const RECEIPT_RETENTION_SECONDS = 90 * 86400
export const recoverySeconds = (endpoint: Endpoint) => endpoint.recoverySeconds ?? RETENTION_SECONDS
export type JsonSchema = Record<string, unknown>
export type Endpoint = {
  id: string; name: string; description: string; path: string; method: 'GET' | 'POST';
  price_usdc: number; amount: string; domain: Domain; category: string; tags: string[];
  schema: { input: JsonSchema; output: JsonSchema }; estimated_compute_cost: number;
  cost_basis: 'unmeasured-planning-assumption'; status: 'proposal' | 'legacy-unported' | 'local-implemented' | 'released';
  schema_status: 'draft' | 'legacy' | 'validated-local'; legacy?: { path: string; amount: string; supersededAmounts: readonly string[] };
  handlerId?: string; productionApproved: boolean; sourceReview: 'pending' | 'not-applicable';
  recoverySeconds?: number;
  pricing?: ValuePricing; execution_cost?: ExecutionCost;
}
export type HandlerContract = { input: z.ZodType; output: z.ZodType; execute(input: unknown): Promise<unknown>;
  beforeSettlement?(input: unknown): Promise<void>;
  recoverCorrection?(input: unknown, purchasedData: unknown): Promise<unknown> }
export function assertEndpoint(e: Endpoint) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.id) || !DOMAINS.includes(e.domain)
    || !new RegExp(`^/api/v1/${e.domain}/[a-z0-9]+(?:-[a-z0-9]+)*/[a-z0-9]+(?:-[a-z0-9]+)*$`).test(e.path)
    || !['GET', 'POST'].includes(e.method) || !/^\d+$/.test(e.amount)
    || !Number.isSafeInteger(Number(e.amount)) || Number(e.amount) < PRICE_FLOOR_UNITS
    || e.price_usdc !== Number(e.amount) / 1e6 || !Number.isFinite(e.estimated_compute_cost) || e.estimated_compute_cost < 0
    || !e.schema.input || !e.schema.output || !e.tags.length) throw new Error('invalid_endpoint_registry_entry:' + e.id)
  if (e.recoverySeconds !== undefined && ![RETENTION_SECONDS, PUBLICATION_RECOVERY_SECONDS].includes(e.recoverySeconds)) throw Error('unsupported_recovery_policy')
  if (!e.pricing || e.pricing.policy !== 'maha-value-staircase/1' || !amountWithinBand(e.amount, e.pricing.tier)) throw Error('endpoint_outside_value_staircase')
  if (e.execution_cost?.expected_usdc !== e.estimated_compute_cost) throw Error('execution_cost_estimate_mismatch')
  assertExecutionCost(e.amount, e.execution_cost)
  if (e.productionApproved && (e.status !== 'released' || e.schema_status !== 'validated-local' || e.sourceReview === 'pending')) throw new Error('unreviewed_production_endpoint')
}
export function assertRegistry(entries: readonly Endpoint[]) {
  if (entries.length > TARGET_COUNT) throw new Error('registry_capacity_exceeded')
  const ids = new Set<string>(), paths = new Set<string>()
  for (const e of entries) {
    assertEndpoint(e)
    const key = `${e.method}:${e.path}`
    if (ids.has(e.id) || paths.has(key)) throw new Error('duplicate_registry_identity')
    ids.add(e.id); paths.add(key)
  }
}
export const executionEnvelope = (data: z.ZodType) => z.object({ success: z.literal(true), data,
  proof: z.object({ settlement_id: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }).strict() }).strict()
