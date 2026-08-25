import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  DOSSIER_REVIEW_STATES,
  EPISTEMIC_STATUSES,
  REPLICATED_EMPIRICAL,
  isLegalReviewTransition,
} from '../lib/evidence-dossier/schema.ts'
import {
  EMPTY_PAYLOAD_SHA256,
  canonicalJson,
  isPlaceholderDigest,
  provenanceDigest,
} from '../lib/evidence-dossier/digest.ts'
import { validateDossier } from '../lib/evidence-dossier/validator.ts'
import { DEMONSTRATION_DOSSIER } from '../lib/evidence-dossier/demonstration.ts'
import { serializeDossier, serializeDossierCanonical } from '../lib/evidence-dossier/serialize.ts'
import {
  ANTIGRAVITY_EXAMPLE_FINDINGS,
  exampleVerdictTotals,
} from '../lib/evidence-dossier/antigravity-example-audit.ts'
import { FRONTIER_CANARY_RECORDS, FRONTIER_CANARY_CONTROL_RECORDS } from '../lib/frontier-canonicalization.ts'
import { QUANTUM_BRIDGE_CANDIDATES } from '../lib/quantum-bridge-candidates.ts'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/* ---------------------------------------------------------------- schema -- */

test('the demonstration dossier validates and is an illustrative draft', () => {
  assert.deepEqual(validateDossier(DEMONSTRATION_DOSSIER), [])
  assert.equal(DEMONSTRATION_DOSSIER.reviewState, 'illustrative-draft')
  assert.ok(DEMONSTRATION_DOSSIER.claims.length >= 5 && DEMONSTRATION_DOSSIER.claims.length <= 10)
})

test('the vocabulary is bounded, with no binary verified/contested state', () => {
  for (const status of EPISTEMIC_STATUSES) {
    assert.doesNotMatch(status, /^verified$|^contested$|^VERIFIED|^CONTESTED/)
  }
  for (const claim of DEMONSTRATION_DOSSIER.claims) {
    assert.ok(
      EPISTEMIC_STATUSES.includes(claim.epistemicStatus as never) ||
        claim.epistemicStatus === REPLICATED_EMPIRICAL,
    )
  }
})

test('review states may only advance one step and never skip internal audit', () => {
  assert.ok(isLegalReviewTransition('illustrative-draft', 'internally-audited'))
  assert.ok(isLegalReviewTransition('internally-audited', 'externally-reviewed'))
  assert.ok(!isLegalReviewTransition('illustrative-draft', 'canonical'))
  assert.ok(!isLegalReviewTransition('illustrative-draft', 'externally-reviewed'))
  assert.ok(!isLegalReviewTransition('canonical', 'illustrative-draft'))
  assert.equal(DOSSIER_REVIEW_STATES[0], 'illustrative-draft')
})

/* ------------------------------------------------------------- fail closed -- */

test('a passage without an exact locator fails validation', () => {
  const broken = clone(DEMONSTRATION_DOSSIER)
  broken.passages[0].locator = null
  const issues = validateDossier(broken)
  assert.ok(issues.some((issue) => issue.code === 'locator-missing'))
})

test('a source without a rights basis fails validation', () => {
  const broken = clone(DEMONSTRATION_DOSSIER)
  broken.sources[0].rightsBasis = ''
  assert.ok(validateDossier(broken).some((issue) => issue.code === 'rights-basis-missing'))
})

test('a source without an identifier or timestamp fails unless declared unverifiable', () => {
  const broken = clone(DEMONSTRATION_DOSSIER)
  broken.sources[0].identifier = null
  broken.sources[0].verifiedAt = null
  const codes = validateDossier(broken).map((issue) => issue.code)
  assert.ok(codes.includes('source-missing-identifier'))
  assert.ok(codes.includes('source-missing-timestamp'))
})

test('a bounded-passage claim requires the document to have been inspected', () => {
  const broken = clone(DEMONSTRATION_DOSSIER)
  broken.passages[0].originalDocumentInspected = false
  assert.ok(validateDossier(broken).some((issue) => issue.code === 'claim-passage-not-inspected'))
})

test('replicated-empirical requires two independent inspected empirical sources', () => {
  const broken = clone(DEMONSTRATION_DOSSIER)
  const claim = broken.claims.find((entry) => entry.claimId === 'clm_photon_energy')!
  claim.epistemicStatus = REPLICATED_EMPIRICAL
  const codes = validateDossier(broken).map((issue) => issue.code)
  assert.ok(codes.includes('replication-unsupported'), 'a single source must not establish replication')
})

