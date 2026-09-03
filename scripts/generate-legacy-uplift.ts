import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { UPLIFT_VERSION, compileUplift, type LegacyPageInput, type LegacySource } from '../lib/legacy-knowledge-uplift.ts'
import { ASTRONOMY_ARTICLES, ASTRONOMY_SOURCES } from '../lib/astronomy-knowledge.ts'
import { MATHEMATICAL_BRIDGES, MATHEMATICAL_CONCEPTS, MATHEMATICS_SOURCES } from '../lib/mathematics-knowledge.ts'
import { RELIGION_COMPARISONS, RELIGION_CONCEPTS, RELIGION_MATHEMATICS_BRIDGES, RELIGION_SOURCES } from '../lib/religion-knowledge.ts'
import { NEUROMORPHIC_COMPARISONS, NEUROMORPHIC_CONCEPTS, NEUROMORPHIC_MATHEMATICS_BRIDGES, NEUROMORPHIC_SOURCES } from '../lib/neuromorphic-biocomputing.ts'
import { SEMICONDUCTOR_EQUIPMENT_ARTICLES } from '../lib/semiconductor-equipment.ts'
import { KNOWLEDGE_ARTICLES, KNOWLEDGE_SOURCES } from '../lib/knowledge-data.ts'
import { KNOWLEDGE_SUPPLIERS } from '../lib/knowledge-process-profiles.ts'
import attestationFile from '../content/legacy-uplift/inspection-attestations.json' with { type: 'json' }
import batch1 from '../content/semiconductor-evidence/batch-1.json' with { type: 'json' }
import batch2 from '../content/evidence-batch-2/inspections.json' with { type: 'json' }
import batch3 from '../content/evidence-batch-3/inspections.json' with { type: 'json' }
import batch4 from '../content/evidence-batch-4/inspections.json' with { type: 'json' }
import supplierFirstParty from '../content/evidence-batch-5/supplier-first-party.json' with { type: 'json' }
import reuse from '../content/evidence-batch-7/reuse-audit.json' with { type: 'json' }
import batch8 from '../content/evidence-batch-8/inspections.json' with { type: 'json' }
import batch9 from '../content/evidence-batch-9/inspections.json' with { type: 'json' }
import batch12 from '../content/evidence-batch-12/inspections.json' with { type: 'json' }

/**
 * Reuse of already-inspected evidence, applied per route.
 *
 * Each accepted entry names one route, one source and the exact passage that
 * reaches that route's claim. Nothing is inferred from a source's other routes.
 */
const reuseByRoute = new Map<string, { sourceId: string; exactLocator: string; supportingPassage: string; limitationsCarried: string; rightsBasis: string; sourceTitle: string; version: string }[]>()
// Batch 8 names support per claim, so each route carries its own passage.
for (const source of [...batch8.inspected, ...batch9.inspected, ...batch12.inspected] as unknown as { sourceId: string; title: string; versionRelationship: string; rightsBasis: string; boundary: string; claimByClaimSupport: { route: string; locator: string; supportingPassage: string }[] }[]) {
  for (const claim of source.claimByClaimSupport) {
    reuseByRoute.set(claim.route, [...(reuseByRoute.get(claim.route) ?? []), {
      sourceId: source.sourceId, exactLocator: claim.locator,
      supportingPassage: claim.supportingPassage, limitationsCarried: source.boundary,
      rightsBasis: source.rightsBasis, sourceTitle: source.title, version: source.versionRelationship,
    }])
  }
}
for (const entry of reuse.accepted as Record<string, string>[]) {
  reuseByRoute.set(entry.route, [...(reuseByRoute.get(entry.route) ?? []), {
    sourceId: entry.sourceId, exactLocator: entry.exactLocator,
    supportingPassage: entry.supportingPassage, limitationsCarried: entry.limitationsCarried,
    rightsBasis: entry.rightsBasis, sourceTitle: entry.sourceTitle, version: entry.version,
  }])
}

/**
 * Batch 4 names supported routes per claim rather than per source, so a source
 * reaches a page only where a distinct inspected passage backs that page's own
 * claim. The shape is flattened here into the same supportsRoutes contract.
 */
const batch4Flattened = (batch4.inspected as unknown as { claimByClaimSupport: { route: string }[] }[]).map((entry) => ({
  ...entry,
  supportsRoutes: entry.claimByClaimSupport.map((c) => c.route),
}))

