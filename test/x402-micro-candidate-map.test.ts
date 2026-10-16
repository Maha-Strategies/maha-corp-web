import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { microDigest } from '../lib/x402/micro-products.ts'
import { NEXT_IDS } from '../lib/x402/micro-next-contracts.ts'
import { X402_OFFERS, historicalOfferById, RETIRED_OFFERS } from '../lib/x402/offers.ts'
import { EXPANSION_IDS, EXPANSION_UTILITY_IDS } from '../lib/x402/expansion-registry.ts'

const root = resolve(import.meta.dirname, '..'), read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const freeze = JSON.parse(read('content/discovery/micro-candidate-freeze-v1.json'))
const selection = JSON.parse(read('content/discovery/micro60-selection-v9.json'))
const costs = JSON.parse(read('content/discovery/micro-next12-cost-observation-v14.json'))
const unsigned = (o: object) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'digest'))
// Owner approval permits exactly these formerly withheld status/price changes;
// it does not authorize rewriting the original 24-offer frozen snapshot.
const OWNER_APPROVED_PROMOTIONS = new Map([
  ['dimensional-consistency-check', '9500'], ['exact-interpolation-receipt', '11500'],
  ['sampled-series-integration', '18500'], ['evidence-conflict-comparator', '21500'],
  ['astrology-experiment-plan-check', '48500'],
])
const expansionImplementationFiles = ['lib/x402/expansion-registry.ts', 'lib/x402/expansion-evidence.ts', 'lib/x402/expansion-commerce.ts', 'lib/x402/expansion-physical-neural.ts', 'lib/x402/expansion-research-content.ts', 'lib/x402/expansion-book-pack.ts']
// Raw byte hashes recorded before this scoped recapture. Historical records do
// not need to match current code; neither their bodies nor formatting may change.
const HISTORICAL_ARTIFACT_SHA256: Record<string, string> = {
  'content/discovery/micro-next12-cost-observation-v13.json': '9075bdbcfe840d7a0cf5a40a687754f67ad8ae63c57d59506a9dcb33518f043b',
  'content/discovery/micro-planning-build-list-v9.json': '7480bd766a5969648eab41165ae49e2954f194307aea3419fdceacce8aa8bf38',
  'content/discovery/micro60-selection-v8.json': '7467ec596cdaf4cc92e1c65757d1f74f97fb731b1f702fe79cb821aa1c995abc',
  'content/discovery/micro-next12-cost-observation-v12.json': '60e7973365ef883097dbf6e340378d436418a013882cedfd3a6cb852f9d2eeb8',
  'content/discovery/micro-planning-build-list-v8.json': 'ef1833e33d2e87d54ad3fd508cf21ad08df8904436b710205232e9b1036c7e3d',
  'content/discovery/micro60-selection-v7.json': '6c1275e1ff205a6dab30e5ae969e25e24b125e6b4ae24d563382a0626c1b5ec3',
  'content/discovery/micro-next12-cost-observation-v1.json': '2278a9eee5f41c63e4ffbf03a5703ee7039eff8d41da5b98629ec9a86eb08303',
  'content/discovery/micro-next12-cost-observation-v2.json': '49c32a8c1649f17919a885a5b6293b81e5c05d7e2c7589a0590680e83b61764d',
  'content/discovery/micro-next12-cost-observation-v3.json': 'ccfb1eaf1f08df4b692ebf14c9682e66d2d94ef05fcffd680722f3763579334b',
  'content/discovery/micro-next12-cost-observation-v4.json': '4e6452cb486b9c8218a454c9908ad00412f38575c639279398cf15df12eb6398',
  'content/discovery/micro-next12-cost-observation-v5.json': '331a5c58e142fdefdbe0a4512f053d39c43cee5cf3d31d4680d2ba25929951d1',
  'content/discovery/micro-next12-cost-observation-v6.json': 'c0c45d62d2f3131c22edf1d3732a2ac072926052e869b2c4d9e89c13d891e5f6',
  'content/discovery/micro-next12-cost-observation-v7.json': '7597a01558266a70d2231fdf3a886250ca6331e94dc47d316b1a846e3f6e2eba',
  'content/discovery/micro-next12-cost-observation-v8.json': '2935f85c2d5dd74fb37719d34a600fa0e44a7085a0692514752ac2ba2cde446b',
  'content/discovery/micro-planning-build-list-v1.json': 'bd9b1893f1d6ae007731b5c42763769c9ae5d785258675ddaea30d14cbdfccca',
  'content/discovery/micro-planning-build-list-v2.json': 'b8c8a902c0bbac6ebf99444bcccd90b009417d0f92355f1155a8bf59244e7c05',
  'content/discovery/micro-planning-build-list-v3.json': 'b048b69d8b5d98a617e46a7845cda63ddbe1e0c2e4076d72d765da6852cb3745',
  'content/discovery/micro-planning-build-list-v4.json': 'bdb5160429e77bb0c2a342969adb5d9e733e845d33d0849bbc8939daafd0542f',
  'content/discovery/micro60-selection-v1.json': '4f9d54c6483f43b394d4dbb70b2f81206fb21b2e22750d4e6a8228be565dc57b',
  'content/discovery/micro60-selection-v2.json': '1359730356f45014eb157c9a85fb34ecb73f595b8f407aff74d5587ef1842480',
  'content/discovery/micro60-selection-v3.json': '59349bc4e9b6adb1dd2205593884c83ffbabeeb50cc7250725e100d664f7d47e',
  'content/discovery/micro-candidate-freeze-v1.json': '02dcd34b1298b91384c5c4b218efaf0b274924410445004cdda6a4daeb9bbc32',
  'content/discovery/micro-next12-cost-observation-v9.json': 'cbc30e66e70428ef6181c81baf2ac307045b3f9631db41db05623218b4e94e37',
  'content/discovery/micro-planning-build-list-v5.json': '8d45757dce6e9df862b17ce07a3938a636e92c817b230390fb99b5f1ebf29693',
  'content/discovery/micro60-selection-v4.json': '8308247aa607ab0df9b6db358a653df5f3d6d50bf1e1433f86ea1bfcf0dea654',
}

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
    ['context-compression', '5001'],
    ['revision-lineage-check', '6000'],
    ['context-budget-ladder', '12000'], ['citation-binding-check', '16000'],
    ['audit-export-normalizer', '18000'], ['celestial-position-snapshot', '20000'],
    ['book-section-the-imagined-life', '25000'], ['book-section-the-volcanic-engine', '30000'],
    ['celestial-chart-evidence', '60000'], ['celestial-vimshottari-timing', '120000'],
    ['mps-autonomous-audit', '250000'], ['book-edition-the-imagined-life', '3000000'],
    ['book-edition-the-volcanic-engine', '3500000'],
  ])
  for (const prior of freeze.existingOffers) {
    const current = historicalOfferById(prior.id)!
    assert.equal(current.path, prior.path, `${prior.id}:path`)
    if (DISCOVERY_PROBLEM_COPY[prior.id] ?? BAZAAR_LAUNCH_COPY[prior.id]) {
      assert.equal(current.description, DISCOVERY_PROBLEM_COPY[prior.id] ?? BAZAAR_LAUNCH_COPY[prior.id], `${prior.id}: approved problem-oriented discovery copy, falling back to historical launch copy`)
    } else if (prior.id === 'context-budget-ladder') {
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
    const expectedAmount = OWNER_APPROVED_PROMOTIONS.get(prior.id) ?? repricedForAttribution.get(prior.id) ?? prior.amount
    assert.equal(current.amount, expectedAmount, `${prior.id}:amount`)
    if (repricedForAttribution.has(prior.id) || OWNER_APPROVED_PROMOTIONS.has(prior.id)) {
      const moved = BigInt(current.amount) - BigInt(prior.amount)
      assert.ok(moved > BigInt(0), `${prior.id}: no published price is cut without a recorded reason`)
    }
    // Freeze stays immutable: only the original three plus the five explicitly
    // owner-approved promotions may change status. Other drift still fails.
    const promoted = ['citation-binding-check', 'revision-lineage-check', 'audit-export-normalizer'].includes(prior.id) || OWNER_APPROVED_PROMOTIONS.has(prior.id)
    assert.equal(current.status, RETIRED_OFFERS.some(o => o.id === prior.id) ? 'withheld' : promoted ? 'available' : prior.status, `${prior.id}:status`)
  }
})