test('a modelled result can never be replicated empirical', () => {
  const broken = clone(DEMONSTRATION_DOSSIER)
  const claim = broken.claims.find((entry) => entry.claimType === 'modelled-result')!
  claim.epistemicStatus = REPLICATED_EMPIRICAL
  assert.ok(validateDossier(broken).some((issue) => issue.code === 'replication-from-model'))
})

test('certification and approval wording is rejected', () => {
  const broken = clone(DEMONSTRATION_DOSSIER)
  broken.disclaimer = 'Maha Strategies LLC certifies this dossier and guarantees regulatory approval.'
  assert.ok(validateDossier(broken).some((issue) => issue.code === 'prohibited-wording'))
})

test('the demonstration prose claims no approval, certification or external review', () => {
  const prose = [
    DEMONSTRATION_DOSSIER.disclaimer,
    DEMONSTRATION_DOSSIER.intendedUse,
    DEMONSTRATION_DOSSIER.methodology,
    ...DEMONSTRATION_DOSSIER.limitations,
    ...DEMONSTRATION_DOSSIER.prohibitedUses,
  ].join(' ')
  assert.doesNotMatch(prose, /\bcertifies\b|\bcertification\b|regulatory approval|patent[- ]defensib/i)
  assert.match(prose, /not been internally audited|no external reviewer/i)
})

/* --------------------------------------------------------------- digests -- */

