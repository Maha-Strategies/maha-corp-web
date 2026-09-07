import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  APPLICATION_SOURCES, FEDERATED_COMMERCIALIZATION_CONCEPTS, OFFER_LAYERS,
  boundedMinimum, cancellationFixture, classifyLiterature, combineDimensions,
  digest, errorBudget, linearInterpolate, trapezoidIntegral,
} from '../lib/federation/readiness-tranche-21.ts'

const root = resolve(import.meta.dirname, '..')
const f = resolve(root, 'content/federation')
const read = (name: string) => JSON.parse(readFileSync(resolve(f, name), 'utf8'))
const cohort = read('federation-readiness-tranche-21-cohort-v1.json')
const fixtures = read('federation-readiness-tranche-21-gap-closure-fixtures-v1.json')
const offers = read('federation-readiness-tranche-21-offer-reconciliation-v1.json')
const sources = read('federation-readiness-tranche-21-source-inspections-v1.json')
const decisions = read('federation-readiness-tranche-21-decisions-v1.json')
const specs = read('federation-readiness-tranche-21-page-specifications-v1.json')
const ledgerV3 = read('federation-unified-readiness-ledger-v3.json')
const ledgerV4 = read('federation-unified-readiness-ledger-v4.json')
const priority = read('federation-readiness-recovery-priority-v1.json')
const tranche20 = read('federation-readiness-tranche-20-decisions-v1.json')

test('freezes 71 carried revisions before 29 untouched unresolved candidates', () => {
  const revisions = tranche20.decisions.filter((row: { decision: string }) => row.decision === 'revise').map((row: { candidateId: string }) => row.candidateId)
  const previous = new Set(tranche20.decisions.map((row: { candidateId: string }) => row.candidateId))
  const unresolved = new Set(ledgerV3.entries.filter((row: { implementationState: string }) => row.implementationState === 'unresolved').map((row: { candidateId: string }) => row.candidateId))
  const next = priority.priorities.filter((row: { candidateId: string }) => unresolved.has(row.candidateId) && !previous.has(row.candidateId)).slice(0, 29).map((row: { candidateId: string }) => row.candidateId)
  assert.deepEqual(cohort.counts, { candidates: 100, priorRevisionRequirements: 71, newUnreviewed: 29, distinctConcepts: 51 })
  assert.deepEqual(cohort.candidates.map((row: { candidateId: string }) => row.candidateId), [...revisions, ...next])
  assert.equal(new Set(cohort.candidates.map((row: { candidateId: string }) => row.candidateId)).size, 100)
})

test('reconciles four distinct offer layers without changing commercial state', () => {
  assert.deepEqual(OFFER_LAYERS.map((row) => [row.offerId, row.priceUsd, row.acquisitionState]), [
    ['free-evidence-preflight', 0, 'available-free'],
    ['mps-document-preflight', 49, 'self-service-checkout'],
    ['verified-evidence-dossier', 250, 'informational-purchase-disabled'],
    ['bespoke-dossier-paid-pilot', 5_000, 'contracted-paid-pilot-only'],
  ])
  assert.deepEqual(offers.mutation, { checkoutChanged: false, availabilityChanged: false, priceChanged: false, refundTermsChanged: false, privacyTermsChanged: false, deliveryTermsChanged: false })
  assert.match(offers.finding, /four distinct scopes/)
  const commercial = decisions.decisions.filter((row: { routeRole: string }) => row.routeRole === 'commercial-use')
  assert.ok(commercial.length > 10)
  assert.ok(commercial.every((row: { decision: string; sourceAssessment: { applicationSourceIds: string[] } }) => row.decision === 'evidence-ready' && row.sourceAssessment.applicationSourceIds.includes('t21-offer-layers')))
})

test('commercialization is allowed only for concepts projected by the current product federation', () => {
  const rows = decisions.decisions.filter((row: { routeRole: string }) => row.routeRole === 'commercialization')
  assert.equal(rows.filter((row: { decision: string }) => row.decision === 'evidence-ready').length, FEDERATED_COMMERCIALIZATION_CONCEPTS.size)
  for (const row of rows) assert.equal(row.decision === 'evidence-ready', FEDERATED_COMMERCIALIZATION_CONCEPTS.has(row.conceptId))
  assert.equal(rows.find((row: { conceptId: string }) => row.conceptId.endsWith(':context-budgeting')).decision, 'revise')
  assert.equal(rows.find((row: { conceptId: string }) => row.conceptId.endsWith(':cross-agent-delegation')).decision, 'revise')
})

