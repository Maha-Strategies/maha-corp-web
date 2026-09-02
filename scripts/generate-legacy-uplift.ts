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
    relatedRoutes: [...arr(a.inputs), ...arr(a.outputs)].length > 0 ? [] : [],
    canonicalRelease: null,
  })
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
    relatedRoutes: arr(sup.processIds).map((id) => `/knowledge/processes/${id}`),
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
      title: String(cmp.title), definition: str(cmp.question), description: str(cmp.question),
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
  [...attested.entries()].map(([id, a]) => [id, {
    sourceId: id, retrievedFrom: a.retrievedFrom, retrievedOn: a.retrievedOn,
    depth: a.depth as never, exactLocator: a.exactLocator, observedContent: a.observedContent,
    identityVerified: a.identityVerified, identityBasis: 'recorded at inspection',
    subjectAligned: a.subjectAligned, subjectBasis: 'recorded at inspection',
    versionRelationship: a.versionRelationship, rightsBasis: a.rightsBasis,
  }]))
const results = inputs.map((input) => compileUplift({ ...input, attestations: attestationsByPage }, 6))
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

const report = {
  schemaVersion: 'maha-legacy-uplift-report/1.0',
  upliftVersion: UPLIFT_VERSION,
  generatedAt: '2026-09-02',
  inventory: { pages: results.length, families: Object.keys(byFamily).length, byFamily },
  outcome: {
    eligibleAndUpgraded: eligible.length,
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