test('expanded integration contains 51 new products and exactly five owner-approved promotions', () => {
  assert.equal(EXPANSION_IDS.length, 51)
  assert.deepEqual([...EXPANSION_UTILITY_IDS].sort(), [...OWNER_APPROVED_PROMOTIONS.keys()].sort())
  for (const [id, amount] of OWNER_APPROVED_PROMOTIONS) {
    const historical = freeze.existingOffers.find((o: { id: string }) => o.id === id)
    const current = X402_OFFERS.find(o => o.id === id)!
    assert.equal(historical.status, 'withheld'); assert.equal(current.status, 'available')
    assert.equal(current.amount, amount)
    assert.equal(current.availability.payableInProduction, true)
    assert.equal(current.path, historical.path); assert.equal(current.description, historical.description)
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
  assert.equal(costs.version, 'micro-next12-cost-observation/14')
  assert.equal(costs.supersedes, 'micro-next12-cost-observation-v13.json')
  assert.equal(selection.version, 'micro60-selection/9'); assert.equal(selection.supersedes, 'micro60-selection-v8.json')
  assert.equal(costs.workloadsDigest, JSON.parse(read('content/discovery/micro-next12-cost-observation-v9.json')).workloadsDigest)
  assert.equal(costs.cloudBillingMeasured, false); assert.equal(costs.exhaustiveWorstCaseProof, false)
  assert.equal(costs.remoteCalls, 0); assert.equal(costs.deploymentBuilds, 0); assert.equal(costs.paymentAttempts, 0); assert.equal(costs.indexingPurchases, 0)
  assert.match(costs.basis, /not an exhaustive worst-case proof.*cloud billing/)
  assert.match(selection.qualification, /not a current ranking.*expanded catalogue/)
  assert.equal(costs.implementationDigest, microDigest(costs.implementationFiles.map((path: string) => ({ path, contentDigest: microDigest(read(path)) }))))
  assert.deepEqual(costs.implementationFileDigests, costs.implementationFiles.map((path: string) => ({ path, contentDigest: microDigest(read(path)) })))
  for (const path of expansionImplementationFiles) assert.ok(costs.implementationFiles.includes(path), path)
  for (const id of NEXT_IDS) {
    const row = selection.rows.find((r: { productId: string }) => r.productId === id), observation = costs.observations.find((r: { id: string }) => r.id === id)
    assert.equal(observation.calls, 32)
    assert.equal(observation.providerCalls, 0)
    assert.equal(observation.cloudCostUsd, null)
    assert.ok(observation.requestBytes <= 32768 && observation.responseBytes <= 65536)
    // Assert persisted measurements, not a live elapsed-time SLA under a
    // concurrently running full suite or build. The review's bound stays 100 ms.
    assert.ok(Number.isFinite(observation.cappedWorkloadP95Ms) && observation.cappedWorkloadP95Ms >= 0 && observation.cappedWorkloadP95Ms <= 100, `${id}: captured local p95 ${observation.cappedWorkloadP95Ms} ms exceeds the 100 ms selection bound`)
    assert.ok(Number.isFinite(observation.cappedWorkloadMaxMs) && observation.cappedWorkloadP95Ms <= observation.cappedWorkloadMaxMs)
    assert.equal(row.score, row.utilityScore * 4 + row.evidenceScore * 4 + row.localCostScore * 2)
    assert.ok(row.evidencePacket.locator && row.evidencePacket.rights && row.evidencePacket.boundary)
  }
})

test('map and examples regenerate deterministically; profiled implementation remains bound', () => {
  const files = [...Object.keys(HISTORICAL_ARTIFACT_SHA256), 'content/discovery/micro-next12-cost-observation-v11.json', 'content/discovery/micro-next12-cost-observation-v14.json', 'content/discovery/micro-planning-build-list-v7.json', 'content/discovery/micro-planning-build-list-v8.json', 'content/discovery/micro60-selection-v7.json', 'content/discovery/micro60-selection-v9.json', 'content/discovery/microproduct-examples.json']
  const before = files.map(read)
  for (let i = 0; i < 2; i++) for (const script of ['freeze-micro-candidates', 'profile-next12', 'review-micro-candidates', 'generate-microproduct-examples', 'sync-microproduct-discovery']) execFileSync(process.execPath, ['--experimental-strip-types', `scripts/${script}.ts`, '--check'], { cwd: root })
  assert.deepEqual(files.map(read), before)
})

test('fresh versioned records cannot be recaptured or overwritten; every historical artifact stays byte-identical', () => {
  const files = [...Object.keys(HISTORICAL_ARTIFACT_SHA256), 'content/discovery/micro-next12-cost-observation-v11.json', 'content/discovery/micro-next12-cost-observation-v14.json', 'content/discovery/micro-planning-build-list-v7.json', 'content/discovery/micro-planning-build-list-v8.json', 'content/discovery/micro60-selection-v7.json', 'content/discovery/micro60-selection-v9.json']
  const before = files.map(read)
  for (const [script, arg] of [['profile-next12', '--capture'], ['profile-planning-ten', '--capture'], ['review-micro-candidates', '--write']]) {
    const attempt = spawnSync(process.execPath, ['--experimental-strip-types', `scripts/${script}.ts`, arg], { cwd: root })
    assert.notEqual(attempt.status, 0)
    assert.match(attempt.stderr.toString(), /immutable-profile-already-exists|EEXIST/)
  }
  assert.deepEqual(files.map(read), before)
  for (const [path, expected] of Object.entries(HISTORICAL_ARTIFACT_SHA256)) {
    assert.equal(createHash('sha256').update(read(path)).digest('hex'), expected, `${path}: immutable bytes`)
    const record = JSON.parse(read(path))
    assert.equal(record.digest, microDigest(unsigned(record)), `${path}: immutable digest`)
  }
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
import { BAZAAR_LAUNCH_COPY } from '../lib/x402/bazaar-launch.ts'
import { DISCOVERY_PROBLEM_COPY } from '../lib/x402/discovery-problem-copy.ts'
