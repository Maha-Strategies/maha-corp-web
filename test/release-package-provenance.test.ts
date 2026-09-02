import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

import { candidateTargetDigest, recordRevisionDigest } from '../lib/digest-roles.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import pkg from '../content/source-cluster/production-release-package.json' with { type: 'json' }
import cohortReport from '../content/digest-reconciliation/cohort-reconciliation.json' with { type: 'json' }

const ROOT = resolve(import.meta.dirname, '..')
const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((r) => [r.id, r]))
const rows = [...pkg.canary.records, ...pkg.remainder.records] as { recordId: string; revisionSha256: string }[]

/**
 * What a frozen release package must be built from.
 *
 * The 33-record package satisfied every local check and still could not name a
 * single candidate in the workspace, because local page eligibility says
 * nothing about whether Production holds a reviewed target.
 */
const REQUIRED_PROVENANCE = [
  'production-workspace-target', 'target-bound-audit', 'target-bound-review-bundle',
  'current-lineage', 'successful-readiness-predicate',
] as const

test('the existing package carries record-revision digests, not workspace targets', () => {
  let revisionShaped = 0
  for (const row of rows) {
    const record = records.get(row.recordId)
    if (!record) continue
    assert.equal(row.revisionSha256, recordRevisionDigest(record))
    assert.notEqual(row.revisionSha256, candidateTargetDigest(record))
    revisionShaped++
  }
  assert.equal(revisionShaped, 33, 'every record in the package froze the wrong role')
})

test('the package cannot be called Production-ready from local inventory alone', () => {
  // Local eligibility is the only thing the package ever established.
  const provenance = new Set(Object.keys(pkg as Record<string, unknown>))
  for (const required of REQUIRED_PROVENANCE) {
    assert.ok(!provenance.has(required),
      `the package must not claim ${required}; it never observed one`)
  }
  // And the reconciliation must not have cleared any record for release.
  const remediations: Record<string, number> = cohortReport.remediations
  assert.equal(remediations['remain-blocked'], 33)
  assert.equal(remediations['recompute-package-target'], undefined)
})

test('a future package must declare all five provenance inputs', () => {
  assert.equal(REQUIRED_PROVENANCE.length, 5)
  assert.ok(REQUIRED_PROVENANCE.includes('production-workspace-target'))
  assert.ok(REQUIRED_PROVENANCE.includes('successful-readiness-predicate'))
})

test('no served page or client bundle carries a digest-reconciliation artifact', () => {
  // git grep exits 1 when nothing matches, which is the passing case here.
  let matches = ''
  try {
    matches = execFileSync('git', ['grep', '-l', '-E',
      'digest-reconciliation|cohort-reconciliation|workspace-readiness-report', '--', 'app', 'components'],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status !== 1) throw error
  }
  assert.equal(matches, '', 'diagnostic artifacts must stay out of served code')
})

test('the diagnostic artifacts carry no credential, identity, rationale or passage', () => {
  for (const file of ['workspace-readiness-report', 'cohort-reconciliation', 'digest-role-map']) {
    const blob = readFileSync(resolve(ROOT, `content/digest-reconciliation/${file}.json`), 'utf8')
    for (const pattern of [/bearer\s/i, /EPISTEMIC_[A-Z_]*TOKEN["':\s]+\S/, /reviewerId/i, /reviewerName/i,
      /inspectedContentLocation/i, /"passage"/i, /packetDigest/i]) {
      assert.ok(!pattern.test(blob), `${file} must not contain ${pattern}`)
    }
  }
})

test('nothing in this work claims a Production mutation', () => {
  assert.equal((cohortReport as { boundary: string }).boundary.includes('Read-only'), true)
  for (const record of cohortReport.records) assert.equal(record.activeReleaseState, 'none')
})
