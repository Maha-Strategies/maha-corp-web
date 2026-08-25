import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  DOSSIER_REVIEW_STATES,
  EPISTEMIC_STATUSES,
  REPLICATED_EMPIRICAL,
  isLegalReviewTransition,
  SOURCE_RELATIONS,
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
  // v0.1 shipped 8 bounded claims; v0.2 adds four from a second inspected source.
  assert.ok(DEMONSTRATION_DOSSIER.claims.length >= 8 && DEMONSTRATION_DOSSIER.claims.length <= 14)
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

test('the example audit states unverifiability, not nonexistence', () => {
  // Absence from the indexes searched is not proof that no related publication
  // exists. The findings must claim only what the checks establish.
  const overclaim =
    /\b(fabricated|does not exist|do not exist|never existed|no such (paper|document|publication) exists|cannot have been read)\b/i
  for (const finding of ANTIGRAVITY_EXAMPLE_FINDINGS) {
    assert.doesNotMatch(finding.finding, overclaim, `${finding.ref} asserts more than the checks establish`)
  }

  const doiFindings = ANTIGRAVITY_EXAMPLE_FINDINGS.filter((entry) => /DOI$/.test(entry.ref))
  assert.equal(doiFindings.length, 2)
  for (const finding of doiFindings) {
    assert.match(finding.finding, /unregistered/i, 'must state the identifier is unregistered')
    assert.match(finding.finding, /Crossref/i, 'must state no matching Crossref record was located')
    assert.match(finding.finding, /could not be authenticated/i, 'must state the passage could not be authenticated')
    assert.match(finding.finding, /unverifiable/i, 'must state the submitted claim is unverifiable')
  }
  // At least one finding must explicitly preserve the alternative.
  assert.ok(
    doiFindings.some((finding) => /different (identifier|metadata)/i.test(finding.finding)),
    'the possibility of a publication under different metadata must be preserved',
  )
})

test('the demonstration header does not assert the cited documents are absent', () => {
  const source = readFileSync(new URL('../lib/evidence-dossier/demonstration.ts', import.meta.url), 'utf8')
  const header = source.slice(0, source.indexOf('const NIST_URL'))
  assert.doesNotMatch(header, /fabricated|could not have been read|do(es)? not exist/i)
  assert.match(header, /could not be authenticated/i)
})

/* ------------------------------------------------------------------ v0.2 -- */

test('v0.2 carries two directly inspected sources', () => {
  const inspected = DEMONSTRATION_DOSSIER.sources.filter(
    (source) => source.verificationState === 'document-inspected',
  )
  assert.equal(inspected.length, 2)
  for (const source of inspected) {
    assert.ok(source.identifier, `${source.sourceId} has no identifier`)
    assert.ok(source.rightsBasis.length > 5)
    assert.ok(source.verifiedAt)
    assert.match(source.metadataProvenance, /inspected|read directly/i)
  }
})

test('every passage from an inspected source carries an exact locator', () => {
  for (const passage of DEMONSTRATION_DOSSIER.passages) {
    assert.ok(passage.locator && passage.locator.trim().length > 5, `${passage.passageId} lacks a locator`)
    assert.ok(passage.originalDocumentInspected)
    assert.match(passage.passageHash, /^sha256:[a-f0-9]{64}$/)
  }
})

test('the comparison covers the required axes and states its limits', () => {
  assert.equal(DEMONSTRATION_DOSSIER.comparisons.length, 1)
  const comparison = DEMONSTRATION_DOSSIER.comparisons[0]
  const axes = comparison.axes.map((axis) => axis.axis.toLowerCase()).join(' ')
  for (const required of ['dimensionality', 'model class', 'statistical', 'material model', 'exposure', 'outputs']) {
    assert.ok(axes.includes(required), `comparison is missing the ${required} axis`)
  }
  assert.ok(comparison.comparabilityLimits.length >= 3)
  assert.ok(comparison.agreements.length >= 1)
  assert.ok(comparison.relationRationale.length > 100)
})

test('the relation is one of the four declared classifications', () => {
  const comparison = DEMONSTRATION_DOSSIER.comparisons[0]
  assert.ok(SOURCE_RELATIONS.includes(comparison.relation))
  // Two simulations with different state representations are not corroborating.
  assert.equal(comparison.relation, 'materially-different-assumptions')
})