/**
 * Inventories the legacy corpus, baselines it, and compiles the uplift.
 *
 * Each family is adapted into one shape. The adapters only rename fields the
 * family already has; where a family has nothing for a dimension, the adapter
 * passes nothing, and the compiler refuses rather than inventing.
 */

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
const pick = <T extends { id: string }>(all: readonly T[], ids: readonly string[] | undefined) =>
  (ids ?? []).map((id) => all.find((entry) => entry.id === id)).filter((entry): entry is T => entry !== undefined)

type Any = Record<string, unknown>
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined)
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string')
    : typeof v === 'string' && v.length > 0 ? [v] : []

const asSource = (s: Any): LegacySource => ({
  id: String(s.id), title: String(s.title ?? ''), publisher: str(s.publisher),
  url: str(s.url), establishes: str(s.establishes), boundary: str(s.boundary),
  accessed: str(s.accessed), authorityTier: str(s.authorityTier),
})

/**
 * Inspection results, applied to the sources they describe.
 *
 * A source only gains `establishes` and `boundary` here because someone read
 * it and wrote down what it says and where it stops. Sources that could not be
 * retrieved gain nothing and stay reference-only.
 */
type Attestation = { sourceId: string; establishes: string; boundary: string; depth: string; exactLocator: string; observedContent: string; identityVerified: boolean; subjectAligned: boolean; retrievedFrom: string; retrievedOn: string; versionRelationship: string; rightsBasis: string }
const attested = new Map<string, Attestation>(
  (attestationFile.attestations as Attestation[]).map((a) => [a.sourceId, a]))

/**
 * Vendor-authored sources documented in Batch 1, before the first-party tier.
 *
 * Batch 7 stopped these conferring independent support on the three supplier
 * profiles. It missed the fourteen equipment and process pages that cite the
 * same documents. A company describing its own products is first-party
 * evidence wherever it is cited, so the exclusion belongs to the source rather
 * than to a list of routes.
 */
const VENDOR_AUTHORED_SOURCES = new Set(['asml-lithography', 'tel-process-equipment', 'amkor-3d-stack'])

const withAttestation = (s: LegacySource): LegacySource => {
  const a = attested.get(s.id)
  return a ? { ...s, establishes: a.establishes, boundary: a.boundary } : s
}

/**
 * Batch 1 evidence, applied only to the routes each source was checked against.
 *
 * A source supports a page because someone read it and judged it to be about
 * that page's subject. Routes are named per source rather than matched by
 * keyword, so a metrology paper cannot drift onto a packaging page.
 */
type Batch1 = { sourceId: string; title: string; retrievedFrom: string; retrievedOn: string; depth: string; exactLocators: string[]; observedContent: string; establishes: string; boundary: string; identityVerified: boolean; versionRelationship: string; rightsBasis: string; supportsRoutes: string[] }
const batch1ByRoute = new Map<string, Batch1[]>()
for (const entry of [...(batch1.inspected as Batch1[]), ...(batch2.inspected as unknown as Batch1[]), ...(batch3.inspected as unknown as Batch1[]), ...(batch4Flattened as unknown as Batch1[])]) {
  for (const route of entry.supportsRoutes) {
    batch1ByRoute.set(route, [...(batch1ByRoute.get(route) ?? []), entry])
  }
}

const inputs: LegacyPageInput[] = []

/* ---------------------------------------------------------------- astronomy --- */
for (const a of ASTRONOMY_ARTICLES as unknown as Any[]) {
  inputs.push({
    family: 'astronomy', slug: String(a.slug), route: `/knowledge/astronomy/${String(a.slug)}`,
    title: String(a.title), definition: str(a.definition) ?? str(a.description), description: str(a.description),
    mechanism: [...arr(a.measured), ...arr(a.inferred)],
    measurements: arr(a.measured),
    limitations: arr(a.limitations),
    // Astronomy records assumptions, limitations and an uncertainty claim, but
    // no statement of what the article does not establish. Assumptions are
    // load-bearing preconditions, not negative space, so nothing is passed
    // here and the family is refused on that dimension rather than filled in.
    doesNotEstablish: [],
    assumptions: arr(a.assumptions),
    sources: (pick(ASTRONOMY_SOURCES as unknown as Any[], arr(a.sourceIds)) as Any[]).map(asSource),
    bridges: [], comparisons: [],
    relatedRoutes: arr(a.relatedSlugs).map((s) => `/knowledge/astronomy/${s}`),
    canonicalRelease: null,
  })
}

