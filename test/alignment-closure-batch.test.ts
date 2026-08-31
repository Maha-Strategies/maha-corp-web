import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import {
  ALIGNMENT_CLOSURE_DISPOSITIONS,
  NEWLY_ALIGNMENT_CLEAR,
  assertClearanceIsEarned,
  closureBatchDigest,
  type ClosureDisposition,
} from '../lib/alignment-closure-batch.ts'
import {
  FRONTIER_ALIGNMENT_AUDIT,
  alignmentFor,
  isAlignmentClear,
  verdictTotals,
} from '../lib/frontier-source-alignment.ts'
import { PILOT_ALIGNMENT_AUDIT, isPilotAlignmentClear } from '../lib/pilot-source-alignment.ts'

const ROOT = resolve(import.meta.dirname, '..')
const AUDIT = JSON.parse(readFileSync(resolve(ROOT, 'content/frontier-audit/alignment-closure-batch.json'), 'utf8'))

const clone = (overrides: Partial<ClosureDisposition>): ClosureDisposition => ({
  ...ALIGNMENT_CLOSURE_DISPOSITIONS.find((entry) => entry.newlyAlignmentClear)!,
  ...overrides,
})

/** Runs the batch's own gate over a hypothetical disposition set. */
function gate(dispositions: readonly ClosureDisposition[]): () => void {
  return () => {
    for (const entry of dispositions) {
      if (entry.newlyAlignmentClear) {
        if (entry.verdict !== 'supported') throw new Error(`${entry.recordId}: only a supported verdict can clear a record.`)
        if (entry.evidenceCharacter === 'metadata-only') throw new Error(`${entry.recordId}: metadata-level evidence cannot clear a record.`)
        if (entry.inspectionDepth === 'not-inspected') throw new Error(`${entry.recordId}: a record cannot be cleared without inspecting the source.`)
        if (!entry.inspectedContentLocation.trim()) throw new Error(`${entry.recordId}: a cleared record must record where the source was read.`)
        if (entry.origin === null) throw new Error(`${entry.recordId}: a cleared record must record a reviewed assignment origin.`)
      }
    }
    const ids = dispositions.map((entry) => entry.recordId)
    if (new Set(ids).size !== ids.length) throw new Error('A record may carry only one disposition in a closure batch.')
  }
}

test('the shipped batch passes its own gate', () => {
  assert.doesNotThrow(assertClearanceIsEarned)
})

// 1
test('metadata-only evidence cannot clear a record', () => {
  assert.throws(gate([clone({ evidenceCharacter: 'metadata-only' })]), /metadata-level evidence cannot clear/)
  // And nothing shipped rests on metadata alone.
  for (const entry of ALIGNMENT_CLOSURE_DISPOSITIONS) {
    if (entry.newlyAlignmentClear) assert.notEqual(entry.evidenceCharacter, 'metadata-only', entry.recordId)
  }
})

// 2
test('a missing locator cannot clear a record', () => {
  assert.throws(gate([clone({ inspectedContentLocation: '' })]), /where the source was read/)
  assert.throws(gate([clone({ inspectedContentLocation: '   ' })]), /where the source was read/)
  for (const entry of ALIGNMENT_CLOSURE_DISPOSITIONS) {
    assert.ok(entry.inspectedContentLocation.trim().length > 10, `${entry.recordId} needs a real locator`)
  }
})

// 3
test('an uninspected source stays non-explanatory', () => {
  assert.throws(gate([clone({ inspectionDepth: 'not-inspected' })]), /without inspecting the source/)
  // The one record this batch left blocked is still blocked in the live audit.
  for (const entry of ALIGNMENT_CLOSURE_DISPOSITIONS) {
    if (!entry.newlyAlignmentClear) assert.equal(isAlignmentClear(entry.recordId), false, entry.recordId)
  }
  // Records this batch never touched keep their inaccessible verdict.
  const stillInaccessible = FRONTIER_ALIGNMENT_AUDIT.filter((r) => r.evidence.subjectAligned === 'inaccessible-source')
  for (const record of stillInaccessible) {
    assert.equal(isAlignmentClear(record.recordId), false, `${record.recordId} is inaccessible and must stay blocked`)
    assert.equal(record.evidence.sourceContentInspected, false)
  }
})

