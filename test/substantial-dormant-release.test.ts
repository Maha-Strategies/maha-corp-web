import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { EXPERT_REVIEW_CRITERIA } from '../lib/epistemic-review.ts'
import {
  DORMANT_SUBSTANTIAL_RELEASE_CANARY_IDS,
  DORMANT_SUBSTANTIAL_RELEASE_PACKETS,
  DORMANT_SUBSTANTIAL_RELEASE_RECORD_IDS,
  DORMANT_SUBSTANTIAL_RELEASE_REMAINDER_IDS,
  dormantSubstantialReviewInputs,
} from '../lib/substantial-dormant-release.ts'

test('the dormant cohort is exactly four reviewed initial releases split one plus three', () => {
  assert.equal(DORMANT_SUBSTANTIAL_RELEASE_RECORD_IDS.length, 4)
  assert.equal(new Set(DORMANT_SUBSTANTIAL_RELEASE_RECORD_IDS).size, 4)
  assert.equal(DORMANT_SUBSTANTIAL_RELEASE_CANARY_IDS.length, 1)
  assert.equal(DORMANT_SUBSTANTIAL_RELEASE_REMAINDER_IDS.length, 3)
  assert.deepEqual(
    [...DORMANT_SUBSTANTIAL_RELEASE_CANARY_IDS, ...DORMANT_SUBSTANTIAL_RELEASE_REMAINDER_IDS],
    DORMANT_SUBSTANTIAL_RELEASE_RECORD_IDS,
  )
})

test('every dormant packet binds an eligible page and exact content-inspected revision', () => {
  assert.equal(DORMANT_SUBSTANTIAL_RELEASE_PACKETS.length, 4)
  for (const packet of DORMANT_SUBSTANTIAL_RELEASE_PACKETS) {
    assert.equal(packet.releaseKind, 'initial')
    assert.equal(packet.reviewerKind, 'internal-editorial')
    assert.equal(packet.assuranceTier, 'internally-reviewed-canonical')
    assert.deepEqual(packet.reviewScopes, Object.keys(EXPERT_REVIEW_CRITERIA).sort())
    assert.match(packet.targetSha256, /^sha256:[a-f0-9]{64}$/)
    assert.match(packet.packetDigest, /^sha256:[a-f0-9]{64}$/)
    assert.match(packet.contractDigest, /^sha256:[a-f0-9]{64}$/)
    assert.match(packet.pagePublicationDigest, /^sha256:[a-f0-9]{64}$/)
    assert.match(packet.packetFingerprint, /^sha256:[a-f0-9]{64}$/)
    assert.ok(packet.canonicalPath.startsWith('/knowledge/'))
  }
})

test('review replay is exact-revision, four-scope, internally labelled, and closed to other records', () => {
  const inputs = dormantSubstantialReviewInputs()
  assert.equal(inputs.length, 16)
  for (const packet of DORMANT_SUBSTANTIAL_RELEASE_PACKETS) {
    const decisions = inputs.filter((input) => input.recordId === packet.recordId)
    assert.equal(decisions.length, 4)
    assert.deepEqual(decisions.map((decision) => decision.scope).sort(), packet.reviewScopes)
    assert.ok(decisions.every((decision) => decision.targetSha256 === packet.targetSha256))
    assert.ok(decisions.every((decision) => decision.reviewer.reviewerKind === 'internal-editorial'))
    assert.ok(decisions.every((decision) => decision.idempotencyKey.startsWith('batch2-internal-remainder:')))
  }
  assert.throws(() => dormantSubstantialReviewInputs(['urn:maha:record:not-in-cohort']), /outside the frozen/)
})

test('the runner proves all-status absence, exact replay, readiness, and strict public projection', () => {
  const source = readFileSync(new URL('../scripts/run-substantial-dormant-release.ts', import.meta.url), 'utf8')
  for (const token of [
    'lineage-absent',
    'exact-active-replay',
    'registry counts do not reconcile',
    'candidate.ready !== true',
    'workspacePreflight',
    'active public lineage and release workspace disagree',
    'supersedesReleaseId: null',
    'Substantial reference',
    'No external reviewer participated',
    'canonical metadata',
    'TechArticle JSON-LD',
    'Public indexes are unavailable',
    'sitemap membership',
    'llms.txt membership',
    'setTimeout(resolve, 2_000)',
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(source, /operation:\s*'withdraw'/)
  const supersedesValues = [...source.matchAll(/supersedesReleaseId:\s*([^,\n]+)/g)].map((match) => match[1].trim())
  assert.deepEqual(supersedesValues, ['null'])
})

test('publication is manual, protected, cohort-confirmed, and cannot run from push or pull request', () => {
  const workflow = readFileSync(new URL('../.github/workflows/production-substantial-dormant-release.yml', import.meta.url), 'utf8')
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /environment: production-database/)
  assert.match(workflow, /cancel-in-progress: false/)
  assert.match(workflow, /RELEASE_1_DORMANT_SUBSTANTIAL_CANARY/)
  assert.match(workflow, /RELEASE_3_DORMANT_SUBSTANTIAL_REMAINDER/)
  assert.doesNotMatch(workflow, /^\s*(push|pull_request|schedule):/m)
})

test('dormant release evidence and credentials stay outside public route modules', () => {
  const publicSources = [
    readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8'),
    readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8'),
    readFileSync(new URL('../lib/substantial-page-public.ts', import.meta.url), 'utf8'),
  ].join('\n')
  assert.doesNotMatch(publicSources, /substantial-dormant-release|DORMANT_SUBSTANTIAL/)
  const operational = [
    readFileSync(new URL('../scripts/run-substantial-dormant-release.ts', import.meta.url), 'utf8'),
    readFileSync(new URL('../.github/workflows/production-substantial-dormant-release.yml', import.meta.url), 'utf8'),
  ].join('\n')
  assert.doesNotMatch(operational, /console\.log\([^)]*(TOKEN|token\()/)
})