/* -------------------------------------------------------------- mathematics --- */
for (const c of MATHEMATICAL_CONCEPTS as unknown as Any[]) {
  const bridges = (MATHEMATICAL_BRIDGES as unknown as Any[]).filter((b) => b.conceptId === c.id)
  inputs.push({
    family: 'mathematics', slug: String(c.slug), route: `/knowledge/mathematics/${String(c.slug)}`,
    title: String(c.name), definition: str(c.definition) ?? str(c.description), description: str(c.description),
    mechanism: arr(c.procedure), measurements: arr(c.invariants),
    limitations: [...arr(c.errorBounds), ...arr(c.assumptions)],
    doesNotEstablish: arr(c.doesNotEstablish), assumptions: arr(c.assumptions),
    sources: (pick(MATHEMATICS_SOURCES as unknown as Any[], arr(c.sourceIds)) as Any[]).map(asSource),
    bridges: bridges.map((b) => ({
      id: String(b.id), title: String(b.title), application: str(b.application),
      inputs: arr(b.inputs), outputs: arr(b.outputs), limitations: arr(b.limitations),
      targetPath: str(b.targetPath),
    })),
    comparisons: [],
    relatedRoutes: arr(c.relatedSlugs).map((s) => `/knowledge/mathematics/${s}`),
    canonicalRelease: null,
  })
}

/* ----------------------------------------------------------------- religion --- */
for (const c of RELIGION_CONCEPTS as unknown as Any[]) {
  const bridges = (RELIGION_MATHEMATICS_BRIDGES as unknown as Any[]).filter((b) => b.religionConceptId === c.id)
  const comparisons = (RELIGION_COMPARISONS as unknown as Any[])
    .filter((cmp) => arr(cmp.relatedConceptSlugs).includes(String(c.slug)))
  inputs.push({
    family: 'religion', slug: String(c.slug), route: `/knowledge/religion/${String(c.slug)}`,
    title: String(c.name), definition: str(c.definition) ?? str(c.description), description: str(c.description),
    mechanism: arr(c.method), measurements: arr(c.evidenceInputs),
    limitations: arr(c.interpretiveRisks), doesNotEstablish: arr(c.doesNotEstablish),
    sources: (pick(RELIGION_SOURCES as unknown as Any[], arr(c.sourceIds)) as Any[]).map(asSource),
    bridges: bridges.map((b) => ({
      id: String(b.id), title: String(b.title), application: str(b.application),
      inputs: arr(b.inputs), outputs: arr(b.outputs), limitations: arr(b.limitations),
    })),
    comparisons: comparisons.map((cmp) => ({
      id: String(cmp.id), title: String(cmp.title), perspectives: cmp.perspectives as unknown[],
      nonEquivalences: arr(cmp.nonEquivalences), prohibitedInference: str(cmp.prohibitedInference),
      sourceIds: arr(cmp.sourceIds),
    })),
    relatedRoutes: arr(c.relatedSlugs).map((s) => `/knowledge/religion/${s}`),
    canonicalRelease: null,
  })
}

/* ------------------------------------------------------------ neuromorphic --- */
for (const c of NEUROMORPHIC_CONCEPTS as unknown as Any[]) {
  const bridges = (NEUROMORPHIC_MATHEMATICS_BRIDGES as unknown as Any[]).filter((b) => b.neuromorphicConceptId === c.id)
  const comparisons = (NEUROMORPHIC_COMPARISONS as unknown as Any[])
    .filter((cmp) => arr(cmp.relatedConceptSlugs).includes(String(c.slug)))
  inputs.push({
    family: 'neuromorphic-biocomputing', slug: String(c.slug),
    route: `/knowledge/neuromorphic-biocomputing/${String(c.slug)}`,
    title: String(c.name), definition: str(c.definition) ?? str(c.description), description: str(c.description),
    mechanism: arr(c.mechanism), measurements: arr(c.measurements),
    limitations: arr(c.limitations),
    // reproducibilityControls say how to reproduce a result, which is not the
    // same as saying what the concept does not establish.
    doesNotEstablish: [],
    sources: (pick(NEUROMORPHIC_SOURCES as unknown as Any[], arr(c.sourceIds)) as Any[]).map(asSource),
    bridges: bridges.map((b) => ({
      id: String(b.id), title: String(b.title), application: str(b.application),
      inputs: arr(b.inputs), outputs: arr(b.outputs), limitations: arr(b.limitations),
    })),
    comparisons: comparisons.map((cmp) => ({
      id: String(cmp.id), title: String(cmp.title), sides: cmp.sides as unknown[],
      nonEquivalences: arr(cmp.nonEquivalences), prohibitedInference: str(cmp.prohibitedInference),
      sourceIds: arr(cmp.sourceIds),
    })),
    relatedRoutes: arr(c.relatedSlugs).map((s) => `/knowledge/neuromorphic-biocomputing/${s}`),
    canonicalRelease: null,
  })
}