test('exact arithmetic fixtures are deterministic and fail closed', () => {
  assert.deepEqual(linearInterpolate(BigInt(0), BigInt(10), BigInt(4), BigInt(18), BigInt(1)), { numerator: BigInt(12), denominator: BigInt(1) })
  assert.throws(() => linearInterpolate(BigInt(0), BigInt(1), BigInt(0), BigInt(2), BigInt(0)), /nodes-not-distinct/)
  assert.throws(() => linearInterpolate(BigInt(0), BigInt(1), BigInt(2), BigInt(2), BigInt(3)), /extrapolation-refused/)
  assert.deepEqual(trapezoidIntegral(BigInt(1), [BigInt(0), BigInt(1), BigInt(4)]), { numerator: BigInt(3), denominator: BigInt(1) })
  assert.throws(() => trapezoidIntegral(BigInt(0), [BigInt(0), BigInt(1)]), /spacing-not-positive/)
  assert.deepEqual(boundedMinimum([BigInt(9), BigInt(4), BigInt(4), BigInt(7)]), { index: 1, value: BigInt(4) })
  assert.throws(() => boundedMinimum([]), /empty-domain/)
  assert.deepEqual(combineDimensions([1, 0, -1, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0], 'multiply'), [1, 0, 0, 0, 0, 0, 0])
  assert.deepEqual(errorBudget([BigInt(3), BigInt(4)]), { sumOfSquares: BigInt(25) })
  assert.throws(() => errorBudget([BigInt(1), BigInt(-1)]), /invalid-error-budget/)
  assert.deepEqual(cancellationFixture(), { floating: 0, exactInteger: BigInt(1), precisionLost: true })
})

test('conflicting-literature fixture preserves comparison scope and refusal states', () => {
  const base = [
    { observationId: 'a', normalizedClaimId: 'claim', direction: 'supports' as const, population: 'p', outcome: 'o', sourceId: 's1', exactLocator: '§1' },
    { observationId: 'b', normalizedClaimId: 'claim', direction: 'opposes' as const, population: 'p', outcome: 'o', sourceId: 's2', exactLocator: '§2' },
    { observationId: 'c', normalizedClaimId: 'claim', direction: 'opposes' as const, population: 'other', outcome: 'o', sourceId: 's3', exactLocator: '§3' },
  ]
  assert.deepEqual(classifyLiterature(base), { state: 'conflict-observed', observationIds: ['a', 'b'] })
  assert.throws(() => classifyLiterature(base.slice(0, 1)), /at-least-two/)
  assert.throws(() => classifyLiterature([base[0], { ...base[1], observationId: 'a' }]), /duplicate/)
  assert.throws(() => classifyLiterature([base[0], { ...base[1], normalizedClaimId: 'substitute' }]), /claim-substitution/)
  assert.throws(() => classifyLiterature([base[0], { ...base[1], exactLocator: '' }]), /unlocated/)
  assert.equal(fixtures.graphRevision.canonicalBindingChanged, false)
  assert.equal(fixtures.syntheticOnly, true)
})

test('computation readiness requires both an accepted authority binding and an exact application fixture', () => {
  const computation = decisions.decisions.filter((row: { conceptId: string }) => row.conceptId.startsWith('urn:maha:concept:computation:'))
  for (const row of computation.filter((item: { decision: string }) => item.decision === 'evidence-ready')) {
    assert.ok(row.dependency.acceptedAuthorityBinding, row.candidateId)
    assert.ok(row.sourceAssessment.applicationSourceIds.length > 0, row.candidateId)
    assert.ok(row.sourceAssessment.prerequisiteSourceIds.length > 0, row.candidateId)
    assert.ok((APPLICATION_SOURCES[row.conceptId] ?? []).some((source) => source.roles.includes(row.routeRole)), row.candidateId)
  }
  for (const suffix of ['reference-frame-conversion', 'deterministic-arithmetic', 'causal-inference']) {
    assert.ok(computation.filter((row: { conceptId: string }) => row.conceptId.endsWith(`:${suffix}`)).every((row: { decision: string }) => row.decision === 'revise'))
  }
})

