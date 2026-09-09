import { arraySchema as a, objectSchema as o, textSchema as s, enumSchema as e, HASH_SCHEMA as h, ID_SCHEMA as id, type MicroSchema } from './micro-schema.ts'

export const NEXT_PRODUCTS = {
  'unit-uncertainty-conversion': { amount: '5000', title: 'Unit and Uncertainty Conversion', description: 'Convert one decimal measurement and standard uncertainty between explicitly supported length, mass, time or temperature units. Exact rational scale/offset arithmetic; no unit guessing, physical validation or expanded uncertainty.' },
  'exact-linear-system': { amount: '5000', title: 'Exact Linear-System Solver', description: 'Solve a 1-8 variable rational linear system with rank, pivots, particular solution and null-space basis. Distinguishes unique, inconsistent and underdetermined systems. Not a floating-point conditioning or physical-model assessment.' },
  'bracketed-polynomial-root': { amount: '5000', title: 'Bracketed Polynomial Root Receipt', description: 'Bisect a degree 1-8 rational polynomial over a sign-changing rational bracket, with a maximum of 64 iterations. Returns a certified bracket or exact rational root. No arbitrary code, all-roots or uniqueness claim.' },
  'covariance-uncertainty': { amount: '10000', title: 'Covariance-Aware Uncertainty Propagation', description: 'Evaluate c-transpose C c for 1-8 declared sensitivities and an exactly symmetric positive-semidefinite covariance matrix. Returns exact variance and a rational square-root enclosure. First-order model only; no empirical covariance validation.' },
  'divine-name-disambiguation': { amount: '5000', title: 'Tamil Divine-Name Disambiguation', description: 'Resolve an exact supported Tamil divine-name spelling into source-scoped relationship records at a pinned registry. Ambiguity and name coincidence remain explicit. No fuzzy universal synonymy, full source text or theological certification.' },
  'edition-verse-resolution': { amount: '5000', title: 'Edition-Specific Verse Reference', description: 'Resolve one printed pasuram number to its complete unit in the pinned Project Madurai/Hart atlas. Edition-specific, with exact unit locator. No conversion between numbering systems, translation reproduction or occurrence claims about a single verse.' },
  'reception-lineage-retrieval': { amount: '10000', title: 'Attributed Tamil Reception Lineage', description: 'Retrieve one supported reception comparison with separate source frames and exact locators from the pinned public atlas. No inferred ancestry, uninterrupted transmission, universal identity or source full text.' },
  'policy-version-comparison': { amount: '10000', title: 'Structured Policy-Version Comparison', description: 'Compare up to 40 caller-supplied policy clauses per version by stable ID, text and scope. Reports added, removed and changed clauses. Checks declared chronology, not legal effect, applicability or compliance.' },
  'control-evidence-gaps': { amount: '10000', title: 'Declared Control-Evidence Gap Check', description: 'Compare up to 40 declared policy/control requirements with revision- and scope-bound evidence descriptors. Reports missing, stale and rejected evidence. Does not inspect evidence content, evaluate control effectiveness or certify compliance.' },
  'mcp-contract-compatibility': { amount: '5000', title: 'Bounded MCP Tool Contract Compatibility', description: 'Compare required tool names and exact pinned input/output schema digests against a declared MCP server snapshot. Checks protocol version and transport. Not a network probe, general schema-subtyping proof or official conformance certificate.' },
  'tool-permission-diff': { amount: '5000', title: 'Tool Permission Change Analysis', description: 'Compare two explicit allow-only permission sets by tool, action and exact resource identifier. Reports additions, removals and wildcard additions. Does not resolve IAM inheritance, wildcard containment or authorize execution.' },
  'publication-bundle-consistency': { amount: '10000', title: 'Publication Bundle Consistency', description: 'Compare 2-8 declared article, registry and API views against one canonical URL, content digest, release digest and source-set digest. Reports stale, withdrawn and substituted views. No live fetch, release promotion or semantic content verification.' },
} as const
export type NextProductId = keyof typeof NEXT_PRODUCTS
export const NEXT_IDS = Object.keys(NEXT_PRODUCTS) as NextProductId[]
export const isNextProduct = (v: string): v is NextProductId => Object.hasOwn(NEXT_PRODUCTS, v)