/* --------------------------------------------- semiconductor manufacturing --- */
const semiRoute = (kind: string, slug: string) => `/knowledge/${kind}/${slug}`
for (const a of [...(SEMICONDUCTOR_EQUIPMENT_ARTICLES as unknown as Any[]), ...(KNOWLEDGE_ARTICLES as unknown as Any[])]) {
  const kindMap: Record<string, string> = {
    equipment: 'equipment', process: 'processes', material: 'materials',
    supplier: 'suppliers', concept: 'concepts', domain: 'domains',
  }
  const kind = kindMap[String(a.kind)] ?? String(a.kind)
  const route = semiRoute(kind, String(a.slug))
  if (inputs.some((i) => i.route === route)) continue
  inputs.push({
    family: 'semiconductor-manufacturing', slug: String(a.slug), route,
    title: String(a.title), definition: str(a.definition) ?? str(a.description), description: str(a.description),
    mechanism: arr(a.processSteps), measurements: [...arr(a.criticalParameters), ...arr(a.metrology)],
    limitations: arr(a.failureModes),
    // Failure modes describe how a process fails, not what the page does not establish.
    doesNotEstablish: [],
    sources: (pick(KNOWLEDGE_SOURCES as unknown as Any[], arr(a.sourceIds)) as Any[]).map(asSource).map(withAttestation),
    bridges: [], comparisons: [],
    relatedRoutes: [],
    canonicalRelease: null,
  })
}

/**
 * Supplier profiles declare the processes they serve as `process-*` identifiers,
 * which are a different naming scheme from the process articles' own slugs. The
 * generator previously pasted the identifier straight into a route, so sixteen
 * supplier pages linked to `/knowledge/processes/process-plasma-etch` and
 * similar, none of which exist. Only two of the eighteen happened to line up.
 *
 * The correspondence is an identity between two names for the same process, not
 * a claim about either. An identifier with no article resolves to no link
 * rather than to a guess.
 */
const PROCESS_ID_TO_SLUG: Record<string, string> = {
  'process-photolithography': 'photolithography',
  'process-thin-film-deposition': 'thin-film-deposition',
  'process-plasma-etch': 'plasma-etch-and-pattern-transfer',
  'process-ion-implantation-annealing': 'ion-implantation-and-annealing',
  'process-copper-interconnect-cmp': 'copper-interconnects-and-cmp',
  'process-advanced-packaging': 'advanced-packaging-and-heterogeneous-integration',
  'process-ic-design-tapeout': 'ic-design-to-tapeout',
  'process-rtl-to-physical-design': 'rtl-verification-synthesis-physical-design',
  'process-mask-data-reticle-fabrication': 'mask-data-preparation-and-reticle-fabrication',
  'process-silicon-wafer-preparation': 'silicon-crystal-growth-and-wafer-preparation',
  'process-wafer-cleaning-surface-preparation': 'wafer-cleaning-and-surface-preparation',
  'process-thermal-oxidation-diffusion': 'thermal-oxidation-diffusion-and-furnace-processing',
  'process-wafer-sort': 'wafer-acceptance-test-and-wafer-sort',
  'process-wafer-thinning-dicing': 'wafer-thinning-dicing-and-die-handling',
  'process-package-substrates-rdl': 'package-substrates-and-redistribution-layers',
  'process-wire-bond-flip-chip': 'wire-bonding-and-flip-chip-interconnect',
  'process-encapsulation-underfill-molding': 'underfill-molding-and-package-encapsulation',
  'process-final-burn-in-system-test': 'final-test-burn-in-and-system-level-test',
}

/** Resolve one declared process identifier to a route, or to nothing. */
function processRoute(processId: string): string[] {
  const slug = PROCESS_ID_TO_SLUG[processId]
  return slug ? [`/knowledge/processes/${slug}`] : []
}