test('the empty-payload SHA-256 is rejected everywhere', () => {
  assert.equal(EMPTY_PAYLOAD_SHA256, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  assert.ok(isPlaceholderDigest(`sha256:${EMPTY_PAYLOAD_SHA256}`))
  assert.throws(() => provenanceDigest({}), /empty payload/i)

  const broken = clone(DEMONSTRATION_DOSSIER)
  broken.provenanceBundle.dossierDigest = `sha256:${EMPTY_PAYLOAD_SHA256}`
  assert.ok(validateDossier(broken).some((issue) => issue.code === 'placeholder-digest'))

  const brokenClaim = clone(DEMONSTRATION_DOSSIER)
  brokenClaim.claims[0].provenanceDigest = `sha256:${EMPTY_PAYLOAD_SHA256}`
  assert.ok(validateDossier(brokenClaim).some((issue) => issue.code === 'placeholder-digest'))
})

test('no digest anywhere in the demonstration is a placeholder', () => {
  assert.ok(!isPlaceholderDigest(DEMONSTRATION_DOSSIER.provenanceBundle.dossierDigest))
  for (const claim of DEMONSTRATION_DOSSIER.claims) assert.ok(!isPlaceholderDigest(claim.provenanceDigest))
  for (const passage of DEMONSTRATION_DOSSIER.passages) assert.ok(!isPlaceholderDigest(passage.passageHash))
})

test('hashing is deterministic across runs and independent of key order and timezone', () => {
  const first = provenanceDigest(DEMONSTRATION_DOSSIER)
  const second = provenanceDigest(clone(DEMONSTRATION_DOSSIER))
  assert.equal(first, second)

  const reordered = { b: 2, a: 1, at: '2026-08-25T18:00:00+00:00' }
  const original = { a: 1, at: '2026-08-25T18:00:00Z', b: 2 }
  assert.equal(provenanceDigest(reordered), provenanceDigest(original))
})

test('the digest excludes itself but changes when any evidentiary field changes', () => {
  const withOtherDigest = clone(DEMONSTRATION_DOSSIER)
  withOtherDigest.provenanceBundle.dossierDigest = 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
  assert.equal(provenanceDigest(withOtherDigest), provenanceDigest(DEMONSTRATION_DOSSIER))

  for (const mutate of [
    (d: typeof DEMONSTRATION_DOSSIER) => { d.claims[0].auditedStatement += ' extra' },
    (d: typeof DEMONSTRATION_DOSSIER) => { d.passages[0].locator = 'Section 9' },
    (d: typeof DEMONSTRATION_DOSSIER) => { d.sources[0].identifier = 'doi:10.0000/changed' },
    (d: typeof DEMONSTRATION_DOSSIER) => { d.reviewState = 'internally-audited' },
  ]) {
    const mutated = clone(DEMONSTRATION_DOSSIER)
    mutate(mutated)
    assert.notEqual(provenanceDigest(mutated), provenanceDigest(DEMONSTRATION_DOSSIER))
  }
})

test('canonical serialization drops digest fields and sorts keys', () => {
  const json = canonicalJson({ z: 1, a: 2, provenanceDigest: 'sha256:x' })
  assert.equal(json, '{"a":2,"z":1}')
})

/* --------------------------------------------------- submitted preservation -- */

test('submitted statements survive correction', () => {
  const corrected = DEMONSTRATION_DOSSIER.claims.filter((claim) =>
    claim.reviewerDecisions.some((decision) => decision.decision === 'correct-submitted-statement'),
  )
  assert.ok(corrected.length >= 2)
  for (const claim of corrected) {
    assert.ok(claim.submittedStatement.length > 10)
    assert.notEqual(claim.submittedStatement, claim.auditedStatement)
    assert.ok(claim.disagreements.length > 0, `${claim.claimId} records no disagreement`)
  }
})

test('every reviewer decision is internal-editorial and none claims external review', () => {
  for (const claim of DEMONSTRATION_DOSSIER.claims) {
    for (const decision of claim.reviewerDecisions) {
      assert.equal(decision.decidedBy, 'internal-editorial')
      assert.ok(decision.rationale.length > 10)
    }
  }
})

/* ------------------------------------------------------------ serialization -- */

test('an invalid dossier cannot be serialized', () => {
  const broken = clone(DEMONSTRATION_DOSSIER)
  broken.passages[0].locator = null
  assert.throws(() => serializeDossier(broken), /failed validation/i)
})

test('canonical serialization is byte-stable', () => {
  assert.equal(serializeDossierCanonical(DEMONSTRATION_DOSSIER), serializeDossierCanonical(clone(DEMONSTRATION_DOSSIER)))
  assert.ok(serializeDossier(DEMONSTRATION_DOSSIER).includes('"dossierId"'))
})

/* ------------------------------------------------------- example adjudication -- */

test('every Antigravity example claim was adjudicated and none was accepted', () => {
  const totals = exampleVerdictTotals()
  assert.equal(totals.accepted, 0)
  assert.ok(totals.rejected >= 6)
  for (const finding of ANTIGRAVITY_EXAMPLE_FINDINGS) {
    assert.ok(finding.finding.length > 60)
    assert.ok(finding.checkedAgainst.length > 10)
  }
  const refs = ANTIGRAVITY_EXAMPLE_FINDINGS.map((finding) => finding.ref).join(' ')
  assert.match(refs, /clm_01/)
  assert.match(refs, /clm_02/)
  assert.match(refs, /provenanceDigest/)
})

test('the rejected placeholder digest is recorded as a finding', () => {
  const finding = ANTIGRAVITY_EXAMPLE_FINDINGS.find((entry) => entry.ref === 'provenanceDigest')!
  assert.match(finding.submitted, new RegExp(EMPTY_PAYLOAD_SHA256))
  assert.equal(finding.verdict, 'rejected')
})

/* --------------------------------------------------------------- isolation -- */

test('the demonstration is absent from sitemap and llms.txt', () => {
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  const llms = readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8')
  for (const source of [sitemap, llms]) {
    assert.doesNotMatch(source, /evidence-dossier|dos_euv_resist_stochastics/)
  }
})

test('the demonstration page is noindex and read-only', () => {
  const page = readFileSync(new URL('../app/internal/evidence-dossier/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /index: false/)
  assert.doesNotMatch(page, /export async function (POST|PUT|PATCH|DELETE)/)
})

test('no write API route was added for dossiers', () => {
  const apiRoot = new URL('../app/api', import.meta.url).pathname
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? walk(path) : [path]
    })
  // Match the route path only. The absolute path can contain unrelated words.
  const dossierRoutes = walk(apiRoot)
    .map((path) => path.slice(apiRoot.length))
    .filter((route) => /dossier/i.test(route))
  assert.deepEqual(dossierRoutes, [])
})

test('the dossier does not interact with Q-BR-001..012', () => {
  const serialized = serializeDossier(DEMONSTRATION_DOSSIER)
  for (const candidate of QUANTUM_BRIDGE_CANDIDATES) {
    assert.ok(!serialized.includes(candidate.id), `${candidate.id} leaked into the dossier`)
  }
})

test('the frontier canary cohort is unchanged', () => {
  assert.equal(FRONTIER_CANARY_RECORDS.length, 40)
  assert.equal(FRONTIER_CANARY_CONTROL_RECORDS.length, 200)
})