test('a comparison of modelling sources cannot be described as replication', () => {
  const comparison = DEMONSTRATION_DOSSIER.comparisons[0]
  assert.match(comparison.replicationAssessment, /not replication/i)
  assert.match(comparison.replicationAssessment, /simulation/i)

  const broken = clone(DEMONSTRATION_DOSSIER)
  broken.comparisons[0].relationRationale = 'The second source replicates the first.'
  assert.ok(validateDossier(broken).some((issue) => issue.code === 'comparison-claims-replication'))
})

test('a comparison may only cite inspected sources', () => {
  const broken = clone(DEMONSTRATION_DOSSIER)
  broken.comparisons[0].sourceIds = [...broken.comparisons[0].sourceIds, 'src_park_2023']
  assert.ok(validateDossier(broken).some((issue) => issue.code === 'comparison-source-not-inspected'))
})

test('no claim anywhere is replicated-empirical', () => {
  for (const claim of DEMONSTRATION_DOSSIER.claims) {
    assert.notEqual(claim.epistemicStatus, REPLICATED_EMPIRICAL)
  }
})

test('the dossier stays an illustrative draft', () => {
  assert.equal(DEMONSTRATION_DOSSIER.reviewState, 'illustrative-draft')
})

test('the v0.1 revision is preserved immutably with its original digest', () => {
  const prior = DEMONSTRATION_DOSSIER.priorRevisions
  assert.equal(prior.length, 1)
  assert.equal(prior[0].version, 'maha-evidence-dossier/0.1')
  assert.equal(
    prior[0].dossierDigest,
    'sha256:4479a411c4ff854bcb1fb5507f81d47b4fd2065d3c27e0ff41c6b43f657e13b9',
  )
  assert.ok(prior[0].summary.length > 60)
  // The current digest must differ, since content changed.
  assert.notEqual(DEMONSTRATION_DOSSIER.provenanceBundle.dossierDigest, prior[0].dossierDigest)
})

test('every v0.1 claim survives into v0.2', () => {
  const ids = DEMONSTRATION_DOSSIER.claims.map((claim) => claim.claimId)
  for (const original of [
    'clm_rls_tradeoff',
    'clm_photon_energy',
    'clm_acid_shot_noise',
    'clm_poisson_model',
    'clm_figure_conditions',
    'clm_2d_reduction',
    'clm_parameter_space',
    'clm_photoacid_descriptors',
  ]) {
    assert.ok(ids.includes(original), `${original} was dropped rather than qualified`)
  }
})

test('the second source qualifies rather than deletes the v0.1 RLS claim', () => {
  const qualifier = DEMONSTRATION_DOSSIER.claims.find((claim) => claim.claimId === 'clm_hh_rls_caution')!
  assert.match(qualifier.verificationScope, /clm_rls_tradeoff/)
  assert.ok(qualifier.disagreements.length >= 1)
  assert.ok(DEMONSTRATION_DOSSIER.claims.some((claim) => claim.claimId === 'clm_rls_tradeoff'))
})

test('every digest was recomputed and none collides', () => {
  const digests = [
    DEMONSTRATION_DOSSIER.provenanceBundle.dossierDigest,
    ...DEMONSTRATION_DOSSIER.claims.map((claim) => claim.provenanceDigest),
    ...DEMONSTRATION_DOSSIER.comparisons.map((comparison) => comparison.provenanceDigest),
  ]
  assert.equal(new Set(digests).size, digests.length)
  for (const digest of digests) assert.ok(!isPlaceholderDigest(digest))
})

test('the search record documents databases, queries, rejections and access failures', () => {
  const log = JSON.parse(
    readFileSync(new URL('../content/bridges/evidence-dossier-v0-2-search-log.json', import.meta.url), 'utf8'),
  )
  assert.ok(log.databases.length >= 3)
  for (const database of log.databases) assert.ok(database.queries.length >= 1)
  assert.ok(log.candidatesConsidered.length >= 3)
  for (const candidate of log.candidatesConsidered) assert.ok(candidate.reason.length > 40)
  assert.ok(log.accessFailures.length >= 2)
  assert.ok(log.stopCondition.length > 20)
})

test('the page title tracks the dossier revision rather than a hardcoded version', () => {
  const page = readFileSync(new URL('../app/internal/evidence-dossier/page.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(page, /Evidence Dossier v0\.\d \(draft/, 'the version must not be hardcoded in the title')
  assert.match(page, /corpusRevision/)
})
