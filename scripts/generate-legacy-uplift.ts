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
import supplierFirstParty from '../content/evidence-batch-5/supplier-first-party.json' with { type: 'json' }
import { attested, buildAttestations, reuseByRoute, routeScopedByRoute } from '../lib/uplift/evidence-intake.ts'
import { vendorBackedSupplierRoutes } from '../lib/uplift/vendor-authorship.ts'
import { processRoute } from '../lib/uplift/process-routes.ts'
import kernelCalculations from '../content/legacy-uplift/kernel-calculations.json' with { type: 'json' }
import { deriveRelatedRoutes } from '../lib/uplift/related-records.ts'

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

const withAttestation = (s: LegacySource): LegacySource => {
  const a = attested.get(s.id)
  return a ? { ...s, establishes: a.establishes, boundary: a.boundary } : s
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
    // Astronomy declares its relationships as relatedArticleIds, not
    // relatedSlugs. Reading the wrong field silently dropped all 71 declared
    // relationships across all 24 articles, leaving the family to fall back on
    // co-citation. The ids carry an `astronomy-` prefix; all 71 resolve once it
    // is stripped, and an id that does not resolve yields no link.
    relatedRoutes: arr(a.relatedArticleIds)
      .map((id) => id.replace(/^astronomy-/, ''))
      .filter((slug) => slug.length > 0)
      .map((slug) => `/knowledge/astronomy/${slug}`),
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

/* ---------------------------------------------------------------- suppliers --- */
for (const sup of KNOWLEDGE_SUPPLIERS as unknown as Any[]) {
  inputs.push({
    family: 'semiconductor-suppliers', slug: String(sup.slug),
    route: `/knowledge/suppliers/${String(sup.slug)}`,
    title: String(sup.name), definition: str(sup.summary), description: str(sup.summary),
    // Named products are mechanism content: what the vendor says each system
    // addresses. Every line names the company, so a reader is never left to
    // assume independent measurement.
    mechanism: [...arr(sup.capabilityEvidence), ...((sup.namedProducts as { name: string; addresses: string }[] | undefined) ?? [])
      .map((prod) => `${prod.name}: ${prod.addresses}`)],
    measurements: [],
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

// Related records are derived by co-citation and bounded; see
// lib/uplift/related-records.ts for why the bound exists and how it chooses.
// Kernel-executed calculations, attached to the routes they were built for.
// Generated separately by scripts/generate-kernel-calculations.ts so the kernel
// runs at build time and no WebAssembly reaches a served bundle.
const kernelByRoute = new Map((kernelCalculations.calculations as Record<string, never>[])
  .map((c) => [c.route as unknown as string, c]))
for (const input of inputs) {
  const calc = kernelByRoute.get(input.route)
  if (!calc) continue
  const c = calc as unknown as { title: string; method: string; units: string; steps: string[]; assumptions: string[]; uncertainty: string }
  input.kernelCalculation = {
    title: c.title, method: c.method, units: c.units, steps: c.steps,
    assumptions: c.assumptions, uncertainty: c.uncertainty,
    kernelSha256: kernelCalculations.kernelSha256 as string,
    howToVerify: kernelCalculations.howToVerify as string,
    doesNotEstablish: kernelCalculations.doesNotEstablish as string[],
  }
}

deriveRelatedRoutes(inputs as unknown as { route: string; sources: readonly { id: string }[]; relatedRoutes: readonly string[] }[])

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
  const added = routeScopedByRoute.get(input.route)
  if (!added) return input
  return {
    ...input,
    sources: [...input.sources, ...added.map((entry) => ({
      id: entry.sourceId, title: entry.title, url: entry.retrievedFrom,
      establishes: entry.establishes, boundary: entry.boundary, accessed: entry.retrievedOn,
    }))],
  }
})
const results = withBatch1.map((input) => compileUplift(
  { ...input, attestations: buildAttestations() }, 6))
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
 *
 * First-party pages are counted in their own state and nowhere else. They are
 * deliberately not added to eligible, because eligibility here means the uplift
 * gate passed on independent evidence. A supplier profile carrying its own
 * company's documentation is useful and is not that.
 */
const vendorBackedRoutes = vendorBackedSupplierRoutes(
  withBatch1 as unknown as { route: string; sources: { id: string }[] }[])

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
