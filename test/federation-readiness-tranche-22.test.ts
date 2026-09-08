import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  canonical, checkedIntegerArithmetic, compileAuditExport, digest,
  randomizedMeanContrast, rotateCartesianQuarterTurns, verifyLocator,
  verifyVersionRelationship,
} from '../lib/federation/readiness-tranche-22.ts'

const root = resolve(import.meta.dirname, '..')
const f = resolve(root, 'content/federation')
const read = (name: string) => JSON.parse(readFileSync(resolve(f, name), 'utf8'))
const cohort = read('federation-readiness-tranche-22-cohort-v1.json')
const decisions = read('federation-readiness-tranche-22-decisions-v1.json')
const fixtures = read('federation-readiness-tranche-22-gap-closure-fixtures-v1.json')
const policy = read('federation-scientific-evidence-policy-foundation-v1.json')
const products = read('federation-agent-governance-product-mapping-v1.json')
const sources = read('federation-readiness-tranche-22-source-inspections-v1.json')
const specs = read('federation-readiness-tranche-22-page-specifications-v1.json')
const ledgerV4 = read('federation-unified-readiness-ledger-v4.json')
const ledgerV5 = read('federation-unified-readiness-ledger-v5.json')
const priority = read('federation-readiness-recovery-priority-v1.json')
const t21 = read('federation-readiness-tranche-21-decisions-v1.json')

test('freezes all 27 revisions before exactly 73 untouched ledger-v4 candidates', () => {
  const carried = t21.decisions.filter((row: { decision: string }) => row.decision === 'revise').map((row: { candidateId: string }) => row.candidateId)
  const prior = new Set(t21.decisions.map((row: { candidateId: string }) => row.candidateId))
  const unresolved = new Set(ledgerV4.entries.filter((row: { implementationState: string }) => row.implementationState === 'unresolved').map((row: { candidateId: string }) => row.candidateId))
  const next = priority.priorities.filter((row: { candidateId: string }) => unresolved.has(row.candidateId) && !prior.has(row.candidateId)).slice(0, 73).map((row: { candidateId: string }) => row.candidateId)
  assert.deepEqual(cohort.counts, { candidates: 100, priorRevisionRequirements: 27, newUnreviewed: 73, distinctConcepts: 41 })
  assert.deepEqual(cohort.candidates.map((row: { candidateId: string }) => row.candidateId), [...carried, ...next])
  assert.equal(new Set(cohort.candidates.map((row: { candidateId: string }) => row.candidateId)).size, 100)
})

test('six reusable fixtures execute deterministically and refuse substitutions', () => {
  assert.deepEqual(checkedIntegerArithmetic('multiply', BigInt(7), BigInt(6), BigInt(100)), { result: BigInt(42), exact: true })
  assert.throws(() => checkedIntegerArithmetic('multiply', BigInt(7), BigInt(60), BigInt(100)), /result-out-of-range/)
  assert.deepEqual(rotateCartesianQuarterTurns(BigInt(3), BigInt(4), 1), { x: BigInt(-4), y: BigInt(3), normalizedQuarterTurns: 1 })
  assert.throws(() => rotateCartesianQuarterTurns(BigInt(1), BigInt(2), 0.5), /not-integer/)
  assert.deepEqual(randomizedMeanContrast([BigInt(1), BigInt(3)], [BigInt(4), BigInt(6)], true), { numerator: BigInt(12), denominator: BigInt(4), interpretation: 'randomized-sample-mean-contrast' })
  assert.throws(() => randomizedMeanContrast([BigInt(1)], [BigInt(2)], false), /not-declared/)
  const locator = { sourceId: 's', sourceRevision: 'r', kind: 'section' as const, value: '§2' }
  assert.equal(verifyLocator(locator, locator).verified, true)
  assert.throws(() => verifyLocator(locator, { ...locator, value: '§3' }), /value-mismatch/)
  const previous = { objectId: 'o', revisionDigest: 'sha256:a', predecessorDigest: null, relation: 'initial' as const }
  assert.deepEqual(verifyVersionRelationship(previous, { objectId: 'o', revisionDigest: 'sha256:b', predecessorDigest: 'sha256:a', relation: 'supersedes' }), { verified: true, transition: 'supersedes' })
  assert.throws(() => verifyVersionRelationship(previous, { objectId: 'o', revisionDigest: 'sha256:a', predecessorDigest: 'sha256:a', relation: 'supersedes' }), /revision-unchanged/)
  const rows = [{ eventId: 'b', eventType: 'b', subjectDigest: `sha256:${'b'.repeat(64)}`, occurredAt: '2026-09-07T00:00:02Z' }, { eventId: 'a', eventType: 'a', subjectDigest: `sha256:${'a'.repeat(64)}`, occurredAt: '2026-09-07T00:00:01Z' }]
  assert.deepEqual(compileAuditExport(rows).entries.map((row) => row.eventId), ['a', 'b'])
  assert.throws(() => compileAuditExport([rows[0], rows[0]]), /duplicate-event/)
  assert.equal(fixtures.syntheticOnly, true)
})

test('scientific evidence policy has authoritative foundations but no invented machine rule', () => {
  assert.equal(policy.sources.length, 3)
  assert.deepEqual(new Set(policy.sources.map((row: { kind: string }) => row.kind)), new Set(['official-authority']))
  assert.equal(policy.machineRule.state, 'blocked')
  assert.match(policy.machineRule.reason, /No inspected authority supplies a universal executable rule/)
  const machineRules = decisions.decisions.filter((row: { siteId: string; routeRole: string }) => row.siteId === 'maha-policy' && row.routeRole === 'machine-rule')
  assert.ok(machineRules.length > 0)
  assert.ok(machineRules.every((row: { decision: string }) => row.decision !== 'evidence-ready'))
})

