import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { AUTHORITY_DECISIONS, AUTHORITY_SOURCES, assertRecoveryContract, digest } from '../lib/federation/external-authority-recovery.ts'

const root = resolve(import.meta.dirname, '..')
const out = resolve(root, 'content/federation')
mkdirSync(out, { recursive: true })
assertRecoveryContract()

const map = JSON.parse(readFileSync(resolve(out, 'federation-route-candidates-v3.json'), 'utf8')) as { schemaVersion: string; baselineDigest: string; candidates: Array<Record<string, unknown> & { candidateId: string; conceptId: string; siteId: string; path: string; routeRole: string; rank: number }> }
const conceptIds = new Set(AUTHORITY_DECISIONS.map((item) => item.conceptId))
const candidates = map.candidates.filter((item) => conceptIds.has(item.conceptId)).sort((a, b) => a.rank - b.rank || a.candidateId.localeCompare(b.candidateId))
const impacts = AUTHORITY_DECISIONS.map((decision) => ({
  conceptId: decision.conceptId,
  decisionState: decision.state,
  dependentCandidateCount: candidates.filter((item) => item.conceptId === decision.conceptId).length,
  dependentCandidates: candidates.filter((item) => item.conceptId === decision.conceptId).map(({ candidateId, siteId, path, routeRole, rank }) => ({ candidateId, siteId, path, routeRole, rank })),
}))

function artifact<T extends Record<string, unknown>>(name: string, body: T) {
  const value = { artifact: name, schemaVersion: '1.0', generatedOn: '2026-09-07', status: 'private-noncanonical-proposals-only', ...body }
  return { ...value, provenanceDigest: digest(value) }
}

const cohort = artifact('federation-external-authority-recovery-cohort', {
  candidateMap: { schemaVersion: map.schemaVersion, baselineDigest: map.baselineDigest, observedCandidateCount: map.candidates.length },
  conceptIds: [...conceptIds].sort(),
  dependentCandidateIds: candidates.map((item) => item.candidateId),
})
const inspections = artifact('federation-external-authority-source-inspections', { sources: AUTHORITY_SOURCES })
const decisions = artifact('federation-external-authority-decisions', {
  decisions: AUTHORITY_DECISIONS,
  counts: Object.fromEntries(['definition-proposal-ready', 'revise', 'blocked'].map((state) => [state, AUTHORITY_DECISIONS.filter((item) => item.state === state).length])),
  adoption: { activeBindingsChanged: 0, candidateStatesChanged: 0, reviewsCreated: 0, releasesCreated: 0, routesCompiled: 0 },
})
const impact = artifact('federation-external-authority-dependency-impact', { impacts, totalDependentCandidates: candidates.length })
const readiness = artifact('federation-external-authority-readiness', {
  result: { definitionProposalsReady: AUTHORITY_DECISIONS.filter((item) => item.state === 'definition-proposal-ready').length, heldForRevision: AUTHORITY_DECISIONS.filter((item) => item.state === 'revise').length, dependentCandidates: candidates.length },
  gate: 'Definition proposals remain private and cannot make a route evidence-ready. Each dependent candidate still requires its own source identity, content and locator inspection, alignment audit, exact-revision review, and active canonical release.',
  execution: { buildRun: false, routeGenerated: false, sitemapChanged: false, llmsChanged: false, deployed: false },
})

const files: Record<string, unknown> = {
  'federation-external-authority-recovery-cohort-v1.json': cohort,
  'federation-external-authority-source-inspections-v1.json': inspections,
  'federation-external-authority-decisions-v1.json': decisions,
  'federation-external-authority-dependency-impact-v1.json': impact,
  'federation-external-authority-readiness-v1.json': readiness,
}
for (const [name, value] of Object.entries(files)) writeFileSync(resolve(out, name), `${JSON.stringify(value, null, 2)}\n`)

const report = `# External authority recovery readiness\n\nGenerated 2026-09-07. Private, noncanonical, and additive.\n\n## Result\n\n- 12 externally governed concepts frozen.\n- ${readiness.result.definitionProposalsReady} definition proposals have section-level authority support.\n- ${readiness.result.heldForRevision} remains held: deterministic arithmetic is broader than the inspected public material.\n- ${candidates.length} candidate routes depend on these concepts. None changed state.\n- Active bindings changed: 0. Reviews, releases, compiled routes, builds, and deployments: 0.\n\n## Boundary\n\n${readiness.gate}\n\nThe IEEE 1788 landing page was inspected only for identity and scope; DLMF carries the content-level interval definition. The full IEEE 754 standard was not inspected, so deterministic arithmetic was not promoted. Sources are references only; no source text is reproduced.\n`
mkdirSync(resolve(root, 'docs/operations'), { recursive: true })
writeFileSync(resolve(root, 'docs/operations/federation-external-authority-recovery-readiness.md'), report)
