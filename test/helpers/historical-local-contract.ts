import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { demandDigest } from '../../lib/x402/demand6/digest.ts'
import type { Endpoint } from '../../lib/api-v1/types.ts'
import reviewedFinal42 from '../../content/api-v1/production-additions-42.json' with { type: 'json' }

/** Preserve historical local snapshots as records, not rewritten baselines.
 * Only the explicitly reviewed, previously UNRELEASED final42 may transition
 * to the new frozen release contract. All 958 released hashes remain enforced
 * independently by production-release.ts at import time. Prices stay frozen. */
export function assertEarlierLocalContract(e: Endpoint, r: { id: string; path: string; method: string; inputDigest: string; outputDigest: string; contractDigest?: string }) {
  assert.equal(e.path, r.path); assert.equal(e.method, r.method)
  const unchanged = demandDigest(e.schema.input) === r.inputDigest && demandDigest(e.schema.output) === r.outputDigest
    && (!r.contractDigest || demandDigest(e) === r.contractDigest)
  if (unchanged) return
  const approved = reviewedFinal42.targets.find(t => t.id === r.id)
  assert.ok(approved, 'A released or unapproved contract changed: ' + r.id)
  assert.equal('sha256:' + createHash('sha256').update(JSON.stringify(e)).digest('hex'), approved.contractHash)
}