test('only an exact existing capability maps one of five commercialization roles', () => {
  assert.deepEqual(products.counts, { roles: 5, mapped: 1, unsupported: 4 })
  assert.ok(products.mappings.every((row: { offerManufactured: boolean }) => row.offerManufactured === false))
  const mapped = products.mappings.filter((row: { mapping: string }) => row.mapping === 'real-product-capability')
  assert.equal(mapped[0].conceptId, 'urn:maha:concept:authority:context-budgeting')
  assert.deepEqual(mapped[0].sourceIds, ['t22-context-compression-offer'])
  const commercialDecisions = decisions.decisions.filter((row: { routeRole: string }) => row.routeRole === 'commercialization')
  assert.equal(commercialDecisions.filter((row: { decision: string }) => row.decision === 'evidence-ready').length, 1)
})

test('all 100 receive an exact six-axis decision and only ready candidates receive specifications', () => {
  assert.deepEqual(decisions.counts, { candidates: 100, evidenceReady: 66, revise: 24, blocked: 10 })
  assert.deepEqual(specs.counts, { specifications: 66, boundedQuestions: 330 })
  const ready = decisions.decisions.filter((row: { decision: string }) => row.decision === 'evidence-ready').map((row: { candidateId: string }) => row.candidateId).sort()
  assert.deepEqual(specs.specifications.map((row: { candidateId: string }) => row.candidateId).sort(), ready)
  for (const row of decisions.decisions) {
    assert.deepEqual(Object.keys(row.axes).sort(), ['boundary', 'dependency', 'locator', 'rights', 'scope', 'sourceIdentity'].sort())
    assert.equal(row.activeBindingChanged, false)
    assert.equal(row.sourceAssessment.roleSupported, row.decision === 'evidence-ready')
    if (row.decision === 'evidence-ready') {
      assert.ok(row.dependency.canonicalOwner)
      assert.ok(row.dependency.authorityBoundary)
      assert.ok(row.dependency.typedRelationships.length >= 3)
      assert.ok(row.sourceAssessment.applicationSourceIds.length > 0)
      assert.ok(row.sourceAssessment.locators.length > 0)
    }
  }
  assert.ok(specs.specifications.every((row: { publicRouteCreated: boolean; implementationState: string }) => !row.publicRouteCreated && row.implementationState === 'specification-only'))
})

test('every local source locator resolves to its named source symbol', () => {
  for (const row of sources.inspections.filter((item: { kind: string }) => item.kind !== 'official-authority')) {
    const segments = row.locator.split(' and ')
    let currentPath = ''
    for (const segment of segments) {
      const split = segment.split(' — ')
      if (split.length === 2) currentPath = split[0]
      const symbol = split.length === 2 ? split[1] : split[0]
      assert.ok(currentPath && existsSync(resolve(root, currentPath)), row.locator)
      assert.ok(readFileSync(resolve(root, currentPath), 'utf8').includes(symbol), row.locator)
    }
  }
})

test('ledger v5 closes 66 of 348 unresolved routes and preserves untouched entries', () => {
  assert.deepEqual(ledgerV5.counts, { routeCandidates: 1628, implementationReady: 1346, unresolved: 282, newlyReadyThisTranche: 66 })
  const reviewed = new Set(decisions.decisions.map((row: { candidateId: string }) => row.candidateId))
  for (const entry of ledgerV5.entries) {
    const prior = ledgerV4.entries.find((row: { candidateId: string }) => row.candidateId === entry.candidateId)
    assert.ok(prior)
    if (!reviewed.has(entry.candidateId)) assert.deepEqual(entry, prior)
  }
})

test('artifacts authenticate, regenerate byte-identically, and remain local and private', () => {
  const names = [
    'federation-readiness-tranche-22-cohort-v1.json', 'federation-readiness-tranche-22-gap-closure-fixtures-v1.json',
    'federation-scientific-evidence-policy-foundation-v1.json', 'federation-agent-governance-product-mapping-v1.json',
    'federation-readiness-tranche-22-source-inspections-v1.json', 'federation-readiness-tranche-22-decisions-v1.json',
    'federation-readiness-tranche-22-page-specifications-v1.json', 'federation-unified-readiness-ledger-v5.json',
  ]
  const before = names.map((name) => readFileSync(resolve(f, name), 'utf8'))
  for (const name of names) {
    const value = read(name)
    const { provenanceDigest, ...body } = value
    assert.equal(provenanceDigest, digest(body), name)
    const serialized = JSON.stringify(value)
    for (const forbidden of ['passageText', 'fullText', 'sourceExcerpt', 'credentialValue', 'customerSubmission', 'reviewerIdentity', '/private/']) assert.equal(serialized.includes(forbidden), false, `${name}:${forbidden}`)
  }
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-readiness-tranche-22.ts'], { cwd: root })
  assert.deepEqual(names.map((name) => readFileSync(resolve(f, name), 'utf8')), before)
  assert.deepEqual(cohort.execution, { publicRoutesGenerated: 0, buildRun: false, deployed: false })
  assert.deepEqual(ledgerV5.execution, { publicRoutesGenerated: 0, buildRun: false, sitemapChanged: false, llmsChanged: false, released: 0, deployed: false })
  assert.equal(canonical({ b: 2, a: 1 }), canonical({ a: 1, b: 2 }))
})