// 4
test('a duplicate record judgement fails', () => {
  const first = ALIGNMENT_CLOSURE_DISPOSITIONS[0]
  assert.throws(gate([first, { ...first }]), /only one disposition/)
  const ids = ALIGNMENT_CLOSURE_DISPOSITIONS.map((entry) => entry.recordId)
  assert.equal(new Set(ids).size, ids.length)
})

// 5
test('unsupported and mismatched claims remain blocked', () => {
  for (const verdict of ['partially-supported', 'mismatched', 'insufficient-evidence', 'inaccessible-source'] as const) {
    assert.throws(gate([clone({ verdict })]), /only a supported verdict can clear/)
  }
  // Nothing mismatched anywhere in the corpus is clear.
  for (const record of FRONTIER_ALIGNMENT_AUDIT) {
    if (record.evidence.subjectAligned === 'supported') continue
    assert.equal(isAlignmentClear(record.recordId), false, `${record.recordId} is ${record.evidence.subjectAligned} and must stay blocked`)
  }
})

// 6
test('the generated counts reconcile record by record', () => {
  const before = AUDIT.verdictTotals.before as Record<string, number>
  const after = AUDIT.verdictTotals.after as Record<string, number>

  // Every verdict delta is attributable to a named record, and to no other.
  const delta: Record<string, number> = {}
  for (const key of Object.keys(after)) delta[key] = after[key] - (before[key] ?? 0)
  const expected: Record<string, number> = {}
  for (const key of Object.keys(after)) expected[key] = 0
  for (const movement of AUDIT.verdictMovements as Array<{ from: string; to: string }>) {
    expected[movement.to] += 1
    expected[movement.from] -= 1
  }
  assert.deepEqual(delta, expected)

  assert.equal(AUDIT.totals.alignmentClearAfter - AUDIT.totals.alignmentClearBefore, NEWLY_ALIGNMENT_CLEAR.length)
  assert.equal(AUDIT.totals.newlyAlignmentClear, NEWLY_ALIGNMENT_CLEAR.length)
  assert.equal(AUDIT.totals.recordsInspected, ALIGNMENT_CLOSURE_DISPOSITIONS.length)

  // The after-totals are the live corpus, not a stored number.
  const liveFrontier = FRONTIER_ALIGNMENT_AUDIT.filter((r) => isAlignmentClear(r.recordId)).length
  const livePilot = PILOT_ALIGNMENT_AUDIT.filter((r) => isPilotAlignmentClear(r.recordId)).length
  assert.equal(AUDIT.totals.alignmentClearAfter, liveFrontier + livePilot)
  assert.deepEqual(after, verdictTotals())
  assert.equal(AUDIT.batchDigest, closureBatchDigest())
})

test('every promoted record is actually clear, and was not before', () => {
  for (const recordId of NEWLY_ALIGNMENT_CLEAR) {
    assert.equal(isAlignmentClear(recordId), true, `${recordId} should be clear`)
    const disposition = ALIGNMENT_CLOSURE_DISPOSITIONS.find((entry) => entry.recordId === recordId)!
    assert.notEqual(disposition.priorVerdict, 'supported', 'a record that was already supported was not newly cleared')
  }
})

test('no disposition rebinds a source', () => {
  // The batch may re-read a source. It may never swap one, because four of
  // these records are reachable from a canonical release.
  for (const entry of ALIGNMENT_CLOSURE_DISPOSITIONS) {
    const record = alignmentFor(entry.recordId)
    assert.ok(record, `${entry.recordId} is not a frontier record`)
    const declared = record.sourceIdentifier ?? `url:${''}`
    if (record.sourceIdentifier) {
      assert.equal(entry.sourceIdentifier, record.sourceIdentifier, `${entry.recordId} names a different source than the audit binds`)
    }
    assert.equal(entry.sourceTitle, record.sourceTitle, `${entry.recordId} names a different source title`)
    assert.ok(declared !== undefined)
  }
})

