import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { QUANTUM_BRIDGE_CANDIDATES } from '../lib/quantum-bridge-candidates.ts'
import { QUANTUM_BRIDGE_AUDIT, promotionReadyBridges } from '../lib/quantum-bridge-audit-package.ts'
import {
  QUANTUM_BRIDGE_CLOSURE,
  quantumBridgeClosureDigest,
} from '../lib/quantum-bridge-closure.ts'
import { endpointUsabilityTotals } from '../lib/endpoint-fitness.ts'
import { ALIGNMENT_BATCH_7_DECISIONS } from '../lib/frontier-alignment-batch-7.ts'
import {
  BATCH_7_FIRST_JUDGEMENTS,
  BATCH_7_REINSPECTIONS,
  FRONTIER_ALIGNMENT_AUDIT,
  alignmentBlockers,
  alignmentFor,
  verdictTotals,
} from '../lib/frontier-source-alignment.ts'

test('all twelve bridge specifications receive an immutable editorial closure', () => {
  assert.equal(QUANTUM_BRIDGE_CLOSURE.length, 12)
  assert.equal(QUANTUM_BRIDGE_CLOSURE.filter((entry) => entry.finalDisposition === 'REVISE').length, 9)
  assert.deepEqual(
    QUANTUM_BRIDGE_CLOSURE.filter((entry) => entry.finalDisposition === 'REJECT').map((entry) => entry.bridgeId),
    ['Q-BR-003', 'Q-BR-010', 'Q-BR-011'],
  )
  assert.equal(new Set(QUANTUM_BRIDGE_CLOSURE.map((entry) => entry.closureDigest)).size, 12)
  assert.match(quantumBridgeClosureDigest(), /^sha256:[a-f0-9]{64}$/)
})

test('closure preserves every original BLOCK and cannot promote a bridge', () => {
  assert.equal(QUANTUM_BRIDGE_AUDIT.length, 12)
  assert.ok(QUANTUM_BRIDGE_AUDIT.every((entry) => entry.verdict === 'BLOCK'))
  assert.ok(QUANTUM_BRIDGE_CLOSURE.every((entry) => entry.submittedVerdict === 'BLOCK' && !entry.promotionEligible))
  assert.equal(promotionReadyBridges().length, 0)
})

test('Batch 7 records forty bounded decisions across all eight frontier domains', () => {
  assert.equal(ALIGNMENT_BATCH_7_DECISIONS.length, 40)
  assert.equal(BATCH_7_REINSPECTIONS.length, 35)
  assert.equal(BATCH_7_FIRST_JUDGEMENTS.length, 5)
  assert.equal(new Set(ALIGNMENT_BATCH_7_DECISIONS.map((entry) => entry.domainSlug)).size, 8)
  assert.equal(ALIGNMENT_BATCH_7_DECISIONS.filter((entry) => entry.sourceContentInspected).length, 35)
  assert.equal(ALIGNMENT_BATCH_7_DECISIONS.filter((entry) => entry.verdict === 'inaccessible-source').length, 5)
})

test('Batch 7 inspection is explicit and metadata-only records remain blocked', () => {
  for (const decision of ALIGNMENT_BATCH_7_DECISIONS) {
    const audit = alignmentFor(decision.recordId)!
    assert.equal(audit.evidence.sourceContentInspected, decision.sourceContentInspected)
    if (!decision.sourceContentInspected) {
      assert.equal(audit.evidence.inspectedContentLocation, null)
      assert.ok(alignmentBlockers(decision.recordId).includes('source-not-inspected'))
    } else {
      assert.ok(audit.evidence.inspectedContentLocation)
    }
  }
})

test('Batch 7 produces the reconciled corpus totals', () => {
  assert.deepEqual(verdictTotals(), {
    supported: 70,
    'partially-supported': 37,
    mismatched: 68,
    'insufficient-evidence': 40,
    'inaccessible-source': 25,
  })
  assert.equal(FRONTIER_ALIGNMENT_AUDIT.filter((entry) => entry.evidence.sourceContentInspected).length, 181)
  assert.equal(FRONTIER_ALIGNMENT_AUDIT.filter((entry) => alignmentBlockers(entry.recordId).length === 0).length, 70)
})

test('bridge endpoint and usability invariants do not move under editorial closure', () => {
  const totals = endpointUsabilityTotals(
    QUANTUM_BRIDGE_CANDIDATES.flatMap((candidate) => [candidate.declaredSourceRef, candidate.declaredTargetRef]),
  )
  assert.deepEqual(totals, { structurallyResolved: 2, usable: 1, structurallyResolvedButBlocked: 1, unresolved: 22 })
})

test('generated closure and Batch 7 artifacts agree with the active modules', () => {
  const closure = JSON.parse(readFileSync('content/bridges/quantum-bridge-closure.json', 'utf8'))
  const batch = JSON.parse(readFileSync('content/frontier-alignment/batch-7-results.json', 'utf8'))
  assert.equal(closure.registerDigest, quantumBridgeClosureDigest())
  assert.equal(closure.records.length, 12)
  assert.equal(batch.decisions.length, 40)
  assert.equal(batch.counts.contentInspected, 35)
  assert.equal(batch.counts.alignmentClear, 11)
  assert.equal(batch.counts.remainingCorpusUninspected, 59)
})

test('closure and Batch 7 result regeneration is byte-identical', () => {
  const root = new URL('..', import.meta.url).pathname
  const paths = [
    'content/bridges/quantum-bridge-closure.json',
    'docs/bridges/quantum-bridge-closure.md',
    'content/frontier-alignment/batch-7-results.json',
    'docs/frontier-audit/alignment-batch-7-results.md',
  ]
  const before = paths.map((path) => readFileSync(join(root, path), 'utf8'))
  for (const script of ['generate-quantum-bridge-closure.ts', 'generate-frontier-alignment-batch-7-results.ts']) {
    execFileSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts', script)], { cwd: root })
  }
  paths.forEach((path, index) => assert.equal(readFileSync(join(root, path), 'utf8'), before[index], `${path} drifted`))
})

test('closure and Batch 7 audit artifacts are absent from public route definitions', () => {
  const servedSources = [
    readFileSync('app/sitemap.ts', 'utf8'),
    readFileSync('app/llms.txt/route.ts', 'utf8'),
  ].join('\n')
  for (const marker of ['quantum-bridge-closure', 'batch-7-results', 'maha-quantum-bridge-closure/1.0']) {
    assert.doesNotMatch(servedSources, new RegExp(marker))
  }
})
