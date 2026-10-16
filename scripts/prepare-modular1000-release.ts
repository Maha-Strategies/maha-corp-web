import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { ENDPOINTS } from '../lib/api-v1/endpoints.registry.ts'
import previous204 from '../content/api-v1/production-additions-204.json' with { type: 'json' }
import previous125 from '../content/api-v1/production-additions-125.json' with { type: 'json' }
import previous201 from '../content/api-v1/production-additions-201.json' with { type: 'json' }
import previous132 from '../content/api-v1/production-additions-132.json' with { type: 'json' }
import { final42Input, final42OfflineHandler } from './lib/api-v1-final42-fixtures.ts'
import { isPaidReadingProduct, validateFinal42Delivery } from '../lib/api-v1/final42-validation.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { validate } from '../test/helpers/json-schema.ts'
import original from '../content/api-v1/production-release-296.json' with { type: 'json' }

const previousTargets = [original, previous204, previous125, previous201, previous132].flatMap(release => release.targets)
for (const pin of previousTargets) {
  const e = ENDPOINTS.find(e => e.id === pin.id)
  if (!e || pin.contractHash !== 'sha256:' + createHash('sha256').update(JSON.stringify(e)).digest('hex')) throw Error('previous958_contract_changed:' + pin.id)
}
const previous = new Set(previousTargets.map(e => e.id)), selected = ENDPOINTS.filter(e => !previous.has(e.id))
if (previous.size !== 958 || selected.length !== 42 || selected.reduce((n, e) => n + BigInt(e.amount), 0n) !== 2592940n) throw Error('approved_final42_scope_changed')
const targets = []
for (const e of selected) {
  if (e.sourceReview === 'pending' || !['local-cpu-wasm', 'external-source-read'].includes(e.execution_cost!.mode)
    || e.execution_cost!.liveModelSpendApproved) throw Error('unreviewed_final42:' + e.id)
  const h = final42OfflineHandler(e), input = h.input.parse(final42Input(e)), output = h.output.parse(await h.execute(input))
  const errors = validate({ success: true, data: output, proof: { settlement_id: '0x' + '1'.repeat(64) } }, e.schema.output)
  if (errors.length) throw Error('invalid_final42_example:' + e.id + ':' + JSON.stringify(errors))
  validateFinal42Delivery(e, input, output, output)
  const hidden = isPaidReadingProduct(e.id)
  targets.push({ id: e.id, path: e.path, method: e.method, amount: e.amount,
    contractHash: 'sha256:' + createHash('sha256').update(JSON.stringify(e)).digest('hex'),
    inputJson: JSON.stringify(input), outputJson: JSON.stringify(hidden ? null : output),
    exampleBasis: hidden ? 'paid-content-omitted' : e.execution_cost?.mode === 'external-source-read' || e.id === 'x402-quote-change-report' ? 'synthetic-source-observation-not-live' : 'public-or-synthetic-deterministic',
    verification: hidden ? 'edition-and-unit-pins' : e.execution_cost?.mode === 'external-source-read' || e.id === 'x402-quote-change-report' ? 'schema-integrity-input-binding' : e.id === 'celestial-vimshottari-timing' ? 'calculation-receipt-integrity' : 'frozen-deterministic' })
}
const release = { version: 'maha-modular-1000-final42-20261015/1', previousCount: 958, additionalCount: 42, targetReleasedCount: 1000,
  maximumBaseUnits: '2592940', observedWalletBalanceBaseUnits: '2636657', expectedRemainingBaseUnits: '43717',
  operatorWallet: original.operatorWallet, payee: original.payee, network: original.network,
  indexingClassification: 'publisher-funded-operator-activity', customerRevenue: false, organicDemand: false, automaticRepayment: false,
  sourceReview: 'content/api-v1/final42-source-review.json', targets, targetsDigest: demandDigest(targets) }
await writeFile('content/api-v1/production-additions-42.json', JSON.stringify(release, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ additional: targets.length, releasedAfterDeployment: 1000, maximumBaseUnits: release.maximumBaseUnits,
  paidTextIncluded: false, paidCalls: 0, modelCalls: 0, targetsDigest: release.targetsDigest }))
