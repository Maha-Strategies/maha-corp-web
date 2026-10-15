import { z } from 'zod'
import { input, id, digest, utc, unique } from './batch5-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
import { compileContextPack, parseContextPackRequest } from '../context-compiler.ts'
import { evaluateContextPack, parseContextEvaluationRequest } from '../context-pack-evaluator.ts'
import { buildContextBudgetLadder, buildEvidenceRetentionMatrix } from '../x402/context-product-family.ts'
import { contextPackSchema, DEEP_CONTEXT_EVALUATION_DISCOVERY } from '../x402/offer-schemas.ts'
import { CONTEXT_BUDGET_LADDER_DISCOVERY, EVIDENCE_RETENTION_MATRIX_DISCOVERY } from '../x402/context-product-offer-schemas.ts'
import { buildCelestialProduct, SYNTHETIC_CALCULATION_INPUTS, type CelestialProductId } from '../x402/celestial-products.ts'
import { CELESTIAL_OFFERS } from '../x402/celestial-offers.ts'
import { DEMAND6_IDS, DEMAND6_INPUTS, DEMAND6_RESULTS, DEMAND6_SAMPLES, type Demand6Id } from '../x402/demand6/contracts.ts'
import { buildDemandProduct, type DemandDependencies } from '../x402/demand6/products.ts'
import { DEMAND6_SOURCE_REGISTRY } from '../x402/demand6/sources.ts'
import { runMpsAudit, MPS_TAGS, MPS_ACTIONS } from '../mps-audit-engine.ts'
import { createModelCostBudget, type ExecutionCost } from './cost-policy.ts'
import type { HandlerContract, JsonSchema } from './types.ts'

// No provider SDK, database client or secret lookup. A future model connector
// must be supplied explicitly together with an approved hard cost envelope.
export type Batch20Dependencies = { demand?: DemandDependencies; model?: { policy: ExecutionCost; maximumCallCostUsd: number;
  run(prompt: string, limits: { maximumCostUsd: number; maximumOutputTokens: number }): Promise<string> } }
type Port = { id: string; description: string; input: z.ZodType; resultSchema: JsonSchema; sample: Record<string, unknown>;
  run(request: unknown, deps: Batch20Dependencies, amount: string): Promise<unknown> }
const objectSchema = (properties: Record<string, JsonSchema>): JsonSchema => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) })
const projectSchema = (source: JsonSchema, keys: string[]) => objectSchema(Object.fromEntries(keys.map(k => [k, (source.properties as Record<string, JsonSchema>)[k]])))
const project = (source: object, keys: string[]) => Object.fromEntries(keys.map(k => [k, (source as Record<string, unknown>)[k]]))
const document = z.object({ id, title: z.string().min(1).max(160), text: z.string().min(1).max(8000) }).strict()
const context = { clientRequestId: z.string().min(8).max(120), task: z.string().min(8).max(1200), documents: z.array(document).min(1).max(8),
  provenance: z.enum(['full', 'compact', 'none']), scoring: z.enum(['bm25', 'keyword']), budgetMode: z.enum(['guaranteed', 'estimated']) }
const budget = z.number().int().min(64).max(16000)
const budgets = z.array(budget).length(5).refine(a => a.every((v, n) => n === 0 || v > a[n - 1]), 'ascending_unique_budgets_required')
const evidence = z.array(z.object({ evidenceId: id, sourceId: id, text: z.string().min(3).max(4000) }).strict()).min(1).max(32)
const base = { clientRequestId: 'synthetic-batch20', task: 'Preserve the release condition and evidence source.', documents: [{ id: 'doc1', title: 'Synthetic release', text: 'The synthetic release requires approval from the security owner.\n\nAn unrelated synthetic scheduling note.' }], provenance: 'compact', scoring: 'bm25', budgetMode: 'guaranteed' }
const requiredEvidence = [{ evidenceId: 'approval', sourceId: 'doc1', text: 'The synthetic release requires approval from the security owner.' }]
const port = (id: string, description: string, request: z.ZodType, resultSchema: JsonSchema, sample: Record<string, unknown>, run: Port['run']): Port => ({ id, description,
  input: input({ request }), resultSchema, sample: { dataClass: 'synthetic', nonpersonalMetadata: true, request: sample }, run })

