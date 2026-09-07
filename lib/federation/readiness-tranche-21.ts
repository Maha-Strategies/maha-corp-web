import { createHash } from 'node:crypto'

export type Tranche21State = 'evidence-ready' | 'revise' | 'blocked'

export type Tranche21Source = {
  sourceId: string
  identity: string
  locator: string
  rightsBasis: string
  scope: string
  boundary: string
  roles: readonly string[]
  kind: 'local-implementation' | 'official-authority' | 'commercial-contract'
}

export const OFFER_LAYERS = [
  {
    offerId: 'free-evidence-preflight', priceUsd: 0, acquisitionState: 'available-free',
    locator: 'app/tools/evidence-preflight/page.tsx — Service JSON-LD and public preflight form',
    scope: 'Automated structural assessment of at most three claims; no independent source inspection.',
  },
  {
    offerId: 'mps-document-preflight', priceUsd: 49, acquisitionState: 'self-service-checkout',
    locator: 'lib/mps-preflight.ts — PREFLIGHT_PRICE_USD and app/api/mps-preflight/checkout/route.ts',
    scope: 'Private automated claim map and verification backlog for a bounded nonfiction extract.',
  },
  {
    offerId: 'verified-evidence-dossier', priceUsd: 250, acquisitionState: 'informational-purchase-disabled',
    locator: 'lib/evidence-preflight-contract.ts — EVIDENCE_PREFLIGHT_PRICE_USD and fullDossierOffer',
    scope: 'Proposed source-inspected, claim-level evidence assessment and digest-bound package.',
  },
  {
    offerId: 'bespoke-dossier-paid-pilot', priceUsd: 5_000, acquisitionState: 'contracted-paid-pilot-only',
    locator: 'lib/evidence-dossier/package.ts — DOSSIER_OFFER_LIST_PRICE_USD and DossierEngagement',
    scope: 'Separately contracted 8–15 claim dossier package with 5–12 inspected sources and internal audit.',
  },
] as const

export const OFFER_BOUNDARY = 'The four declarations describe distinct scopes and acquisition states. A proposed or paid-pilot list price is not self-service availability, and no local readiness artifact may enable checkout or alter refund, delivery, privacy, or payment behavior.'

const source = (sourceId: string, locator: string, roles: readonly string[], scope: string, boundary: string): Tranche21Source => ({
  sourceId, identity: locator.split(' — ')[0], locator, roles, scope, boundary,
  rightsBasis: 'project-owned-reference-only', kind: 'local-implementation',
})

const commercial = (sourceId: string, locator: string, roles: readonly string[], scope: string): Tranche21Source => ({
  sourceId, identity: locator.split(' — ')[0], locator, roles, scope, boundary: OFFER_BOUNDARY,
  rightsBasis: 'project-owned-commercial-contract-reference', kind: 'commercial-contract',
})

const official = (sourceId: string, identity: string, locator: string, roles: readonly string[], scope: string, boundary: string): Tranche21Source => ({
  sourceId, identity, locator, roles, scope, boundary,
  rightsBasis: 'official-public-reference; quote-free metadata and paraphrase only', kind: 'official-authority',
})

export type Rational = { numerator: bigint; denominator: bigint }

function rational(numerator: bigint, denominator: bigint): Rational {
  if (denominator === BigInt(0)) throw new Error('denominator-zero')
  const sign = denominator < BigInt(0) ? BigInt(-1) : BigInt(1)
  let a = numerator * sign
  let b = denominator * sign
  let x = a < BigInt(0) ? -a : a
  let y = b
  while (y !== BigInt(0)) [x, y] = [y, x % y]
  const divisor = x === BigInt(0) ? BigInt(1) : x
  a /= divisor
  b /= divisor
  return { numerator: a, denominator: b }
}

export function linearInterpolate(x0: bigint, y0: bigint, x1: bigint, y1: bigint, x: bigint): Rational {
  if (x0 === x1) throw new Error('nodes-not-distinct')
  if (x < (x0 < x1 ? x0 : x1) || x > (x0 > x1 ? x0 : x1)) throw new Error('extrapolation-refused')
  return rational(y0 * (x1 - x0) + (y1 - y0) * (x - x0), x1 - x0)
}

