/**
 * Candidate map v4: restore the 4,000-route budget while retaining the 32
 * definition identities introduced by v3 as non-route graph objects.
 *
 * v2 and v3 remain immutable historical inputs. Tranche 18 remains the record
 * of how the 32 objects were reviewed when they were still represented as
 * route candidates. This generator changes representation, not review state.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { auditCardinality } from '../lib/federation/cardinality-audit.ts'
import { adjudicate } from '../lib/federation/definition-adjudication.ts'

const OUT = 'content/federation'
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
}
const sha = (value: unknown) => `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`
const signed = <T extends Record<string, unknown>>(body: T) => ({ ...body, provenanceDigest: sha(body) })

type Candidate = Record<string, unknown> & {
  candidateId: string; conceptId: string; siteId: string; url: string; path: string
  routeRole: string; rank: number | null; tranche: number | null; addedIn?: string
  unlocksDependents?: number; title: string
  conceptAuthority: { canonicalOwner: string }
}
const v2 = JSON.parse(readFileSync(`${OUT}/federation-route-candidates-v2.json`, 'utf8')) as
  Record<string, unknown> & { summary: { observedCanonicalRoutes: number; activeCandidates: number; projectedCanonicalRoutes: number }; allocation: { siteId: string; observed: number; activeCandidates: number; projected: number }[]; activeRanks: unknown[]; candidates: Candidate[] }
const v3 = JSON.parse(readFileSync(`${OUT}/federation-route-candidates-v3.json`, 'utf8')) as
  Record<string, unknown> & { candidates: Candidate[]; provenanceDigest: string }
const v3Lineage = JSON.parse(readFileSync(`${OUT}/federation-candidate-lineage-v3.json`, 'utf8')) as
  { counts: { addedCandidates: number }; addedCandidates: { candidateId: string; candidateObjectDigest: string }[]; provenanceDigest: string }
const t18 = JSON.parse(readFileSync(`${OUT}/federation-tranche-18-decisions-v1.json`, 'utf8')) as
  { provenanceDigest: string; decisions: { candidateId: string; conceptId: string; finalState: string }[] }

const additions = v3.candidates.filter((candidate) => candidate.addedIn === 'v3')
const t18ByConcept = new Map(t18.decisions.map((decision) => [decision.conceptId, decision.finalState]))
const dispositions = adjudicate(additions.map((candidate) => ({
  candidateId: candidate.candidateId,
  conceptId: candidate.conceptId,
  unlocksDependents: candidate.unlocksDependents ?? 0,
})), t18ByConcept)
const dispositionById = new Map(dispositions.map((item) => [item.candidateId, item]))

const graphObjects = additions.map((candidate) => {
  const disposition = dispositionById.get(candidate.candidateId)
  if (!disposition) throw new Error(`missing-adjudication:${candidate.candidateId}`)
  return {
    graphObjectId: candidate.candidateId,
    canonicalId: candidate.conceptId,
    conceptId: candidate.conceptId,
    owner: candidate.conceptAuthority.canonicalOwner,
    title: candidate.title.replace(/ — Definition$/, ''),
    objectRole: 'canonical-definition-identity',
    routeBudget: false,
    publicRoute: null,
    priorV3Path: candidate.path,
    priorV3CandidateDigest: v3Lineage.addedCandidates.find((item) => item.candidateId === candidate.candidateId)?.candidateObjectDigest,
    reviewedIn: 'tranche-18',
    tranche18State: disposition.tranche18State,
    disposition: disposition.disposition,
    evidenceGroup: disposition.evidenceGroup,
    dependentsAtStake: disposition.dependentsAtStake,
    reason: disposition.reason,
    publication: { state: 'non-route-graph-object', crawlable: false, compiled: false },
  }
}).sort((a, b) => a.canonicalId.localeCompare(b.canonicalId))

const coverage = new Map<string, string>()
for (const candidate of v2.candidates) coverage.set(candidate.candidateId, `tranche-${candidate.tranche ?? 'preexisting'}`)
for (const object of graphObjects) coverage.set(object.graphObjectId, 'tranche-18')

const audit = auditCardinality({
  observedCanonicalRoutes: v2.summary.observedCanonicalRoutes,
  routeCandidates: v2.candidates.map((candidate) => ({ candidateId: candidate.candidateId, url: candidate.url, rank: candidate.rank })),
  graphObjects: graphObjects.map((object) => ({ candidateId: object.graphObjectId, url: object.canonicalId, rank: null })),
  summary: v2.summary,
  allocation: v2.allocation,
  activeRanksLength: v2.activeRanks.length,
  lineage: { addedCandidates: graphObjects.length, supersededCandidates: 0 },
  coverage,
})
if (!audit.consistent) throw new Error(`cardinality-repair-inconsistent:${audit.defects.map((item) => item.code).join(',')}`)

const graphBody = {
  schemaVersion: 'maha-federation-graph-objects/1.0',
  frozenOn: '2026-09-07',
  sourceCandidateMap: { schemaVersion: v3.schemaVersion, provenanceDigest: v3.provenanceDigest },
  sourceReview: { artifact: 'federation-tranche-18-decisions-v1.json', provenanceDigest: t18.provenanceDigest },
  boundary: 'Canonical graph objects supply identity and dependency resolution without consuming a public route. They are not pages, releases, or evidence for dependent claims.',
  counts: { graphObjects: graphObjects.length, publicRoutes: 0, crawlable: 0 },
  graphObjects,
}
writeFileSync(`${OUT}/federation-definition-graph-objects-v1.json`, `${JSON.stringify(signed(graphBody), null, 2)}\n`)

const { provenanceDigest: _v2Digest, ...v2Body } = v2
const v4Body = {
  ...v2Body,
  schemaVersion: 'maha-federation-route-candidate-map/4.0',
  frozenOn: '2026-09-07',
  previousCandidateMap: { schemaVersion: v3.schemaVersion, provenanceDigest: v3.provenanceDigest },
  representationRepair:
    'The 32 v3 additions are retained in federation-definition-graph-objects-v1.json as non-route canonical objects. The route candidate array returns to the reviewed 1,628-object budget inherited byte-for-byte from v2.',
  graphObjectManifest: { artifact: 'federation-definition-graph-objects-v1.json', digest: sha(graphBody), count: graphObjects.length },
  cardinality: { routeCandidates: v2.candidates.length, graphObjects: graphObjects.length, totalFederationObjects: v2.candidates.length + graphObjects.length },
}
writeFileSync(`${OUT}/federation-route-candidates-v4.json`, `${JSON.stringify(signed(v4Body), null, 2)}\n`)

const lineageBody = {
  schemaVersion: 'maha-federation-candidate-lineage/4.0',
  frozenOn: '2026-09-07',
  from: { schemaVersion: v3.schemaVersion, provenanceDigest: v3.provenanceDigest },
  to: { schemaVersion: v4Body.schemaVersion, candidateArrayDigest: sha(v2.candidates) },
  rule: 'Retain all 1,628 route candidates. Reclassify the 32 unranked, unallocated v3 additions as non-route graph objects. Delete or supersede no identity and create no public route.',
  counts: { retainedRouteCandidates: v2.candidates.length, reclassifiedAsGraphObjects: graphObjects.length, deletedObjects: 0, supersededRouteCandidates: 0, resultingRouteCandidates: v2.candidates.length },
  reclassifications: graphObjects.map((object) => ({ graphObjectId: object.graphObjectId, conceptId: object.conceptId, from: 'unranked-v3-route-candidate', to: object.disposition, graphObjectDigest: sha(object) })),
}
writeFileSync(`${OUT}/federation-candidate-lineage-v4.json`, `${JSON.stringify(signed(lineageBody), null, 2)}\n`)

const reconciliationRows = [] as Record<string, unknown>[]
for (const tranche of ['13', '14', '15', '16', '17']) {
  const dependency = JSON.parse(readFileSync(`${OUT}/federation-tranche-${tranche}-dependency-validation-v1.json`, 'utf8')) as
    { dependencies: { candidateId: string; conceptId: string; declaredOwner: string; state: string }[] }
  for (const row of dependency.dependencies.filter((item) => item.state === 'missing')) {
    const object = graphObjects.find((item) => item.conceptId === row.conceptId && item.owner === row.declaredOwner)
    reconciliationRows.push({ tranche: Number(tranche), dependentCandidateId: row.candidateId, conceptId: row.conceptId, declaredOwner: row.declaredOwner,
      identityState: object ? 'resolved-to-graph-object' : 'still-missing',
      evidenceState: object?.tranche18State === 'evidence-ready' ? 'definition-evidence-ready' : 'definition-not-evidence-ready',
      graphObjectId: object?.graphObjectId ?? null,
      boundary: 'Identity resolution does not inherit evidence or make the dependent candidate publishable.' })
  }
}
const reconciliationBody = {
  schemaVersion: 'maha-federation-dependency-reconciliation/2.0', frozenOn: '2026-09-07',
  rule: 'A canonical graph object resolves concept identity. Evidence readiness remains a separate state and never transfers to a dependent claim.',
  counts: {
    priorMissingRecords: reconciliationRows.length,
    identityResolved: reconciliationRows.filter((row) => row.identityState === 'resolved-to-graph-object').length,
    identityStillMissing: reconciliationRows.filter((row) => row.identityState === 'still-missing').length,
    definitionEvidenceReady: reconciliationRows.filter((row) => row.evidenceState === 'definition-evidence-ready').length,
  },
  rows: reconciliationRows.sort((a, b) => Number(a.tranche) - Number(b.tranche) || String(a.dependentCandidateId).localeCompare(String(b.dependentCandidateId))),
}
writeFileSync(`${OUT}/federation-dependency-reconciliation-v2.json`, `${JSON.stringify(signed(reconciliationBody), null, 2)}\n`)

const repairBody = {
  schemaVersion: 'maha-federation-cardinality-repair/1.0', frozenOn: '2026-09-07',
  finding: 'Map v3 mixed 1,628 ranked route candidates with 32 unranked definition identities while retaining the 1,628-route summary. Treating all 1,660 as routes projected 4,032 and contradicted allocation and activeRanks.',
  decision: 'Model A: preserve all 1,628 route candidates and represent the 32 identities as non-route canonical graph objects. No reviewed route is displaced.',
  alternativesRejected: [
    'Grow to 4,032 routes: violates the frozen 4,000 target and assigns routes without ranking or allocation.',
    'Displace 32 reviewed routes: no added definition has observed route-specific demand sufficient to justify replacement.',
    'Delete the definitions: would reopen 94 identity gaps and discard Tranche 18 work.',
  ],
  audit,
  execution: { candidateContentChanged: false, reviewsRewritten: false, publicRoutesGenerated: false, buildRun: false, deployed: false },
}
writeFileSync(`${OUT}/federation-cardinality-repair-v1.json`, `${JSON.stringify(signed(repairBody), null, 2)}\n`)

const report = `# Federation cardinality and dependency repair\n\n## Decision\n\nMap v4 contains **1,628 route candidates** and references **32 non-route canonical graph objects**. With 2,372 observed routes, the route projection is exactly **4,000**. Total federation objects are 1,660; objects and routes are deliberately not the same count.\n\nThe 32 identities remain available to the 94 dependency records that named them. Identity resolution does not transfer evidence: Tranche 18's three evidence-ready definitions remain three, and the other 29 remain non-ready under that historical review.\n\n## Why\n\nThe v3 additions had no rank, tranche allocation, route-specific demand, or allocation budget. Promoting them to routes would have created 4,032 projected routes. Deleting them would reopen the dependency gaps. Non-route graph objects preserve identity without displacing reviewed routes.\n\n## Boundary\n\nNo candidate content, review, active binding, release, route, sitemap, or llms entry changed. No build or deployment ran. v2, v3, and every Tranche 13–18 artifact remain immutable historical records.\n`
writeFileSync('docs/operations/federation-cardinality-dependency-repair.md', report)

console.log(`routes ${audit.derived.observedCanonicalRoutes} + ${audit.derived.routeCandidateCount} = ${audit.derived.projectedCanonicalRoutes}`)
console.log(`graph objects: ${audit.derived.graphObjectCount}; dependency identities resolved: ${reconciliationBody.counts.identityResolved}`)
