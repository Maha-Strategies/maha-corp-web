/** Public declarations only. Never import corpus files or operational secrets here. */
import { NEXT_PRODUCTS, nextInputSchemas } from './micro-next-contracts.ts'
export const MICRO_VERSION = 'maha-microproducts/0.1' as const
export const MICRO_MAX_REQUEST_BYTES = 32768
export const MICRO_MAX_RESPONSE_BYTES = 65536
export const MICRO_PRODUCTS = {
  'citation-binding-check': { amount: '16000', title: 'Citation Binding Check', description: 'Compare up to 20 declared source identities, revisions and locators. Returns exact mismatches and an integrity receipt. Does not fetch sources, establish passage existence or verify claim support.' },
  'revision-lineage-check': { amount: '6000', title: 'Revision Lineage Check', description: 'Check one initial or superseding revision transition against a declared predecessor. Returns lineage inconsistencies and an integrity receipt. Does not establish authenticity, semantic equivalence or inherited review approval.' },
  'audit-export-normalizer': { amount: '18000', title: 'Audit Export Normalizer', description: 'Normalize up to 100 metadata events into deterministic order, rejecting duplicate identifiers and malformed times or digests. Does not prove event occurrence, provenance or completeness against an external system.' },
  'dimensional-consistency-check': { amount: '5000', title: 'Dimensional Consistency Check', description: 'Multiply or divide two seven-component SI dimension vectors and compare with the expected output dimension. No unit conversion, formula validation, scale-factor inference or physical-model certification.' },
  'exact-interpolation-receipt': { amount: '5000', title: 'Exact Interpolation Receipt', description: 'Interpolate between two integer-coordinate points with exact rational arithmetic and an integrity receipt. Refuses extrapolation and repeated nodes. Does not estimate measurement error or validate the interpolation model.' },
  'sampled-series-integration': { amount: '10000', title: 'Sampled-Series Integration', description: 'Apply the composite trapezoidal rule to 2-128 equally spaced integer samples. Returns an exact rational arithmetic result, declared units and an integrity receipt. No quadrature-error estimate or claim of an exact underlying integral.' },
  'evidence-conflict-comparator': { amount: '10000', title: 'Evidence Conflict Comparator', description: 'Compare 2-20 caller-labelled observations of one claim, population and outcome. Returns opposing directions and explicitly excluded observations. No literature search, source inspection, consensus judgment or factual verification.' },
  'release-bound-evidence-packet': { amount: '10000', title: 'Release-Bound Evidence Packet', description: 'Deliver public source metadata and exact release bindings for one supported federation article at caller-pinned revisions. Uses the deployed repository snapshot, not a live registry probe. No private review material, full source text or expert certification.' },
  'tiruvaymoli-context-packet': { amount: '5000', title: 'Tiruvaymoli Passage Context Packet', description: 'Deliver one supported atlas unit as structured edition metadata, poetic context, bounded answers and links at a pinned registry digest. Public pages remain free. No translation full text, redistribution license, historical or theological certification.' },
  'astrology-experiment-plan-check': { amount: '10000', title: 'Astrology Experiment-Plan Check', description: 'Check one structured public or synthetic low-stakes experiment plan for timing, comparator, outcome and analysis declarations. Returns deficiencies and an integrity receipt. No registration, trusted timestamp, prediction, power analysis or scientific validation.' },
  ...NEXT_PRODUCTS,
} as const
export type MicroProductId = keyof typeof MICRO_PRODUCTS
export const MICRO_IDS = Object.keys(MICRO_PRODUCTS) as MicroProductId[]
export const microPath = (id: MicroProductId) => `/api/v1/micro/${id}`
export const isMicroProduct = (value: string): value is MicroProductId => Object.hasOwn(MICRO_PRODUCTS, value)