/* ---------------------------------------------------------------- suppliers --- */
for (const sup of KNOWLEDGE_SUPPLIERS as unknown as Any[]) {
  inputs.push({
    family: 'semiconductor-suppliers', slug: String(sup.slug),
    route: `/knowledge/suppliers/${String(sup.slug)}`,
    title: String(sup.name), definition: str(sup.summary), description: str(sup.summary),
    mechanism: arr(sup.capabilityEvidence), measurements: [],
    limitations: arr(sup.boundary),
    // A supplier profile records a capability boundary, which is a genuine
    // statement of what the evidence does not reach.
    doesNotEstablish: arr(sup.boundary),
    sources: (pick(KNOWLEDGE_SOURCES as unknown as Any[], arr(sup.sourceIds)) as Any[]).map(asSource).map(withAttestation),
    bridges: [], comparisons: [],
    relatedRoutes: arr(sup.processIds).flatMap(processRoute),
    canonicalRelease: null,
  })
}

/* -------------------------------------------------------- comparison pages --- */
const comparisonFamilies = [
  { family: 'religion', base: '/knowledge/religion/comparisons', rows: RELIGION_COMPARISONS as unknown as Any[], sources: RELIGION_SOURCES as unknown as Any[] },
  { family: 'neuromorphic-biocomputing', base: '/knowledge/neuromorphic-biocomputing/comparisons', rows: NEUROMORPHIC_COMPARISONS as unknown as Any[], sources: NEUROMORPHIC_SOURCES as unknown as Any[] },
]
for (const group of comparisonFamilies) {
  for (const cmp of group.rows) {
    const sides = (cmp.sides ?? cmp.perspectives) as unknown[] | undefined
    inputs.push({
      family: `${group.family}-comparisons`, slug: String(cmp.slug),
      route: `${group.base}/${String(cmp.slug)}`,
      title: String(cmp.title),
      // The question stood in for the answer, so these pages asked something
      // and answered nothing. Prefer a written answer where one exists.
      definition: str(cmp.answer) ?? str(cmp.question), description: str(cmp.question),
      mechanism: [...arr(cmp.comparisonMethod), ...arr(cmp.procedure)],
      measurements: arr(cmp.sharedAxes).length > 0 ? arr(cmp.sharedAxes) : arr(cmp.comparableAxes),
      limitations: arr(cmp.nonEquivalences),
      // A comparison states outright what it must not be read as.
      doesNotEstablish: arr(cmp.prohibitedInference),
      sources: (pick(group.sources, arr(cmp.sourceIds)) as Any[]).map(asSource),
      bridges: [],
      comparisons: [{
        id: String(cmp.id), title: String(cmp.title), sides,
        nonEquivalences: arr(cmp.nonEquivalences),
        prohibitedInference: str(cmp.prohibitedInference), sourceIds: arr(cmp.sourceIds),
      }],
      relatedRoutes: arr(cmp.relatedConceptSlugs).map((s) => `/knowledge/${group.family}/${s}`),
      canonicalRelease: null,
    })
  }
}

/* ------------------------------------------------------------------ compile --- */

const attestationsByPage = Object.fromEntries(
  [...attested.entries()].filter(([id]) => !VENDOR_AUTHORED_SOURCES.has(id)).map(([id, a]) => [id, {
    sourceId: id, retrievedFrom: a.retrievedFrom, retrievedOn: a.retrievedOn,
    depth: a.depth as never, exactLocator: a.exactLocator, observedContent: a.observedContent,
    identityVerified: a.identityVerified, identityBasis: 'recorded at inspection',
    subjectAligned: a.subjectAligned, subjectBasis: 'recorded at inspection',
    versionRelationship: a.versionRelationship, rightsBasis: a.rightsBasis,
  }]))
/**
 * Fill in typed related records by co-citation.
 *
 * Two pages that draw on the same inspected source are related, and that is a
 * fact about the corpus rather than a judgement about the subject: the link is
 * derived from the inspection records, so it cannot be authored to make a page
 * look connected. Pages that share no source get no link.
 *
 * This is deliberately not a similarity heuristic. The audit counts typed links
 * towards substantiality, and a heuristic would let a page earn that count from
 * a resemblance nobody checked.
 */