test('policy decisions are role-specific and never manufacture machine rules', () => {
  const policy = decisions.decisions.filter((row: { siteId: string }) => row.siteId === 'maha-policy')
  assert.equal(policy.filter((row: { decision: string }) => row.decision === 'evidence-ready').length, 20)
  assert.ok(policy.filter((row: { routeRole: string }) => row.routeRole === 'machine-rule').every((row: { decision: string }) => row.decision !== 'evidence-ready'))
  assert.equal(policy.filter((row: { decision: string }) => row.decision === 'blocked').length, 3)
  assert.ok(policy.filter((row: { decision: string }) => row.decision === 'blocked').every((row: { conceptId: string }) => row.conceptId.endsWith(':scientific-evidence-policy')))
})

test('issues an exhaustive 70/27/3 partition and specifications only for ready candidates', () => {
  assert.deepEqual(decisions.counts, { candidates: 100, evidenceReady: 70, revise: 27, blocked: 3 })
  assert.deepEqual(specs.counts, { specifications: 70, boundedQuestions: 350 })
  const ready = decisions.decisions.filter((row: { decision: string }) => row.decision === 'evidence-ready').map((row: { candidateId: string }) => row.candidateId).sort()
  assert.deepEqual(specs.specifications.map((row: { candidateId: string }) => row.candidateId).sort(), ready)
  for (const row of decisions.decisions) {
    assert.equal(row.activeBindingChanged, false)
    assert.equal(row.decision === 'evidence-ready', row.sourceAssessment.roleSupported)
  }
  for (const spec of specs.specifications) {
    assert.equal(spec.publicRouteCreated, false)
    assert.equal(spec.implementationState, 'specification-only')
    assert.ok(spec.sourceBindings.length > 0)
  }
})

test('all local source locators resolve to every named symbol', () => {
  for (const row of sources.inspections.filter((item: { kind: string }) => item.kind !== 'official-authority')) {
    const [path, names] = row.locator.split(' — ')
    assert.equal(existsSync(resolve(root, path)), true, path)
    const text = readFileSync(resolve(root, path), 'utf8')
    for (const name of names.split(' and ')) assert.ok(text.includes(name), row.locator)
  }
})

test('ledger v4 advances only reviewed ready candidates and preserves all 1,628 routes', () => {
  assert.deepEqual(ledgerV4.counts, { routeCandidates: 1628, implementationReady: 1280, unresolved: 348, newlyReadyThisTranche: 70 })
  const reviewed = new Set(decisions.decisions.map((row: { candidateId: string }) => row.candidateId))
  for (const entry of ledgerV4.entries) {
    const prior = ledgerV3.entries.find((row: { candidateId: string }) => row.candidateId === entry.candidateId)
    assert.ok(prior)
    if (!reviewed.has(entry.candidateId)) assert.deepEqual(entry, prior)
  }
})

test('artifacts authenticate their bodies, regenerate byte-identically, and expose no public route', () => {
  const names = [
    'federation-readiness-tranche-21-cohort-v1.json', 'federation-readiness-tranche-21-gap-closure-fixtures-v1.json',
    'federation-readiness-tranche-21-offer-reconciliation-v1.json', 'federation-readiness-tranche-21-source-inspections-v1.json',
    'federation-readiness-tranche-21-decisions-v1.json', 'federation-readiness-tranche-21-page-specifications-v1.json',
    'federation-unified-readiness-ledger-v4.json',
  ]
  for (const name of names) {
    const value = read(name)
    const { provenanceDigest, ...body } = value
    assert.equal(provenanceDigest, digest(body), name)
    const serialized = JSON.stringify(value)
    for (const forbidden of ['passageText', 'fullText', 'sourceExcerpt', 'credentialValue', 'customerSubmission', 'reviewerIdentity']) assert.equal(serialized.includes(forbidden), false, `${name}:${forbidden}`)
    assert.equal(serialized.includes('/private/'), false, `${name}:absolute-path`)
  }
  const before = names.map((name) => readFileSync(resolve(f, name), 'utf8'))
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-readiness-tranche-21.ts'], { cwd: root })
  assert.deepEqual(names.map((name) => readFileSync(resolve(f, name), 'utf8')), before)
  assert.deepEqual(cohort.execution, { publicRoutesGenerated: 0, buildRun: false, deployed: false })
  assert.deepEqual(ledgerV4.execution, { publicRoutesGenerated: 0, buildRun: false, sitemapChanged: false, llmsChanged: false, released: 0, deployed: false })
})
