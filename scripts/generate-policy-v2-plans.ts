import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { ASSURANCE_DISCLOSURE, REVIEW_POLICY_VERSION } from '../lib/release-readiness-policy-v2.ts'
import decisions from '../content/release-policy-v2/automated-editorial-decisions.json' with { type: 'json' }
import pkg from '../content/release-policy-v2/candidate-target-package.json' with { type: 'json' }

/**
 * The simulated readiness, the release plan and the Preview rehearsal.
 *
 * Every public count here is a projection of prepared work. The only observed
 * number is the current live surface; the rest describe a release that has not
 * happened and is not authorized.
 */

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
const LIVE = 792
const records = decisions.records as Record<string, unknown>[]
const canary = pkg.canary as Record<string, unknown>[]
const remainder = pkg.remainder as Record<string, unknown>[]

/* ------------------------------------------------- Part 8: simulated readiness --- */

const simulation = {
  schemaVersion: 'maha-policy-v2-simulation/1.0',
  policyVersion: REVIEW_POLICY_VERSION,
  calledProductionRpc: false,
  method: 'Local evaluation of the corrected package against policy v2. Production readiness was not called, and no candidate outside the 33 was assumed to have machine review.',
  cohort: {
    total: records.length,
    exactTargetDecisionsReproduced: records.filter((r) => (r.digestLineage as Record<string, unknown> | undefined)?.contentByteEquivalent === true).length,
    pathBReady: records.filter((r) => r.status === 'path-b-ready').length,
    evaluatorDisagreement: records.filter((r) => String(r.reason ?? '').includes('did not reproduce')).length,
    stale: records.filter((r) => String(r.reason ?? '').includes('not byte-equivalent')).length,
    malformed: records.filter((r) => String(r.reason ?? '').includes('no local record')).length,
    blocked: records.filter((r) => r.status !== 'path-b-ready').length,
    initial: records.filter((r) => r.releaseClassification === 'initial').length,
    superseding: records.filter((r) => r.releaseClassification && r.releaseClassification !== 'initial').length,
  },
  restOfWorkspace: {
    otherCandidates: 390,
    assumedMachineReviewed: 0,
    note: 'The other 390 candidates hold no machine review and none was invented for them. Only the 33 corrected records move in this simulation.',
  },
  boundary: 'A local simulation. It releases nothing and calls no Production RPC.',
  simulationDigest: '',
}
simulation.simulationDigest = sha({ ...simulation, simulationDigest: '' })

/* ------------------------------------------------------ Part 9: release plan --- */

const plan = {
  schemaVersion: 'maha-policy-v2-release-plan/1.0',
  policyVersion: REVIEW_POLICY_VERSION,
  authorized: false, executed: false, dispatched: false,
  assuranceTier: 'automated-internal-review-canonical',
  assuranceDisclosure: ASSURANCE_DISCLOSURE['automated-internal-review-canonical'],
  phases: [
    {
      phase: 'A', name: 'five-record canary', records: canary.length,
      manifest: canary,
      expectedDirectRoutes: 5, expectedSourceCascade: 0,
      projectedTotalBefore: LIVE, projectedTotalAfter: LIVE + 5,
    },
    {
      phase: 'B', name: 'twenty-eight-record remainder', records: remainder.length,
      manifest: remainder,
      expectedDirectRoutes: 28, expectedSourceCascade: 1,
      projectedTotalBefore: LIVE + 5, projectedTotalAfter: LIVE + 34,
    },
  ],
  projectedPublicCounts: {
    observedLiveToday: LIVE,
    afterCanary: LIVE + 5,
    afterRemainderAndCascade: LIVE + 34,
    remainingGapToOneThousand: 1000 - (LIVE + 34),
    status: 'PROJECTED. Only the live figure is observed; the rest describe a release that has not happened.',
  },
  expectedSitemapAndLlms: {
    afterCanary: { added: 5, sourceRoutesAdded: 0 },
    afterRemainder: { added: 29, sourceRoutesAdded: 1 },
    note: 'llms.txt and the sitemap call one eligibility function, so they move together or the release is wrong.',
  },
  controls: {
    staleTarget: 'Operation ids bind the candidate target. A record whose target moved produces a key matching no prepared operation.',
    unreleasedClaims: 'The aggregate source gate is unchanged and still refuses a page holding any unreleased claim.',
    assuranceHonesty: 'Path B pages must carry the automated-internal-review disclosure and must never render as expert reviewed, independently validated, human approved, consensus or certified truth.',
    authoritySeparation: 'Readiness is not release. Executing either phase needs a separate authorization this plan does not contain.',
    canaryFirst: 'Phase B must not begin until Phase A is verified live.',
  },
  boundary: 'A prepared, unauthorized, undispatched plan.',
  planDigest: '',
}
plan.planDigest = sha({ ...plan, planDigest: '' })

/* -------------------------------------------- Part 10: Preview rehearsal plan --- */

const preview = {
  schemaVersion: 'maha-policy-v2-preview-rehearsal/1.0',
  dispatched: false, provisioned: false, authorized: false,
  environment: 'preview',
  database: {
    kind: 'schema-only ephemeral',
    seededFromProduction: false,
    note: 'Schema only. No Production row is copied in, so a rehearsal cannot accidentally publish real content.',
  },
  commit: 'the exact merged commit under test, pinned by sha and never by branch',
  credentials: {
    kind: 'dedicated temporary',
    scope: 'preview-only; no Production operations or release-authority token participates',
    revocation: 'exact-credential revocation at teardown, verified by fingerprint rather than by slot',
  },
  scope: { canaryRecords: 5, remainderRecords: 0, productionWrites: 0 },
  teardown: [
    'revoke the exact temporary credentials issued for this rehearsal',
    'confirm revocation by observing refusal, not by absence of a slot',
    'drop the ephemeral database',
    'record sanitized closure evidence',
  ],
  closureEvidence: {
    includes: ['run identifier', 'commit', 'record ids', 'candidate targets', 'route verification', 'teardown result'],
    excludes: ['credential values', 'reviewer identities', 'private rationale', 'source passages'],
  },
  productionRelationship: 'A rehearsal only. A Production release remains a later, separately authorized operation and is not implied by a green rehearsal.',
  boundary: 'Prepared and undispatched. Nothing is provisioned.',
  previewDigest: '',
}
preview.previewDigest = sha({ ...preview, previewDigest: '' })

mkdirSync('content/release-policy-v2', { recursive: true })
writeFileSync('content/release-policy-v2/simulated-readiness.json', `${JSON.stringify(simulation, null, 2)}\n`)
writeFileSync('content/release-policy-v2/release-plan.json', `${JSON.stringify(plan, null, 2)}\n`)
writeFileSync('content/release-policy-v2/preview-rehearsal-plan.json', `${JSON.stringify(preview, null, 2)}\n`)
console.log(JSON.stringify({ simulation: simulation.cohort, projected: plan.projectedPublicCounts,
  phases: plan.phases.map((p) => ({ phase: p.phase, records: p.records, cascade: p.expectedSourceCascade })) }, null, 2))