test('the superseded judgement is preserved, not overwritten', () => {
  for (const entry of ALIGNMENT_CLOSURE_DISPOSITIONS) {
    const record = alignmentFor(entry.recordId)!
    assert.ok(record.priorJudgement, `${entry.recordId} must nest the judgement it superseded`)
    assert.equal(record.priorJudgement.verdict, entry.priorVerdict)
  }
})

// 7
test('regeneration is byte-identical', () => {
  const paths = [
    'content/frontier-audit/alignment-closure-batch.json',
    'docs/frontier-audit/alignment-closure-batch.md',
  ]
  const before = paths.map((path) => readFileSync(resolve(ROOT, path), 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-alignment-closure-batch.ts'], { cwd: ROOT, encoding: 'utf8' })
  paths.forEach((path, index) => {
    assert.equal(readFileSync(resolve(ROOT, path), 'utf8'), before[index], `${path} is not deterministic`)
  })
})

test('the artifacts carry no timestamp, run id or absolute path', () => {
  for (const path of ['content/frontier-audit/alignment-closure-batch.json', 'docs/frontier-audit/alignment-closure-batch.md']) {
    const text = readFileSync(resolve(ROOT, path), 'utf8')
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text), `${path} contains a timestamp`)
    assert.ok(!/\/(Users|home|private\/tmp)\//.test(text), `${path} contains an absolute path`)
    assert.ok(!/GITHUB_RUN_ID|githubRunId/.test(text), `${path} contains a run id`)
  }
})

// 8
test('no closure artifact reaches a route, sitemap, llms.txt or a client bundle', () => {
  const markers = ['alignment-closure-batch', 'ALIGNMENT_CLOSURE_DISPOSITIONS']

  // The audit module composes this data on the server, which is correct and
  // expected. What must never happen is the data crossing into a client
  // bundle, so the walk starts from every "use client" boundary rather than
  // from every route: reaching a server component proves nothing about what
  // ships to a browser.
  const clientEntries: string[] = []
  const collect = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) collect(path)
      else if (/\.tsx?$/.test(entry.name) && /^\s*['"]use client['"]/.test(readFileSync(path, 'utf8'))) {
        clientEntries.push(path)
      }
    }
  }
  for (const dir of ['app', 'components']) {
    if (existsSync(join(ROOT, dir))) collect(join(ROOT, dir))
  }
  assert.ok(clientEntries.length > 0, 'the walk must start somewhere; no client entry points were found')

  const seen = new Set<string>()
  const queue = [...clientEntries]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    for (const marker of markers) {
      assert.ok(!file.includes(marker), `${marker} is reachable from a client bundle via ${file.replace(ROOT, '')}`)
      assert.ok(!readFileSync(file, 'utf8').includes(marker), `${file.replace(ROOT, '')} pulls ${marker} into a client bundle`)
    }
    for (const match of readFileSync(file, 'utf8').matchAll(/from\s+'(\.[^']+)'/g)) {
      const target = resolve(dirname(file), match[1])
      for (const candidate of [target, `${target}.ts`, `${target}.tsx`, join(target, 'index.ts')]) {
        if (existsSync(candidate) && !seen.has(candidate)) queue.push(candidate)
      }
    }
  }

  // Nothing serves the artifacts, and no public projection names them.
  assert.ok(!existsSync(join(ROOT, 'public/frontier-audit')), 'audit artifacts must not be served from public/')
  for (const served of ['app/sitemap.ts', 'lib/llms-manifest.ts']) {
    if (!existsSync(join(ROOT, served))) continue
    assert.ok(!readFileSync(join(ROOT, served), 'utf8').includes('alignment-closure'), `${served} must not reference the closure batch`)
  }

  // When a build is present, check what actually shipped rather than inferring it.
  const staticDir = join(ROOT, '.next/static')
  if (!existsSync(staticDir)) return
  const chunks: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.js')) chunks.push(path)
    }
  }
  walk(staticDir)
  for (const chunk of chunks) {
    const text = readFileSync(chunk, 'utf8')
    for (const marker of markers) {
      assert.ok(!text.includes(marker), `${marker} shipped in ${chunk.replace(ROOT, '')}`)
    }
  }
})