export function trapezoidIntegral(spacing: bigint, ordinates: readonly bigint[]): Rational {
  if (spacing <= BigInt(0)) throw new Error('spacing-not-positive')
  if (ordinates.length < 2) throw new Error('insufficient-ordinates')
  const interior = ordinates.slice(1, -1).reduce((sum, value) => sum + value, BigInt(0))
  return rational(spacing * (ordinates[0] + BigInt(2) * interior + ordinates.at(-1)!), BigInt(2))
}

export function boundedMinimum(values: readonly bigint[]): { index: number; value: bigint } {
  if (!values.length) throw new Error('empty-domain')
  return values.slice(1).reduce((best, value, offset) => value < best.value ? { index: offset + 1, value } : best, { index: 0, value: values[0] })
}

export type DimensionVector = readonly [number, number, number, number, number, number, number]

export function combineDimensions(left: DimensionVector, right: DimensionVector, operation: 'multiply' | 'divide'): DimensionVector {
  const sign = operation === 'multiply' ? 1 : -1
  return left.map((value, index) => value + sign * right[index]) as unknown as DimensionVector
}

export function errorBudget(parts: readonly bigint[]): { sumOfSquares: bigint } {
  if (!parts.length || parts.some((value) => value < BigInt(0))) throw new Error('invalid-error-budget')
  return { sumOfSquares: parts.reduce((sum, value) => sum + value * value, BigInt(0)) }
}

export function cancellationFixture(): { floating: number; exactInteger: bigint; precisionLost: boolean } {
  const large = 10_000_000_000_000_000
  const floating = (large + 1) - large
  const exactInteger = (BigInt('10000000000000000') + BigInt(1)) - BigInt('10000000000000000')
  return { floating, exactInteger, precisionLost: BigInt(floating) !== exactInteger }
}

export type LiteratureObservation = {
  observationId: string
  normalizedClaimId: string
  direction: 'supports' | 'opposes' | 'mixed'
  population: string
  outcome: string
  sourceId: string
  exactLocator: string
}

export function classifyLiterature(observations: readonly LiteratureObservation[]): { state: 'conflict-observed' | 'no-conflict-observed'; observationIds: string[] } {
  if (observations.length < 2) throw new Error('at-least-two-observations-required')
  if (new Set(observations.map((row) => row.observationId)).size !== observations.length) throw new Error('duplicate-observation')
  if (observations.some((row) => !row.exactLocator.trim() || !row.sourceId.trim())) throw new Error('unlocated-observation')
  const claim = observations[0].normalizedClaimId
  if (observations.some((row) => row.normalizedClaimId !== claim)) throw new Error('claim-substitution')
  const comparable = observations.filter((row) => row.population === observations[0].population && row.outcome === observations[0].outcome)
  const directions = new Set(comparable.map((row) => row.direction))
  return { state: directions.has('supports') && directions.has('opposes') ? 'conflict-observed' : 'no-conflict-observed', observationIds: comparable.map((row) => row.observationId).sort() }
}

export function canonical(value: unknown): string {
  if (typeof value === 'bigint') return JSON.stringify(value.toString())
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
}