export function nextInputSchemas(): Record<NextProductId, MicroSchema> {
  const d: MicroSchema = { type: 'string', maxLength: 21, pattern: '^-?(0|[1-9][0-9]{0,11})(\\.[0-9]{1,6})?$' }
  const n = (min: number, max: number): MicroSchema => ({ type: 'integer', minimum: min, maximum: max })
  const env = (fields: Record<string, MicroSchema>) => o({ dataClass: e('public', 'synthetic'), ...fields })
  const units = e('m', 'cm', 'mm', 'km', 'kg', 'g', 's', 'min', 'h', 'K', 'degC', 'degF')
  const clause = o({ clauseId: id, text: s(600), scope: id })
  const permission = o({ tool: id, action: id, resource: s(160) })
  const tool = o({ name: id, inputSchemaDigest: h, outputSchemaDigest: h })
  const version = o({ protocolVersion: e('2025-06-18'), transport: e('stdio', 'streamable-http'), tools: a(tool, 0, 30) })
  return {
    'unit-uncertainty-conversion': env({ value: d, standardUncertainty: d, from: units, to: units, quantity: e('absolute', 'difference') }),
    'exact-linear-system': env({ matrix: a(a(d, 1, 8), 1, 8), rhs: a(d, 1, 8) }),
    'bracketed-polynomial-root': env({ coefficientsAscending: a(d, 2, 9), lower: d, upper: d, tolerance: d, maxIterations: n(1, 64) }),
    'covariance-uncertainty': env({ sensitivities: a(d, 1, 8), covariance: a(a(d, 1, 8), 1, 8), outputUnit: s(32) }),
    'divine-name-disambiguation': env({ name: s(80), expectedRegistryDigest: h }),
    'edition-verse-resolution': env({ editionId: e('project-madurai-divya-prabandham-part-4'), pasuram: n(1, 10000), expectedRegistryDigest: h }),
    'reception-lineage-retrieval': env({ slug: s(160), expectedRegistryDigest: h }),
    'policy-version-comparison': env({ policyId: id, beforeVersion: id, afterVersion: id, beforeSequence: n(0, 1000000), afterSequence: n(0, 1000000), before: a(clause, 0, 40), after: a(clause, 0, 40) }),
    'control-evidence-gaps': env({ policyDigest: h, requirements: a(o({ controlId: id, requiredContentDigest: h, scope: id }), 1, 40), evidence: a(o({ evidenceId: id, controlId: id, policyDigest: h, contentDigest: h, scope: id, status: e('accepted', 'rejected') }), 0, 80) }),
    'mcp-contract-compatibility': env({ required: version, offered: version }),
    'tool-permission-diff': env({ before: a(permission, 0, 50), after: a(permission, 0, 50) }),
    'publication-bundle-consistency': env({ canonicalUrl: { ...s(512), pattern: '^https://[^?#]+$' }, contentDigest: h, releaseDigest: h, sourceSetDigest: h, views: a(o({ viewId: id, kind: e('article', 'registry', 'api'), canonicalUrl: s(512), contentDigest: h, releaseDigest: h, sourceSetDigest: h, status: e('active', 'withdrawn', 'unreleased') }), 2, 8) }),
  }
}

export function nextResultSchemas(): Record<NextProductId, MicroSchema> {
  const no: MicroSchema = { type: 'boolean', enum: [false] }, yesno: MicroSchema = { type: 'boolean' }
  const fraction = o({ numerator: { type: 'string', pattern: '^-?[0-9]+$', maxLength: 1250 }, denominator: { type: 'string', pattern: '^[1-9][0-9]*$', maxLength: 1250 } })
  const texts = a(s(4000), 0, 100), nums = a({ type: 'integer', minimum: 0, maximum: 8 }, 0, 8)
  const bounded = o({ lower: fraction, upper: fraction })
  const evidence = o({ sourceId: s(), url: s(4096), locator: s(4096), frame: s(), rightsBasis: s(4000), boundary: s(4000) })
  const permission = o({ tool: id, action: id, resource: s(160) })
  return {
    'unit-uncertainty-conversion': o({ value: fraction, standardUncertainty: fraction, scale: fraction, offset: fraction, from: s(), to: s(), quantity: s(), physicalValidityVerified: no }),
    'exact-linear-system': o({ state: e('unique', 'underdetermined', 'inconsistent'), rank: { type: 'integer', minimum: 0, maximum: 8 }, pivotColumns: nums, freeColumns: nums, particular: a(fraction, 0, 8), nullspace: a(a(fraction, 1, 8), 0, 8), exactResidualVerified: yesno, conditioningAssessed: no }),
    'bracketed-polynomial-root': o({ state: e('exact-root', 'tolerance-reached', 'iteration-limit'), bracket: bounded, iterations: { type: 'integer', minimum: 0, maximum: 64 }, uniquenessEstablished: no, method: e('rational-polynomial-bisection') }),
    'covariance-uncertainty': o({ variance: fraction, standardUncertainty: bounded, covariancePositiveSemidefinite: { type: 'boolean', enum: [true] }, outputUnit: s(32), model: e('first-order-sensitivity-propagation'), inputEstimatesVerified: no }),
    'divine-name-disambiguation': o({ state: e('matched', 'ambiguous', 'not-in-supported-index'), registryDigest: h, candidates: a(o({ entity: s(), relationship: s(), boundary: s(4000), evidence: a(evidence, 0, 8) }), 0, 10), universalIdentityEstablished: no }),
    'edition-verse-resolution': o({ state: e('resolved', 'not-in-inspected-atlas'), registryDigest: h, editionId: s(), matches: a(o({ slug: s(), range: s(), canonicalUrl: s(512), locator: s(512) }), 0, 1), verseContentReturned: no }),
    'reception-lineage-retrieval': o({ registryDigest: h, canonicalUrl: s(512), title: s(1000), finding: s(8000), evidence: a(evidence, 1, 8), limitations: texts, relationship: e('attributed-reception-comparison'), uninterruptedTransmissionProven: no }),
    'policy-version-comparison': o({ policyId: id, beforeDigest: h, afterDigest: h, added: texts, removed: texts, changed: a(o({ clauseId: id, fields: a(e('text', 'scope'), 1, 2) }), 0, 40), legalEffectDetermined: no }),
    'control-evidence-gaps': o({ policyDigest: h, results: a(o({ controlId: id, state: e('declared-match', 'gap'), matchingEvidenceIds: texts, rejectedEvidenceIds: texts }), 1, 40), orphanEvidenceIds: texts, effectivenessVerified: no, complianceCertified: no }),
    'mcp-contract-compatibility': o({ state: e('exact-declarations-compatible', 'incompatible'), issues: texts, comparison: e('exact-schema-digests; no semantic subtyping'), serverContacted: no, officialConformanceClaimed: no }),
    'tool-permission-diff': o({ added: a(permission, 0, 50), removed: a(permission, 0, 50), wildcardAdditions: a(permission, 0, 50), effectiveAuthorizationEvaluated: no }),
    'publication-bundle-consistency': o({ consistent: yesno, views: a(o({ viewId: id, mismatches: texts }), 2, 8), missingKinds: texts, liveFetchPerformed: no, releaseCreated: no }),
  }
}