const core: Port[] = [
  port('context-compression', 'Rank and pack supplied public/synthetic passages with keyword or BM25 scoring, source IDs and hashes. Token counts are model-neutral estimates, not billing or factual verification.', z.object({ ...context, tokenBudget: budget }).strict(), objectSchema({ contextPack: contextPackSchema() }), { ...base, tokenBudget: 256 }, async request => ({ contextPack: compileContextPack(parseContextPackRequest(request)) })),
  port('context-budget-ladder', 'Compare five ascending declared context budgets over the same supplied documents. No source lookup, model or answer-quality claim.', z.object({ ...context, tokenBudgets: budgets }).strict(), projectSchema(CONTEXT_BUDGET_LADDER_DISCOVERY.outputSchema, ['runs', 'comparison']), { ...base, tokenBudgets: [64, 96, 128, 192, 256] }, async request => project(buildContextBudgetLadder(request), ['runs', 'comparison'])),
  port('deep-context-evaluation', 'Measure exact supplied-span retention at one context budget. Retention is not factual accuracy or downstream answer quality.', z.object({ ...context, tokenBudget: budget, requiredEvidence: evidence }).strict(), projectSchema(DEEP_CONTEXT_EVALUATION_DISCOVERY.outputSchema, ['contextPack', 'evidence', 'metrics', 'warnings']), { ...base, tokenBudget: 256, requiredEvidence }, async request => project(evaluateContextPack(parseContextEvaluationRequest(request)), ['contextPack', 'evidence', 'metrics', 'warnings'])),
  port('evidence-retention-matrix', 'Measure exact supplied evidence retention across five ascending budgets. Return pinned context runs and an evidence frontier; no model or truth/completeness claim.', z.object({ ...context, tokenBudgets: budgets, requiredEvidence: evidence }).strict(), projectSchema(EVIDENCE_RETENTION_MATRIX_DISCOVERY.outputSchema, ['runs', 'evidenceFrontier']), { ...base, tokenBudgets: [64, 96, 128, 192, 256], requiredEvidence }, async request => project(buildEvidenceRetentionMatrix(request), ['runs', 'evidenceFrontier'])),
]
const mpsResult = z.object({ mps_version: z.literal('0.1'), input_hash: digest, claims: z.array(z.object({ excerpt: z.string().min(1).max(2000), tag: z.enum(MPS_TAGS), rationale: z.string().min(1).max(1000), action: z.enum(MPS_ACTIONS) }).strict()).min(1).max(32) }).strict()
core.push(port('mps-autonomous-audit', 'Model-assisted provenance-tag audit of one supplied public/synthetic passage. Adapter tested with a mocked model only; no live provider is configured. Execution requires separately approved cost envelope and spending. Tags are model assessments, not independently verified facts.', z.object({ passage: z.string().trim().min(1).max(6000) }).strict(), z.toJSONSchema(mpsResult), { passage: 'This synthetic result still needs independent source verification before publication.' }, async (request, deps, amount) => {
  if (!deps.model) throw Error('model_connector_not_configured_no_spending')
  const model = deps.model, cost = createModelCostBudget(amount, model.policy)
  cost.reserve(model.maximumCallCostUsd)
  const passage = (request as { passage: string }).passage
  return mpsResult.parse(await runMpsAudit(passage, async prompt => {
    const raw = await model.run(prompt, { maximumCostUsd: model.maximumCallCostUsd, maximumOutputTokens: 2048 })
    if (Buffer.byteLength(raw) > 24000) throw Error('model_response_over_limit')
    return raw
  }))
}))
for (const productId of Object.keys(SYNTHETIC_CALCULATION_INPUTS) as CelestialProductId[]) {
  const shape = { dataClass: z.enum(['public', 'synthetic']), instantUtc: utc }
  const request = productId === 'celestial-position-snapshot' ? z.object(shape).strict()
    : productId === 'celestial-chart-evidence' ? z.object({ ...shape, latitudeDegrees: z.number().finite().min(-89.9).max(89.9), longitudeDegrees: z.number().finite().min(-180).max(180) }).strict()
      : z.object({ ...shape, latitudeDegrees: z.number().finite().min(-89.9).max(89.9), longitudeDegrees: z.number().finite().min(-180).max(180), referenceInstantUtc: utc }).strict()
  const offer = CELESTIAL_OFFERS.find(e => e.id === productId)!
  core.push(port(productId, offer.description.replace('Bodies and receipt digests are not stored.', '') + ' Modular result content is retained 24 hours; minimal receipt metadata 90 days, replacing legacy stateless delivery.', request, offer.discovery.outputSchema,
    SYNTHETIC_CALCULATION_INPUTS[productId] as unknown as Record<string, unknown>, async r => buildCelestialProduct(productId, r)))
}
const targets = [{ url: 'https://www.mahastrategies.com/api/v1/compress', method: 'POST' as const, body: '{}' }]
for (const productId of DEMAND6_IDS) {
  // Explicit approved targets avoid the legacy dynamic offer-registry import.
  const description = productId === 'x402-quote-change-report' ? 'Compare dated stored unpaid quote observations; sparse samples are not continuous uptime, buyer calls or delivery.'
    : productId === 'live-x402-payment-preflight' ? 'Inspect an approved public endpoint without payment for Base, Arbitrum and Polygon native-USDC quote terms. A quote does not establish settlement or delivery.'
      : productId === 'live-citation-recheck' ? 'Revisit up to three publisher-approved public text sources and locate exact quotations with hashes. No factual certification, paywalls, PDFs or JavaScript execution.'
        : productId === 'source-bound-research-microbrief' ? 'Build an extractive source-linked microbrief from up to three rights-reviewed public sources. Exact short quotes and explicit unknowns only; no model or invented answer.'
          : productId === 'csv-import-preflight' ? 'Inspect supplied CSV quoting, declared scalar types, column counts and spreadsheet-formula prefixes without executing or repairing cells.'
            : 'Inspect supplied product SKU, decimal-price, currency and optional GTIN declarations. No registry lookup, ownership check or marketplace approval.'
  const inner = DEMAND6_INPUTS[productId]
  core.push(port(productId, description, inner, z.toJSONSchema(DEMAND6_RESULTS[productId]), { ...DEMAND6_SAMPLES[productId], dataClass: 'synthetic' }, async (request, deps) => {
    const output = await buildDemandProduct(productId as Demand6Id, request, { endpoints: targets, sources: DEMAND6_SOURCE_REGISTRY, ...deps.demand })
    return output.result
  }))
}
export const BATCH20_PORTS = core
if (BATCH20_PORTS.length !== 14 || new Set(BATCH20_PORTS.map(s => s.id)).size !== 14) throw Error('invalid_batch20_ports')
const byId = new Map(BATCH20_PORTS.map(s => [s.id, s]))
export const batch20PortSpec = (id: string) => byId.get(id)
export function batch20Port(id: string, amount: string, dependencies: Batch20Dependencies = {}): HandlerContract | undefined {
  const spec = byId.get(id); if (!spec) return
  const output = z.object({ version: z.literal('maha-reviewed-legacy-port/1'), productId: z.literal(id), inputHash: digest, chargedAmount: z.literal(amount),
    result: z.fromJSONSchema(spec.resultSchema), resultHash: digest, limitations: z.array(z.string().min(1).max(1000)).min(1).max(8) }).strict().superRefine((r, ctx) => {
    if (r.resultHash !== demandDigest(r.result)) ctx.addIssue({ code: 'custom', message: 'result_hash_mismatch' })
  })
  const bounded = spec.input.refine(i => Buffer.byteLength(JSON.stringify(i)) <= 32768, 'input_over_32KiB')
  return { input: bounded, output, execute: async supplied => {
    const parsed = bounded.parse(supplied) as { request: Record<string, unknown>; dataClass: string }
    if ('dataClass' in parsed.request && parsed.request.dataClass !== parsed.dataClass) throw Error('data_class_mismatch')
    if ('documents' in parsed.request) unique((parsed.request.documents as { id: string }[]).map(r => r.id))
    const result = await spec.run(parsed.request, dependencies, amount)
    const out = output.parse({ version: 'maha-reviewed-legacy-port/1', productId: id, inputHash: demandDigest(parsed), chargedAmount: amount, result, resultHash: demandDigest(result),
      limitations: ['Public or synthetic nonpersonal input only; caller labels are not sensitive-data detection.',
        'Token estimates, model tags, source observations and celestial conventions are not factual, legal, medical, financial or predictive certification.',
        'Result content is retained for 24 hours and minimal receipt metadata for 90 days. Original deadlines do not extend; hashes are not anonymization.',
        'The modular quote alone sets the charged amount. Legacy component price metadata is not an invoice or current offer.',
        'Live model spending and deployment require separate approval. Source-backed execution is tested with injected fixtures, not a claim of current source availability.'] })
    if (Buffer.byteLength(JSON.stringify(out)) > 65000) throw Error('result_over_65KB_no_payment')
    return out
  } }
}
export function batch20PortSchemas(id: string, amount: string) {
  const spec = byId.get(id)!
  const hashSchema = { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' }
  return { input: z.toJSONSchema(spec.input), output: objectSchema({ version: { const: 'maha-reviewed-legacy-port/1' }, productId: { const: id }, inputHash: hashSchema,
    chargedAmount: { const: amount }, result: spec.resultSchema, resultHash: hashSchema, limitations: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string', minLength: 1, maxLength: 1000 } } }) }
}