const routesBySource = new Map<string, string[]>()
for (const input of inputs) {
  for (const source of input.sources as unknown as { id: string }[]) {
    const routes = routesBySource.get(source.id) ?? []
    routes.push(input.route)
    routesBySource.set(source.id, routes)
  }
}
for (const input of inputs) {
  if (input.relatedRoutes.length > 0) continue
  const shared = new Set<string>()
  for (const source of input.sources as unknown as { id: string }[]) {
    for (const route of routesBySource.get(source.id) ?? []) {
      if (route !== input.route) shared.add(route)
    }
  }
  // Sorted so a regeneration produces byte-identical output.
  input.relatedRoutes = [...shared].sort()
}

const withBatch1 = inputs.map((input) => {
  const reused = reuseByRoute.get(input.route)
  if (reused) {
    // A reused source carries its limitations onto the page it now supports.
    return {
      ...input,
      sources: [...input.sources, ...reused.map((r) => ({
        id: r.sourceId, title: r.sourceTitle, url: `locator:${r.exactLocator}`,
        establishes: r.supportingPassage, boundary: r.limitationsCarried,
      }))],
    }
  }
  const added = batch1ByRoute.get(input.route)
  if (!added) return input
  return {
    ...input,
    sources: [...input.sources, ...added.map((entry) => ({
      id: entry.sourceId, title: entry.title, url: entry.retrievedFrom,
      establishes: entry.establishes, boundary: entry.boundary, accessed: entry.retrievedOn,
    }))],
  }
})
const batch1Attestations = Object.fromEntries([...(batch1.inspected as Batch1[]), ...(batch2.inspected as unknown as Batch1[]), ...(batch3.inspected as unknown as Batch1[]), ...(batch4Flattened as unknown as Batch1[])].map((entry) => [entry.sourceId, {
  sourceId: entry.sourceId, retrievedFrom: entry.retrievedFrom, retrievedOn: entry.retrievedOn,
  depth: entry.depth as never, exactLocator: entry.exactLocators.join('; '),
  observedContent: entry.observedContent, identityVerified: entry.identityVerified,
  identityBasis: 'recorded at inspection', subjectAligned: true,
  subjectBasis: 'route-scoped: the source was checked against this page subject',
  versionRelationship: entry.versionRelationship, rightsBasis: entry.rightsBasis,
}]))
type InspectedSource = {
  sourceId: string; exactLocators: string[]; establishes: string
  retrievedFrom: string; retrievedOn: string; versionRelationship: string; rightsBasis: string
}
// Batch 12 joins the attestation map. A source with no claimByClaimSupport
// attaches to no route, so an inspected source that supports nothing here --
// NARA's document-analysis method -- stays inspected and unused rather than
// being stretched onto claims it does not state.
const inspectedSources = [...batch8.inspected, ...batch9.inspected, ...batch12.inspected] as unknown as InspectedSource[]
const batch8Attestations = Object.fromEntries(inspectedSources.map((entry) => [entry.sourceId, {
  sourceId: entry.sourceId, retrievedFrom: entry.retrievedFrom, retrievedOn: entry.retrievedOn,
  depth: 'section-or-full-text' as never, exactLocator: entry.exactLocators.join('; '),
  observedContent: entry.establishes, identityVerified: true,
  identityBasis: 'verified at inspection against the cited identifier',
  subjectAligned: true, subjectBasis: 'route-scoped per claim',
  versionRelationship: entry.versionRelationship, rightsBasis: entry.rightsBasis,
}]))
const reuseAttestations = Object.fromEntries((reuse.accepted as Record<string, string>[]).map((entry) => [entry.sourceId, {
  sourceId: entry.sourceId, retrievedFrom: `locator:${entry.exactLocator}`, retrievedOn: '2026-09-03',
  depth: 'section-or-full-text' as never, exactLocator: entry.exactLocator,
  observedContent: entry.supportingPassage, identityVerified: true,
  identityBasis: 'inspected in an earlier batch; identity and version carried forward unchanged',
  subjectAligned: true, subjectBasis: entry.whyItMatches,
  versionRelationship: entry.version, rightsBasis: entry.rightsBasis,
}]))
const results = withBatch1.map((input) => compileUplift(
  { ...input, attestations: { ...attestationsByPage, ...batch1Attestations, ...reuseAttestations, ...batch8Attestations } }, 6))
const eligible = results.filter((r) => r.eligible)
const blocked = results.filter((r) => !r.eligible)
const governed = results.filter((r) => r.requiresGovernedRevision)

const blockerCounts: Record<string, number> = {}
for (const r of blocked) for (const refusal of r.refusals) blockerCounts[refusal] = (blockerCounts[refusal] ?? 0) + 1