export function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`
}

const OFFER_SOURCE = commercial('t21-offer-layers', 'lib/federation/readiness-tranche-21.ts — OFFER_LAYERS and OFFER_BOUNDARY', ['commercial-use'], 'Separates free structural preflight, $49 document preflight, disabled proposed $250 verified dossier, and a distinct $5,000 contracted pilot.')
const COMMERCIALIZATION_SOURCE = commercial('t21-product-federation', 'lib/product-federation.ts — buildProductFederation and internalProducts', ['commercialization'], 'Projects actual source product states and acquisition modes without enabling CABEZON payment.')

export const APPLICATION_SOURCES: Readonly<Record<string, readonly Tranche21Source[]>> = {
  'urn:maha:concept:computation:error-budgets': [source('t21-error-budget', 'lib/federation/readiness-tranche-21.ts — errorBudget', ['machine-interface', 'reproducibility', 'worked-example'], 'Computes an exact integer sum of squared non-negative component budgets.', 'This fixture does not select components, claim statistical independence, take a square root, or establish an uncertainty model.')],
  'urn:maha:concept:computation:dimensional-analysis': [source('t21-dimension-vector', 'lib/federation/readiness-tranche-21.ts — combineDimensions', ['machine-interface', 'reproducibility'], 'Combines seven-component SI base-dimension exponent vectors under multiplication or division.', 'Dimensional consistency is necessary but does not establish a correct model, scale factor, unit conversion, or empirical validity.')],
  'urn:maha:concept:computation:interpolation': [source('t21-linear-interpolation', 'lib/federation/readiness-tranche-21.ts — linearInterpolate', ['machine-interface', 'reproducibility'], 'Computes exact rational linear interpolation between two distinct integer-coordinate nodes and refuses extrapolation.', 'This fixture establishes only linear interpolation inside one interval, not error bounds or suitability for observed data.')],
  'urn:maha:concept:computation:numerical-integration': [source('t21-trapezoid', 'lib/federation/readiness-tranche-21.ts — trapezoidIntegral', ['machine-interface', 'reproducibility'], 'Computes an exact rational composite trapezoid result on an equally spaced integer grid.', 'This fixture does not estimate quadrature error, choose a grid, or establish that the sampled function is integrable.')],
  'urn:maha:concept:computation:numerical-stability': [source('t21-cancellation', 'lib/federation/readiness-tranche-21.ts — cancellationFixture', ['machine-interface', 'reproducibility', 'worked-example'], 'Compares one specified IEEE-754 binary64 cancellation result with exact integer arithmetic.', 'One cancellation example does not characterize an algorithm, platform beyond ECMAScript Number semantics, or general stability.')],
  'urn:maha:concept:computation:optimization': [source('t21-bounded-minimum', 'lib/federation/readiness-tranche-21.ts — boundedMinimum', ['machine-interface', 'reproducibility', 'worked-example'], 'Enumerates a finite declared objective vector and returns the first exact minimum.', 'This fixture does not solve continuous, constrained, stochastic, or large-scale optimization problems.')],
  'urn:maha:concept:computation:formal-verification': [source('t21-formal-proof-lifecycle', 'lib/evidence-dossier/formal-proof-fixture.ts — FORMAL_PROOF_FIXTURE_DOSSIER and FORMAL_PROOF_FIXTURE_DIGEST', ['machine-interface', 'reproducibility', 'worked-example'], 'Binds a synthetic interval claim to a machine-checked Lean proof, deterministic calculation, sources, and an offline-verifiable package.', 'A proof establishes deduction under declared assumptions, not empirical truth, source fidelity, kernel equivalence, or independent reproduction.')],
  'urn:maha:concept:evidence:conflicting-literature': [source('t21-literature-conflict', 'lib/federation/readiness-tranche-21.ts — classifyLiterature', ['workflow', 'verification', 'failure-modes'], 'Compares two or more located observations only when claim, population, and outcome scopes match; preserves non-comparable observations without manufacturing conflict.', 'The classifier records directional disagreement; it does not adjudicate study quality, pool estimates, or decide which result is true.')],
}

export const ADDITIONAL_DEFINITION_SOURCES: Readonly<Record<string, readonly Tranche21Source[]>> = {
  'urn:maha:concept:computation:error-budgets': [official('t21-google-sre-error-budget', 'Site Reliability Engineering — Embracing Risk', 'https://sre.google/sre-book/embracing-risk/ — section “Forming Your Error Budget”', ['definition'], 'Defines an error budget from a service-level objective as the permitted unreliability within a defined period.', 'This is one organization’s published practice, not a standard; it sets no budget for any service and does not measure correctness.')],
}

export const EVIDENCE_COMMERCIAL_CONCEPTS = new Set([
  'uncertainty-recording', 'correction-and-retraction', 'calculation-receipts', 'evidence-dossiers', 'runtime-witness-receipts',
  'version-relationship', 'privacy-boundary', 'internal-review', 'audit-export', 'canonical-release', 'locator-verification', 'source-recovery', 'passage-support', 'conflicting-literature',
].map((suffix) => `urn:maha:concept:evidence:${suffix}`))

export const FEDERATED_COMMERCIALIZATION_CONCEPTS = new Set([
  'credential-rotation', 'tool-authorization', 'audit-receipts', 'delivery-acknowledgement', 'identity-bound-agents',
  'metered-evidence-retrieval', 'capability-scoped-tokens', 'machine-commerce-entitlement', 'tenant-isolation', 'enterprise-mcp-gateway',
  'human-approval-gates', 'provenance-witnessing', 'endpoint-substitution-defense', 'quota-enforcement', 'replay-safe-execution',
].map((suffix) => `urn:maha:concept:authority:${suffix}`))

export function commercialSources(conceptId: string, role: string): readonly Tranche21Source[] {
  if (role === 'commercial-use' && EVIDENCE_COMMERCIAL_CONCEPTS.has(conceptId)) return [OFFER_SOURCE]
  if (role === 'commercialization' && FEDERATED_COMMERCIALIZATION_CONCEPTS.has(conceptId)) return [COMMERCIALIZATION_SOURCE]
  return []
}

export const POLICY_SOURCES: Readonly<Record<string, readonly Tranche21Source[]>> = {
  'urn:maha:concept:governance:assurance-cases': [official('t21-nist-assurance', 'NIST CSRC assurance-case glossary', 'https://csrc.nist.gov/glossary/term/assurance_case — definition, source documents, assumptions and evidence', ['definition', 'evidence', 'tradeoffs'], 'Defines an assurance case as an auditable argument supported by evidence and explicit assumptions.', 'The glossary does not establish current law, adequacy of a particular case, or superiority over an audit or certification.')],
  'urn:maha:concept:governance:interoperability': [official('t21-eu-interoperability-act', 'Regulation (EU) 2024/903', 'https://interoperable-europe.ec.europa.eu/Interoperable-Europe-Act-Regulation — Articles 1–6 and Annex', ['current-law', 'comparison', 'uncertainty'], 'Establishes an EU public-sector legal framework, four interoperability layers, assessments, and sharing rules.', 'Current law is bounded to the Regulation scope; the four layers are not an executable universal machine rule.')],
  'urn:maha:concept:governance:digital-public-infrastructure': [official('t21-oecd-dpi-2024', 'OECD Digital Public Infrastructure for Digital Governments', 'https://doi.org/10.1787/ff525dc8-en — abstract and sections 2–4', ['definition', 'mechanisms', 'evidence', 'uncertainty', 'comparison'], 'Defines DPI, identifies common components, and records governance, adoption, funding, privacy, security, resilience, and cross-border considerations.', 'The policy paper does not prescribe one stack, prove causal outcomes, or turn survey observations into universal requirements.')],
  'urn:maha:concept:governance:competition-policy': [official('t21-doj-antitrust', 'US Department of Justice Antitrust Division', 'https://www.justice.gov/atr/antitrust-laws-and-you — Sherman, Clayton, FTC Act; https://www.justice.gov/atr/merger-guidelines/overview — 2023 Merger Guidelines', ['definition', 'sources', 'mechanisms', 'comparison'], 'Identifies US federal antitrust authorities and distinct conduct and merger-analysis mechanisms.', 'US federal sources are not other jurisdictions, case-specific legal advice, or an executable enforcement rule.')],
  'urn:maha:concept:governance:intellectual-property': [official('t21-wipo-ip-ai', 'WIPO Revised Issues Paper on IP Policy and AI', 'https://www.wipo.int/meetings/en/doc_details.jsp?doc_id=499504 — issue groups 4–13', ['evidence', 'comparison', 'implementation', 'tradeoffs'], 'Organizes AI/IP questions across patents, copyright, designs, data, trade secrets, and technology gaps.', 'The issues paper frames questions and options; it is not current national law, legal advice, or a final WIPO position.')],
  'urn:maha:concept:governance:traceability': [official('t21-eu-ai-traceability', 'European Commission AI Act service material', 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/recital-71 — Recital 71 and Articles 11, 12, 19 and 72', ['mechanisms'], 'Connects high-risk AI traceability to technical documentation, automatic logs, retention, and post-market monitoring.', 'The mechanism is specific to the EU AI Act context and does not establish universal technical sufficiency or legal advice.')],
}
