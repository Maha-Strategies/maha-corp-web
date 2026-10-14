import { z } from 'zod'
import { X402_OFFERS } from '../x402/offers.ts'
import plan from '../../content/x402/roadmap-to-1000.json' with { type: 'json' }
import { WORKFLOW_IDS, WORKFLOW_PRODUCTS, workflowResultSchema, workflowInputJsonSchema, type WorkflowId } from '../x402/workflow/contracts.ts'
import { WORKFLOW_ROUTES } from '../x402/workflow/paths.ts'
import { proposedRecipes, proposedPriceBase } from './proposals.ts'
import { AUTHORIZED_BOOKS, BOOK_INPUT, BOOK_OUTPUT } from './book-catalogue.ts'
import { assertRegistry, DOMAINS, TARGET_COUNT, executionEnvelope, PUBLICATION_RECOVERY_SECONDS, type Domain, type Endpoint } from './types.ts'
import { LEGACY_PORTS, legacyPortSchemas } from './legacy-adapters.ts'
import { PUBLICATION_PRODUCTS, PUBLICATION_INPUTS, PUBLICATION_OUTPUTS } from './publishing/products.ts'
import { VALUE_BANDS, valueTierFor } from './value-staircase.ts'
import { executionCostFor, minimumModelPriceUnits } from './cost-policy.ts'
import { FOURTH_BATCH_AUDITS, batch4Audit } from './batch4-audits.ts'
import { auditSchemas } from './batch4-audit-core.ts'
import { BOOK_PACK_IDS, BOOK_PACK_INPUTS, BOOK_PACK_DESCRIPTIONS, bookPackHandler, type BookPackId } from './batch4-book-packs.ts'
import { FOURTH_BATCH_BOOK_PORTS } from './batch4-ports.ts'
import { FIFTH_BATCH_AUDITS, batch5Audit } from './batch5-audits.ts'
import { SIXTH_BATCH_AUDITS, batch6Audit } from './batch6-audits.ts'
import { SEVENTH_BATCH_AUDITS, batch7Audit } from './batch7-audits.ts'
import { EIGHTH_BATCH_AUDITS, batch8Audit } from './batch8-audits.ts'