const byFamily: Record<string, { total: number; eligible: number; blocked: number }> = {}
for (const r of results) {
  const f = (byFamily[r.family] ??= { total: 0, eligible: 0, blocked: 0 })
  f.total++
  if (r.eligible) f.eligible++
  else f.blocked++
}

const avg = (nums: number[]) => nums.length === 0 ? 0 : Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2))
const depth = {
  before: {
    dimensions: avg(results.map((r) => r.before.dimensionCount)),
    sourcesWithBoundary: avg(results.map((r) => r.before.sourcesWithBoundary)),
    declaredLocators: avg(results.map((r) => r.before.declaredLocators)),
    contentInspectedLocators: avg(results.map((r) => r.before.contentInspectedLocators)),
    explanatorySources: avg(results.map((r) => r.before.explanatorySources)),
    internalLinks: avg(results.map((r) => r.before.relatedRouteCount + r.before.bridgeCount)),
    renderedSections: avg(results.map((r) => r.before.renderedSections)),
  },
  after: {
    dimensions: avg(eligible.map((r) => r.after!.dimensionCount)),
    sourcesWithBoundary: avg(eligible.map((r) => r.after!.sourcesWithBoundary)),
    declaredLocators: avg(eligible.map((r) => r.after!.declaredLocators)),
    contentInspectedLocators: avg(eligible.map((r) => r.after!.contentInspectedLocators)),
    explanatorySources: avg(eligible.map((r) => r.after!.explanatorySources)),
    internalLinks: avg(eligible.map((r) => r.after!.relatedRouteCount + r.after!.bridgeCount)),
    renderedSections: avg(eligible.map((r) => r.after!.renderedSections)),
  },
  metric: 'Information dimensions, evidence coverage, declared versus content-inspected locators, internal links and rendered sections. Word count is deliberately not among them.',
  locatorNote: 'A declared locator is a URL. A content-inspected locator requires an independent attestation recording the passage that was read. The first pass conflated them and reported declared locators as inspected.',
}

/**
 * Four states, reported apart.
 *
 * Structural and source-supported are never summed into one quality headline,
 * because a page that gained shape and a page that gained evidence are not the
 * same achievement and the difference is the whole point of measuring.
 */
/**
 * First-party pages are counted in their own state and nowhere else.
 *
 * They are deliberately not added to eligible, because eligibility here means
 * the uplift gate passed on independent evidence. A supplier profile carrying
 * its own company's documentation is useful and is not that.
 */
/**
 * Vendor-authored sources, which can never confer independent support.
 *
 * These three were inspected in Batch 1, before the first-party tier existed,
 * and their pages were counted as independently supported ever since. A company
 * describing its own products is first-party evidence whenever it was read.
 */
const VENDOR_AUTHORED = new Set(['asml-lithography', 'tel-process-equipment', 'amkor-3d-stack'])

const vendorBackedRoutes = new Set(
  (attestationFile.attestations as { sourceId: string }[])
    .filter((a) => VENDOR_AUTHORED.has(a.sourceId))
    .flatMap((a) => (compiledRoutesFor(a.sourceId))))

function compiledRoutesFor(sourceId: string): string[] {
  const map: Record<string, string[]> = {
    'asml-lithography': ['/knowledge/suppliers/asml'],
    'tel-process-equipment': ['/knowledge/suppliers/tokyo-electron'],
    'amkor-3d-stack': ['/knowledge/suppliers/amkor-technology'],
  }
  return map[sourceId] ?? []
}

const firstPartyRoutes = new Set(
  (supplierFirstParty.inspected as { route: string; eligible: boolean }[])
    .filter((entry) => entry.eligible).map((entry) => entry.route))
for (const route of vendorBackedRoutes) firstPartyRoutes.add(route)

const sourceSupportedPages = eligible.filter((r) =>
  (r.after?.explanatorySources ?? 0) > 0 && !vendorBackedRoutes.has(r.route))
const structuralPages = eligible.filter((r) =>
  (r.after?.explanatorySources ?? 0) === 0 && !vendorBackedRoutes.has(r.route))
