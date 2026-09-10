import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { microDigest } from '../lib/x402/micro-products.ts'
import { NEXT_IDS } from '../lib/x402/micro-next-contracts.ts'
import { X402_OFFERS } from '../lib/x402/offers.ts'

const root = resolve(import.meta.dirname, '..'), read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const freeze = JSON.parse(read('content/discovery/micro-candidate-freeze-v1.json'))
const selection = JSON.parse(read('content/discovery/micro60-selection-v1.json'))
const costs = JSON.parse(read('content/discovery/micro-next12-cost-observation-v2.json'))
const unsigned = (o: object) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'digest'))

test('freeze enumerates sixty original candidates and refuses to overwrite the original 24-offer baseline', () => {
  assert.equal(freeze.candidates.length, 60)
  assert.equal(new Set(freeze.candidates.map((r: { candidateId: string }) => r.candidateId)).size, 60)
  assert.equal(freeze.existingOffers.length, 24)
  assert.equal(freeze.digest, microDigest(unsigned(freeze)))
  const before = read('content/discovery/micro-candidate-freeze-v1.json')
  const again = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/freeze-micro-candidates.ts', '--create'], { cwd: root })
  assert.notEqual(again.status, 0)
  assert.equal(read('content/discovery/micro-candidate-freeze-v1.json'), before)
  // Offers repriced twice since the freeze. First for attribution: the chain
  // records only payer, amount and recipient, so a shared amount makes a
  // payment unattributable, and deep-context-evaluation's four external
  // settlements were about to become ambiguous. That pass moved eleven offers
  // by one to eleven base units.
  //
  // Then for separation. Those one-unit offsets attributed on-chain but were
  // unreadable on an invoice and a thousand times finer than the $0.001
  // facilitator fee, so a fee-scale perturbation could alias one product onto
  // another. Every payable pair is now at least 2000 base units apart, and
  // every move was upward: with seventeen of nineteen offers having never
  // recorded a sale, raising a never-sold price forgoes nothing observable
  // while cutting one forgoes margin on sales that may yet come.
  //
  // Naming them keeps the freeze a guard: any other amount drift still fails here.
  const repricedForAttribution = new Map([
    ['revision-lineage-check', '6000'],
    ['context-budget-ladder', '12000'], ['citation-binding-check', '16000'],
    ['audit-export-normalizer', '18000'], ['celestial-position-snapshot', '20000'],
    ['book-section-the-imagined-life', '25000'], ['book-section-the-volcanic-engine', '30000'],
    ['celestial-chart-evidence', '60000'], ['celestial-vimshottari-timing', '120000'],
    ['mps-autonomous-audit', '250000'], ['book-edition-the-imagined-life', '3000000'],
    ['book-edition-the-volcanic-engine', '3500000'],
  ])
  for (const prior of freeze.existingOffers) {
    const current = X402_OFFERS.find(o => o.id === prior.id)!
    assert.equal(current.path, prior.path, `${prior.id}:path`)
    if (prior.id === 'context-budget-ladder') {
      // The one permitted description change. This offer used to publish its
      // price as a strict derivation -- five $0.001 compilations -- and is no
      // longer one: it sits on its own rung so every payable pair stays two
      // facilitator fees apart. The sentence now states what the buyer receives
      // rather than a multiple it would fail. Everything outside that one
      // sentence must still be byte-identical.
      const basis = /Price basis: five (?:\$[\d.]+ compilations|compiler runs, the comparison table and the receipt digest)\./
      assert.match(current.description, /Price basis: five compiler runs, the comparison table and the receipt digest\./)
      assert.equal(current.description.replace(basis, ''), prior.description.replace(basis, ''),
        `${prior.id}: only the price basis may differ`)
    } else {
      assert.equal(current.description, prior.description, `${prior.id}:description`)
    }
    const expectedAmount = repricedForAttribution.get(prior.id) ?? prior.amount
    assert.equal(current.amount, expectedAmount, `${prior.id}:amount`)
    if (repricedForAttribution.has(prior.id)) {
      const moved = BigInt(current.amount) - BigInt(prior.amount)
      assert.ok(moved > BigInt(0), `${prior.id}: no published price is cut without a recorded reason`)
    }
    // Freeze is immutable history. Only the three explicitly promoted original ten may change status.
    const promoted = ['citation-binding-check', 'revision-lineage-check', 'audit-export-normalizer'].includes(prior.id)
    assert.equal(current.status, promoted ? 'available' : prior.status, `${prior.id}:status`)
  }
})