// Premium and obsolete whole-book tests are NOT counted toward 1,000 microservices.
// Their production routes, prices and historical attribution are unchanged here.
export const PREMIUM_LEGACY_IDS = X402_OFFERS.filter(e => e.availability.payableInProduction && Number(e.amount) > 300000).map(e => e.id)
const reserved = new Set(X402_OFFERS.flatMap(e => [e.amount, ...(e.supersededAmounts ?? [])]))
function uniqueAmount(start: number): string {
  let n = Math.max(5000, start)
  while (reserved.has(String(n))) n++
  if (n > 300000) throw Error('proposed_price_window_exhausted')
  reserved.add(String(n)); return String(n)
}
function domainFor(id: string): Domain {
  if (/celestial|astrology|astronomy|planet|orbit-position|ephemeris/.test(id)) return 'celestial'
  if (/book-|reading|bibliography|citation/.test(id)) return 'library'
  if (/context|compress|retention|passage/.test(id)) return 'context'
  if (/research|brief|opportunity|campaign|policy|funding/.test(id)) return 'intel'
  if (/quantum|biology|chemistry|materials|robotics|neural|physical|compute|solver/.test(id)) return 'compute'
  return 'verify'
}
const draft = { type: 'object', additionalProperties: false, properties: { dataClass: { enum: ['public', 'synthetic'] }, records: { type: 'array', maxItems: 500, items: { type: 'object' } } }, required: ['dataClass', 'records'] }
const wrapped = (data: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: ['success', 'data', 'proof'], properties: {
  success: { const: true }, data, proof: { type: 'object', additionalProperties: false, required: ['settlement_id'], properties: { settlement_id: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' } } } } })
const entries: Endpoint[] = X402_OFFERS.filter(e => e.availability.payableInProduction && Number(e.amount) <= 300000).map(e => {
  const domain = domainFor(e.id), category = domain === 'library' ? 'books' : 'legacy', amount = Number(e.amount) < 5000 ? uniqueAmount(5000) : e.amount
  return { id: e.id, name: e.serviceName, description: e.description, path: `/api/v1/${domain}/${category}/${e.id}`, method: e.method,
    amount, price_usdc: Number(amount) / 1e6, domain, category, tags: [...new Set([domain, ...e.tags])],
    schema: { input: e.discovery.inputSchema, output: wrapped(e.discovery.outputSchema) }, estimated_compute_cost: .001,
    cost_basis: 'unmeasured-planning-assumption', status: 'legacy-unported', schema_status: 'legacy',
    productionApproved: false, sourceReview: 'pending', legacy: { path: e.path, amount: e.amount, supersededAmounts: e.supersededAmounts ?? [] } }
})
const researchRoutes = {
  'materials-curve-unit-reconciliation': ['verify', 'materials', 'curve-units'],
  'materials-test-condition-clustering': ['compute', 'materials', 'condition-clusters'],
  'materials-batch-lot-traceability': ['verify', 'materials', 'lot-traceability'],
  'materials-property-source-snapshot': ['intel', 'materials', 'property-snapshot'],
  'materials-measurement-revision-diff': ['verify', 'materials', 'revision-diff'],
  'biology-assay-endpoint-crosswalk': ['verify', 'biology', 'assay-crosswalk'],
  'biology-sample-label-reconciliation': ['verify', 'biology', 'sample-labels'],
  'biology-assay-unit-conversion-audit': ['verify', 'biology', 'assay-units'],
  'biology-correction-propagation-report': ['intel', 'biology', 'correction-propagation'],
  'quantum-calibration-age-report': ['verify', 'quantum', 'calibration-age'],
  'quantum-shot-dataset-lineage': ['verify', 'quantum', 'shot-lineage'],
  'quantum-hardware-configuration-snapshot': ['intel', 'quantum', 'hardware-snapshot'],
  'robotics-message-clock-audit': ['verify', 'robotics', 'message-clocks'],
  'robotics-frame-tree-consistency': ['verify', 'robotics', 'frame-tree'],
} as const
for (const p of plan.firstBatch) {
  const implemented = WORKFLOW_IDS.includes(p.id as WorkflowId), id = p.id as WorkflowId
  const route = implemented ? WORKFLOW_ROUTES[id] : researchRoutes[p.id as keyof typeof researchRoutes]
  if (!route) throw Error('research_route_definition_missing')
  const [domain, category] = route
  const amount = p.amount
  if (reserved.has(amount)) throw Error('first_batch_price_reserved')
  reserved.add(amount)
  entries.push({ id: p.id, name: implemented ? WORKFLOW_PRODUCTS[id].title : p.title, description: implemented ? WORKFLOW_PRODUCTS[id].description : `${p.task}. ${p.boundary}.`, path: '/api/v1/' + route.join('/'),
    method: 'POST', amount, price_usdc: Number(amount) / 1e6, domain, category, tags: [domain, category, p.id, 'evidence', 'bounded'],
    schema: implemented ? { input: workflowInputJsonSchema(id), output: z.toJSONSchema(executionEnvelope(workflowResultSchema(id))) } : { input: draft, output: wrapped({ type: 'object' }) },
    estimated_compute_cost: p.id.startsWith('research-') ? .003 : .0005, cost_basis: 'unmeasured-planning-assumption',
    status: implemented ? 'local-implemented' : 'proposal', schema_status: implemented ? 'validated-local' : 'draft',
    handlerId: implemented ? p.id : undefined, productionApproved: false, sourceReview: p.id.startsWith('research-') ? 'pending' : 'not-applicable' })
}
const bookInput = BOOK_INPUT
for (const [book, title] of AUTHORIZED_BOOKS) {
  const id = 'book-section-' + book, old = entries.find(e => e.id === id)
  if (old) {
    old.path = `/api/v1/library/${book}/section`; old.category = book; old.handlerId = id
    old.description = `Deliver one edition-pinned plain-text reading unit from ${title}. Long EPUB spine units are split into numbered parts. No images, layout, full-book bundle, redistribution or training rights. Source-selection release review pending.`
    old.status = 'local-implemented'; old.schema_status = 'validated-local'; old.schema = { input: z.toJSONSchema(BOOK_INPUT), output: z.toJSONSchema(executionEnvelope(BOOK_OUTPUT)) }; continue
  }
  const amount = uniqueAmount(31000 + entries.length)
  entries.push({ id, name: `${title} — pinned reading unit`, description: `Deliver one edition-pinned plain-text reading unit of ${title}, with content integrity hashes and personal/internal reading rights. Long EPUB spine units split into numbered parts. No images, layout, full-book bundle, redistribution, model-training rights or factual certification. Source-selection release review pending.`,
    path: `/api/v1/library/${book}/section`, method: 'POST', domain: 'library', category: book, amount, price_usdc: Number(amount) / 1e6,
    tags: ['library', 'books', 'licensed-sections', book], schema: { input: z.toJSONSchema(bookInput), output: z.toJSONSchema(executionEnvelope(BOOK_OUTPUT)) },
    estimated_compute_cost: .0005, cost_basis: 'unmeasured-planning-assumption', status: 'local-implemented', schema_status: 'validated-local', handlerId: id, productionApproved: false, sourceReview: 'pending' })
}
for (const [id, domain, category, action] of LEGACY_PORTS) {
  const old = entries.find(e => e.id === id)
  if (!old) throw Error('port_missing_legacy_definition:' + id)
  old.domain = domain; old.category = category; old.path = `/api/v1/${domain}/${category}/${action}`
  old.tags = [...new Set([domain, category, action, ...old.tags.filter(tag => !DOMAINS.includes(tag as Domain))])]
  old.handlerId = id; old.status = 'local-implemented'; old.schema_status = 'validated-local'
  old.sourceReview = ['divine-name-disambiguation', 'edition-verse-resolution', 'reception-lineage-retrieval'].includes(id) ? 'pending' : 'not-applicable'
  const schemas = legacyPortSchemas(id, old.amount); old.schema = { input: schemas.input, output: wrapped(schemas.output) }
  old.description += ' New modular adapter: retained result recovery for 24 hours, minimal receipt metadata for 90 days. Existing live route unchanged.'
}
for (const p of PUBLICATION_PRODUCTS) {
  const amount = uniqueAmount(p.price)
  entries.push({ id: p.id, name: p.name, description: p.description, path: `/api/v1/${p.domain}/${p.category}/${p.action}`,
    method: 'POST', domain: p.domain, category: p.category, amount, price_usdc: Number(amount) / 1e6,
    tags: [p.domain, 'publishing', 'publications', p.action], schema: { input: z.toJSONSchema(PUBLICATION_INPUTS[p.id]), output: z.toJSONSchema(executionEnvelope(PUBLICATION_OUTPUTS[p.id])) },
    estimated_compute_cost: .001, cost_basis: 'unmeasured-planning-assumption', status: 'local-implemented', schema_status: 'validated-local',
    handlerId: p.id, productionApproved: false, sourceReview: 'pending', recoverySeconds: PUBLICATION_RECOVERY_SECONDS })
}
for (const p of proposedRecipes()) {
  if (entries.length >= TARGET_COUNT) break
  if (entries.some(e => e.id === p.id)) continue
  const amount = uniqueAmount(proposedPriceBase(p.id))
  entries.push({ ...p, schema: { ...p.schema, output: wrapped(p.schema.output) }, amount, price_usdc: Number(amount) / 1e6 })
}
if (entries.length !== TARGET_COUNT) throw Error('incomplete_1000_product_definition_catalogue')
for (const spec of FOURTH_BATCH_AUDITS) {
  const e = entries.find(e => e.id === spec.id)
  if (!e || e.status !== 'proposal') throw Error('batch4_draft_missing_or_recounted:' + spec.id)
  e.status = 'local-implemented'; e.schema_status = 'validated-local'; e.handlerId = e.id; e.sourceReview = 'not-applicable'
  e.description = spec.description + ' Offline typed metadata only. Retained-result recovery: 24 hours; minimal receipt metadata: 90 days.'
  e.tags = [...new Set([...e.tags.filter(t => t !== 'planned-recipe'), 'typed-metadata', 'offline-audit'])]
  const schemas = auditSchemas(spec, e.amount); e.schema = { input: schemas.input, output: wrapped(schemas.output) }
}
for (const [id, domain, category, action] of FOURTH_BATCH_BOOK_PORTS) {
  const e = entries.find(e => e.id === id)
  if (!e || e.status !== 'legacy-unported') throw Error('batch4_book_pack_missing_or_recounted')
  e.domain = domain; e.category = category; e.path = `/api/v1/${domain}/${category}/${action}`
  e.status = 'local-implemented'; e.schema_status = 'validated-local'; e.handlerId = id; e.sourceReview = 'pending'
  e.description = BOOK_PACK_DESCRIPTIONS[id]; e.tags = ['library', 'books', 'edition-pinned', 'licensed-reading-pack', category]
  e.schema = { input: z.toJSONSchema(BOOK_PACK_INPUTS[id]), output: z.toJSONSchema(executionEnvelope(bookPackHandler(id, e.amount).output)) }
}
for (const spec of FIFTH_BATCH_AUDITS) {
  const e = entries.find(e => e.id === spec.id)
  if (!e || e.status !== 'proposal') throw Error('batch5_draft_missing_or_recounted:' + spec.id)
  e.status = 'local-implemented'; e.schema_status = 'validated-local'; e.handlerId = e.id; e.sourceReview = 'not-applicable'
  e.description = spec.description + ' Offline typed nonpersonal metadata only. Result retention: 24 hours; minimal receipt metadata: 90 days.'
  e.tags = [...new Set([...e.tags.filter(t => t !== 'planned-recipe'), 'typed-metadata', 'offline-audit', 'source-frame-check'])]
  const schemas = auditSchemas(spec, e.amount); e.schema = { input: schemas.input, output: wrapped(schemas.output) }
}
// Promote the sixth offline cohort without changing any live offer.
for (const spec of SIXTH_BATCH_AUDITS) {
  const e = entries.find(e => e.id === spec.id)
  if (!e || e.status !== 'proposal') throw Error('batch6_draft_missing_or_recounted:' + spec.id)
  e.status = 'local-implemented'; e.schema_status = 'validated-local'; e.handlerId = e.id; e.sourceReview = 'not-applicable'
  e.description = spec.description + ' Offline typed nonpersonal metadata only. Result retention: 24 hours; minimal receipt metadata: 90 days.'
  e.tags = [...new Set([...e.tags.filter(t => t !== 'planned-recipe'), 'typed-metadata', 'offline-audit', 'source-frame-check'])]
  const schemas = auditSchemas(spec, e.amount); e.schema = { input: schemas.input, output: wrapped(schemas.output) }
}
// Promote the seventh Supabase-independent offline cohort. Existing live offers stay unchanged.
for (const spec of SEVENTH_BATCH_AUDITS) {
  const e = entries.find(e => e.id === spec.id)
  if (!e || e.status !== 'proposal') throw Error('batch7_draft_missing_or_recounted:' + spec.id)
  e.status = 'local-implemented'; e.schema_status = 'validated-local'; e.handlerId = e.id; e.sourceReview = 'not-applicable'
  e.description = spec.description + ' Offline typed nonpersonal metadata only. Result retention: 24 hours; minimal receipt metadata: 90 days.'
  e.tags = [...new Set([...e.tags.filter(t => t !== 'planned-recipe'), 'typed-metadata', 'offline-audit', 'source-frame-check'])]
  const schemas = auditSchemas(spec, e.amount); e.schema = { input: schemas.input, output: wrapped(schemas.output) }
}
// Promote the eighth offline cohort; no hosted database or live offer changes.
for (const spec of EIGHTH_BATCH_AUDITS) {
  const e = entries.find(e => e.id === spec.id)
  if (!e || e.status !== 'proposal') throw Error('batch8_draft_missing_or_recounted:' + spec.id)
  e.status = 'local-implemented'; e.schema_status = 'validated-local'; e.handlerId = e.id; e.sourceReview = 'not-applicable'
  e.description = spec.description + ' Offline typed nonpersonal metadata only. Result retention: 24 hours; minimal receipt metadata: 90 days.'
  e.tags = [...new Set([...e.tags.filter(t => t !== 'planned-recipe'), 'typed-metadata', 'offline-audit', 'source-frame-check'])]
  const schemas = auditSchemas(spec, e.amount); e.schema = { input: schemas.input, output: wrapped(schemas.output) }
}
// Reprice the LOCAL modular namespace only. The live offer registry and
// legacy.amount are never mutated. Rebuild price-bound adapter schemas too.
const allocated = new Set<string>(X402_OFFERS.flatMap(e => [e.amount, ...(e.supersededAmounts ?? [])]))
for (const e of entries) {
  e.pricing = valueTierFor(e); e.execution_cost = executionCostFor(e)
  const band = VALUE_BANDS[e.pricing.tier], required = e.execution_cost.mode === 'external-model' ? minimumModelPriceUnits(e.execution_cost.expected_usdc) : band.minimumUnits
  let units = Math.max(band.minimumUnits, Math.min(band.maximumUnits, Number(e.amount)), required)
  while (allocated.has(String(units)) && units <= band.maximumUnits) units++
  if (units > band.maximumUnits) {
    units = Math.max(band.minimumUnits, required)
    while (allocated.has(String(units)) && units <= band.maximumUnits) units++
  }
  if (units > band.maximumUnits) throw Error('value_band_or_model_floor_exhausted:' + e.id)
  e.amount = String(units); e.price_usdc = units / 1e6; allocated.add(e.amount)
  if (LEGACY_PORTS.some(p => p[0] === e.id)) e.schema.output = wrapped(legacyPortSchemas(e.id as typeof LEGACY_PORTS[number][0], e.amount).output)
  const audit = batch4Audit(e.id)
  if (audit) e.schema.output = wrapped(auditSchemas(audit, e.amount).output)
  const fifth = batch5Audit(e.id)
  if (fifth) e.schema.output = wrapped(auditSchemas(fifth, e.amount).output)
  const sixth = batch6Audit(e.id)
  if (sixth) e.schema.output = wrapped(auditSchemas(sixth, e.amount).output)
  const seventh = batch7Audit(e.id)
  if (seventh) e.schema.output = wrapped(auditSchemas(seventh, e.amount).output)
  const eighth = batch8Audit(e.id)
  if (eighth) e.schema.output = wrapped(auditSchemas(eighth, e.amount).output)
  if (BOOK_PACK_IDS.some(id => id === e.id)) e.schema.output = z.toJSONSchema(executionEnvelope(bookPackHandler(e.id as BookPackId, e.amount).output))
}
assertRegistry(entries)
// Deep freeze prevents a caller turning a planning entry into a paid route.
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.freeze(value); for (const v of Object.values(value)) freeze(v) }; return value }
export const ENDPOINTS: readonly Endpoint[] = freeze(entries)
const byId = new Map(ENDPOINTS.map(e => [e.id, e])), byRoute = new Map(ENDPOINTS.map(e => [e.method + ':' + e.path, e]))
export const endpointById = (id: string) => byId.get(id)
export const endpointByRoute = (method: string, path: string) => byRoute.get(method + ':' + path)
export const REGISTRY_SUMMARY = freeze({ defined: ENDPOINTS.length, domains: DOMAINS.map(domain => ({ domain, count: ENDPOINTS.filter(e => e.domain === domain).length })),
  averageProposedPrice: ENDPOINTS.reduce((n, e) => n + Number(e.amount), 0) / ENDPOINTS.length / 1e6,
  localImplemented: ENDPOINTS.filter(e => e.status === 'local-implemented').length, newlyReleased: ENDPOINTS.filter(e => e.productionApproved).length,
  legacyRoutesUnchanged: true, costsMeasured: false, marginsEstablished: false, usefulnessOfAllProposalsValidated: false,
  valueStaircase: { policy: 'maha-value-staircase/1', livePricesChanged: false, tiers: Object.entries(VALUE_BANDS).map(([tier, band]) => {
    const members = ENDPOINTS.filter(e => e.pricing?.tier === Number(tier))
    return { tier: Number(tier), ...band, count: members.length, averageProposedPrice: members.reduce((n, e) => n + e.price_usdc, 0) / members.length }
  }) }, modelPriceMultiplier: 3, revenueUpliftEstablished: false, zeroCallerFrictionEstablished: false })