// First-party pages arrive from two places: blocked supplier profiles that
// gained a document, and eligible pages whose only evidence turned out to be
// vendor-authored. Only the first group leaves the blocked count.
const firstPartyFromBlocked = blocked.filter((r) => firstPartyRoutes.has(r.route)).length
const firstPartyFromEligible = eligible.filter((r) => vendorBackedRoutes.has(r.route)).length
const firstPartyDocumented = firstPartyFromBlocked + firstPartyFromEligible
const pageStates = {
  legacyUnchanged: results.length - eligible.length - blocked.length,
  structurallyUplifted: structuralPages.length,
  firstPartyDocumented,
  independentlySourceSupported: sourceSupportedPages.length,
  // First-party pages leave the blocked count without joining the supported one.
  blocked: blocked.length - firstPartyFromBlocked,
  total: results.length,
  neverCombined: 'structurallyUplifted, firstPartyDocumented and independentlySourceSupported are reported separately. First-party documentation is an organisation describing itself and must never be added to independent support in one evidentiary figure.',
  // Kept under its old name so earlier artifacts and tests still read correctly.
  sourceSupportedUplift: sourceSupportedPages.length,
}

const informationValue = {
  inspectedClaimsPerPage: avg(eligible.map((r) => r.after!.explanatorySources)),
  inspectedLocatorsPerPage: avg(eligible.map((r) => r.after!.contentInspectedLocators)),
  declaredLocatorsPerPage: avg(eligible.map((r) => r.after!.declaredLocators)),
  independentlySourcedExplanatorySections: sourceSupportedPages.length,
  informationDimensionsPerPage: avg(eligible.map((r) => r.after!.dimensionCount)),
  limitationsPerPage: avg(eligible.map((r) => r.sections.filter((s) => s.dimension === 'limitations').length)),
  typedInternalLinksPerPage: avg(eligible.map((r) => r.after!.relatedRouteCount + r.after!.bridgeCount)),
  supportedComparisons: eligible.reduce((n, r) => n + r.sections.filter((s) => s.dimension === 'bounded-comparison').length, 0),
  reproducibleCalculations: eligible.reduce((n, r) => n + r.sections.filter((s) => s.dimension === 'deterministic-calculation').length, 0),
  wordCountUsed: false,
}

const report = {
  schemaVersion: 'maha-legacy-uplift-report/2.0',
  pageStates,
  informationValue,
  upliftVersion: UPLIFT_VERSION,
  generatedAt: '2026-09-02',
  inventory: { pages: results.length, families: Object.keys(byFamily).length, byFamily },
  outcome: {
    eligibleAndUpgraded: eligible.length,
    // The distinction that matters most. A page can carry every required
    // dimension and still rest entirely on sources nobody has opened.
    upgradeQuality: {
      sourceSupported: eligible.filter((r) => (r.after?.explanatorySources ?? 0) > 0).length,
      structuralOnly: eligible.filter((r) => (r.after?.explanatorySources ?? 0) === 0).length,
      note: 'Structural means the page now carries the substantial shape, composed from evidence its family already stored. It does not mean any source was independently inspected. Only the source-supported count reflects inspected evidence.',
    },
    blocked: blocked.length,
    requiringGovernedRevision: governed.length,
    requiringNewGovernedContent: blocked.length,
    governedContentNeeded: {
      'negative-space-statement': blocked.filter((r) => r.refusals.includes('no-negative-space')).length,
      'source-establishes-and-boundary': blocked.filter((r) => r.refusals.includes('source-without-boundary')).length,
      note: 'These pages are blocked because evidence the corpus does not yet hold would have to be written. That is authored content under governance, not a rendering change, and none of it was invented here.',
    },
    blockerCounts,
  },
  depth,
  routesChanged: 0,
  duplicatePagesAdded: 0,
  boundary: 'A private compilation report. It contains no audit data, review packet, rejected material or credential.',
  reportDigest: '',
}
report.reportDigest = sha({ ...report, reportDigest: '' })

mkdirSync('content/legacy-uplift', { recursive: true })
writeFileSync('content/legacy-uplift/uplift-report.json', `${JSON.stringify(report, null, 2)}\n`)
writeFileSync('content/legacy-uplift/uplift-compiled.json', `${JSON.stringify({
  schemaVersion: 'maha-legacy-uplift-compiled/1.0',
  upliftVersion: UPLIFT_VERSION,
  pages: results.map((r) => ({
    route: r.route, family: r.family, slug: r.slug, eligible: r.eligible,
    refusals: r.refusals, before: r.before, after: r.after,
    sections: r.sections, sectionCount: r.sections.length, upliftDigest: r.upliftDigest,
  })),
}, null, 2)}\n`)

console.log(JSON.stringify({ inventory: report.inventory, outcome: report.outcome, depth }, null, 2))