test('sixty semantic decisions partition honestly; merged entries name a retained candidate', () => {
  assert.equal(selection.digest, microDigest(unsigned(selection)))
  assert.equal(selection.freezeDigest, freeze.digest)
  assert.equal(selection.costObservationDigest, costs.digest)
  assert.equal(selection.rows.length, 60)
  assert.deepEqual([...selection.selected].sort(), [...NEXT_IDS].sort())
  const counts: Record<string, number> = {}
  for (const row of selection.rows) {
    counts[row.disposition] = (counts[row.disposition] ?? 0) + 1
    assert.ok(row.reason.length > 40 && row.comparedWith)
    assert.equal(row.demand, null); assert.equal(row.cloudCostUsd, null)
    if (!row.productId) { assert.equal(row.score, null); assert.equal(row.costObservation, null) }
    if (row.disposition === 'merge') assert.ok(selection.rows.some((r: { candidateId: string; disposition: string }) => r.candidateId === row.comparedWith && r.disposition !== 'merge'))
  }
  assert.deepEqual(counts, { 'selected-local-only': 12, defer: 40, merge: 4, 'rights-review': 1, 'extend-existing': 3 })
})

test('selected scores require actual bounded local observations, not zero-cost guesses for unmeasured products', () => {
  assert.equal(costs.digest, microDigest(unsigned(costs)))
  for (const id of NEXT_IDS) {
    const row = selection.rows.find((r: { productId: string }) => r.productId === id), observation = costs.observations.find((r: { id: string }) => r.id === id)
    assert.equal(observation.calls, 32)
    assert.equal(observation.providerCalls, 0)
    assert.equal(observation.cloudCostUsd, null)
    assert.ok(observation.requestBytes <= 32768 && observation.responseBytes <= 65536)
    assert.ok(observation.cappedWorkloadP95Ms >= 0 && observation.cappedWorkloadP95Ms <= 100)
    assert.equal(row.score, row.utilityScore * 4 + row.evidenceScore * 4 + row.localCostScore * 2)
    assert.ok(row.evidencePacket.locator && row.evidencePacket.rights && row.evidencePacket.boundary)
  }
})

test('map and examples regenerate deterministically; profiled implementation remains bound', () => {
  const files = ['content/discovery/micro-candidate-freeze-v1.json', 'content/discovery/micro60-selection-v1.json', 'content/discovery/micro-next12-cost-observation-v1.json', 'content/discovery/micro-next12-cost-observation-v2.json', 'content/discovery/microproduct-examples.json']
  const before = files.map(read)
  for (let i = 0; i < 2; i++) for (const script of ['freeze-micro-candidates', 'profile-next12', 'review-micro-candidates', 'generate-microproduct-examples', 'sync-microproduct-discovery']) execFileSync(process.execPath, ['--experimental-strip-types', `scripts/${script}.ts`, '--check'], { cwd: root })
  assert.deepEqual(files.map(read), before)
})

test('public runtime does not import private selection, cost observations or frozen candidates', () => {
  for (const path of ['lib/x402/micro-contracts.ts', 'lib/x402/micro-next-contracts.ts', 'lib/x402/micro-next-products.ts', 'lib/x402/micro-next-religion.ts', 'lib/x402/micro-next-samples.ts', 'lib/x402/micro-offers.ts', 'lib/x402/micro-route.ts']) {
    assert.doesNotMatch(read(path), /micro60-selection|micro-next12-cost-observation|micro-candidate-freeze/)
  }
  for (const path of ['public/.well-known/x402-public-manifest.json', 'content/discovery/agent-card.json', 'content/discovery/agent-offers.json', 'content/discovery/microproduct-examples.json']) assert.doesNotMatch(read(path), /cpuMicros|cappedWorkloadP95Ms|costObservationDigest|NEVER-EXPOSE/)
  // The shared factory must enforce the reviewed allowlist, independent of payment configuration.
  assert.match(read('lib/x402/micro-route.ts'), /if \(!microExecutionAllowed\(id, environment\)\)/)
})

test('entrypoint import order cannot resurrect the earlier schema/catalog initialization cycle', () => {
  for (const path of ['micro-contracts', 'micro-next-contracts', 'micro-next-products', 'micro-products']) execFileSync(process.execPath, ['--experimental-strip-types', '-e', `await import('./lib/x402/${path}.ts')`], { cwd: root })
})
