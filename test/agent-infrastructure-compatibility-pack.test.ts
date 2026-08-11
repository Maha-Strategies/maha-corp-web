import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COMPATIBILITY_PACK_CONTRACT,
  COMPATIBILITY_PACK_INPUT_SCHEMA,
  COMPATIBILITY_PACK_LIMITATIONS,
  COMPATIBILITY_PACK_OUTPUT_SCHEMA,
  COMPATIBILITY_PACK_PRICE,
  COMPATIBILITY_PACK_SAMPLE_REPORT,
} from '../lib/agent-infrastructure-compatibility-pack.ts'
import offers from '../content/discovery/agent-offers.json' with { type: 'json' }
import { buildLlmsManifest } from '../lib/llms-manifest.ts'

test('the compatibility pack has one fixed machine price and is not falsely payable', () => {
  assert.deepEqual(COMPATIBILITY_PACK_PRICE, { amount: '49000000', display: '49.00 USDC', asset: 'USDC', decimals: 6, network: 'eip155:8453' })
  assert.equal(COMPATIBILITY_PACK_CONTRACT.status, 'contract_published_runtime_withheld')
  assert.equal(COMPATIBILITY_PACK_CONTRACT.purchase.payableNow, false)
})

test('the input contract bounds one A2A agent, one MCP server and declared non-mutating actions', () => {
  assert.equal(COMPATIBILITY_PACK_INPUT_SCHEMA.additionalProperties, false)
  assert.deepEqual(COMPATIBILITY_PACK_INPUT_SCHEMA.required, ['version', 'clientRequestId', 'targets', 'policy', 'testPlan'])
  const targets = COMPATIBILITY_PACK_INPUT_SCHEMA.properties.targets
  assert.deepEqual(targets.required, ['a2a', 'mcp'])
  const plan = COMPATIBILITY_PACK_INPUT_SCHEMA.properties.testPlan.properties
  assert.equal(plan.a2a.properties.callerConfirmsNonMutating.const, true)
  assert.equal(plan.mcp.properties.callerConfirmsNonMutating.const, true)
  assert.equal(COMPATIBILITY_PACK_CONTRACT.execution.boundedCalls.length, 6)
})

test('the output contract makes findings, evidence, retention and refunds machine-readable', () => {
  const required = new Set(COMPATIBILITY_PACK_OUTPUT_SCHEMA.required)
  for (const field of ['decision', 'checks', 'paymentInspection', 'retention', 'limitations', 'refund']) assert.equal(required.has(field), true)
  assert.equal(COMPATIBILITY_PACK_OUTPUT_SCHEMA.properties.paymentInspection.properties.upstreamSettlementPerformed.const, false)
  assert.equal(COMPATIBILITY_PACK_OUTPUT_SCHEMA.properties.retention.properties.credentialsStored.const, false)
  assert.equal(COMPATIBILITY_PACK_OUTPUT_SCHEMA.properties.refund.properties.status.enum.includes('completed'), true)
})

test('the sample report is internally consistent and does not imply certification', () => {
  const counts = COMPATIBILITY_PACK_SAMPLE_REPORT.checks.reduce((total, check) => {
    if (check.status === 'pass') total.pass += 1
    else if (check.status === 'fail') total.fail += 1
    else total.not_checked += 1
    return total
  }, { pass: 0, fail: 0, not_checked: 0 })
  assert.deepEqual(counts, { pass: 2, fail: 1, not_checked: 1 })
  assert.deepEqual(COMPATIBILITY_PACK_SAMPLE_REPORT.summary, { passed: counts.pass, failed: counts.fail, notChecked: counts.not_checked, highestSeverity: 'medium' })
  assert.equal(COMPATIBILITY_PACK_SAMPLE_REPORT.paymentInspection.upstreamSettlementPerformed, false)
  assert.equal(COMPATIBILITY_PACK_SAMPLE_REPORT.retention.credentialsStored, false)
  assert.match(COMPATIBILITY_PACK_LIMITATIONS.join(' '), /not.*certification/i)
})

test('machine discovery publishes the contract, fixed price and withheld runtime truthfully', () => {
  const offer = offers.offers.find((entry) => entry.id === 'agent-infrastructure-compatibility-pack')
  assert.ok(offer)
  assert.equal(offer.status, 'contract_published_runtime_withheld')
  assert.equal('price' in offer && offer.price?.amount, '49000000')
  assert.equal('purchase' in offer && offer.purchase?.payableNow, false)
  const llms = buildLlmsManifest([])
  assert.match(llms, /Agent Infrastructure Compatibility Pack/)
  assert.match(llms, /49\.00 USDC/)
  assert.match(llms, /RUNTIME WITHHELD/)
})