import { objectSchema, arraySchema, textSchema, enumSchema, ID_SCHEMA, HASH_SCHEMA, INTEGER_SCHEMA, UTC_SCHEMA, type MicroSchema } from './micro-schema.ts'
export { objectSchema, arraySchema, textSchema, enumSchema, ID_SCHEMA, HASH_SCHEMA, INTEGER_SCHEMA, UTC_SCHEMA, schemaAccepts, type MicroSchema } from './micro-schema.ts'
const nullHash: MicroSchema = { oneOf: [HASH_SCHEMA, { type: 'null' }] }
const locator = objectSchema({ sourceId: ID_SCHEMA, sourceRevision: HASH_SCHEMA, kind: enumSchema('page', 'section', 'figure', 'table', 'equation'), value: textSchema() })
const node = objectSchema({ objectId: ID_SCHEMA, revisionDigest: HASH_SCHEMA, predecessorDigest: nullHash, relation: enumSchema('initial', 'supersedes') })
const dimensions = arraySchema({ type: 'integer', minimum: -24, maximum: 24 }, 7, 7)
const event = objectSchema({ eventId: ID_SCHEMA, eventType: ID_SCHEMA, subjectDigest: HASH_SCHEMA, occurredAt: UTC_SCHEMA })
const observation = objectSchema({ observationId: ID_SCHEMA, normalizedClaimId: ID_SCHEMA, direction: enumSchema('supports', 'opposes', 'mixed'), population: ID_SCHEMA, outcome: ID_SCHEMA, sourceId: ID_SCHEMA, exactLocator: textSchema() })
const envelope = (properties: Record<string, MicroSchema>) => objectSchema({ dataClass: enumSchema('public', 'synthetic'), ...properties })

export const MICRO_INPUT_SCHEMAS: Record<MicroProductId, MicroSchema> = {
  ...nextInputSchemas(),
  'citation-binding-check': envelope({ bindings: arraySchema(objectSchema({ expected: locator, observed: locator }), 1, 20) }),
  'revision-lineage-check': envelope({ previous: { oneOf: [node, { type: 'null' }] }, next: node }),
  'audit-export-normalizer': envelope({ events: arraySchema(event, 1, 100) }),
  'dimensional-consistency-check': envelope({ left: dimensions, right: dimensions, operation: enumSchema('multiply', 'divide'), expected: dimensions }),
  'exact-interpolation-receipt': envelope({ x0: INTEGER_SCHEMA, y0: INTEGER_SCHEMA, x1: INTEGER_SCHEMA, y1: INTEGER_SCHEMA, x: INTEGER_SCHEMA, xUnit: textSchema(32), yUnit: textSchema(32) }),
  'sampled-series-integration': envelope({ spacing: INTEGER_SCHEMA, ordinates: arraySchema(INTEGER_SCHEMA, 2, 128), xUnit: textSchema(32), yUnit: textSchema(32) }),
  'evidence-conflict-comparator': envelope({ claimId: ID_SCHEMA, population: ID_SCHEMA, outcome: ID_SCHEMA, observations: arraySchema(observation, 2, 20) }),
  'release-bound-evidence-packet': envelope({ canonicalUrl: { ...textSchema(512), pattern: '^https://[^?#]+$' }, expectedContentDigest: HASH_SCHEMA, expectedReleaseDigest: HASH_SCHEMA }),
  'tiruvaymoli-context-packet': envelope({ slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxLength: 160 }, expectedRegistryDigest: HASH_SCHEMA }),
  // Structured declarations rather than arbitrary natal records or a private registry draft.
  'astrology-experiment-plan-check': envelope({
    assessedAtUtc: UTC_SCHEMA, startUtc: UTC_SCHEMA, endUtc: UTC_SCHEMA,
    activity: enumSchema('synthetic-task', 'public-puzzle'),
    predictorId: ID_SCHEMA, conventionVersion: ID_SCHEMA, outcomeId: ID_SCHEMA,
    direction: enumSchema('higher', 'lower'), comparator: enumSchema('randomized-control', 'shuffled-timing', 'none'),
    sampleSize: { type: 'integer', minimum: 0, maximum: 1000000 },
    analysis: objectSchema({ metric: enumSchema('mean-difference', 'success-rate-difference'), missingData: enumSchema('report-and-exclude', 'count-as-failure', 'unspecified'), stoppingRule: enumSchema('fixed-sample', 'fixed-end-time', 'unspecified'), multipleTesting: enumSchema('single-primary-outcome', 'bonferroni', 'unspecified'), planDigest: HASH_SCHEMA }),
  }),
}


export const MICRO_BOUNDARIES = [
  'Public or synthetic inputs only. Caller labels are declarations, not independently verified facts.',
  'No source acquisition, model inference, expert review, regulatory certification or prediction is performed.',
  'Receipt hashes bind the supplied input, version and result. They are not signatures, trusted timestamps, anonymization or proof of truth.',
  'Request and result bodies and their digests are not persisted by this service. Payment metadata remains in the existing settlement ledger.',
  'Stateless delivery: save the response locally. A lost response is not recoverable from a stored job. Do not sign a new payment after an ambiguous outcome without checking settlement.',
  'A paid negative finding is a completed check, not approval. Malformed or unsupported inputs are refused before settlement.',
] as const
