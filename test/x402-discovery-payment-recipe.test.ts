import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BASE_NETWORK,
  BASE_USDC,
  EXPECTED_PRICE_BASE_UNITS,
  MAHA_CONTEXT_RESOURCE,
  MAHA_PAYEE,
  SPEND_CEILING_BASE_UNITS,
  assertSpendPolicy,
  inspectBazaarContract,
  verifyPaymentReceipt,
  type BazaarResource,
} from '../lib/x402/discovery-payment-recipe.ts'

const requirement = {
  scheme: 'exact', network: BASE_NETWORK, amount: String(EXPECTED_PRICE_BASE_UNITS), payTo: MAHA_PAYEE,
  maxTimeoutSeconds: 60, asset: BASE_USDC, extra: { name: 'USD Coin', version: '2' },
}

test('the recipe accepts only the expected payment below its hard ceiling', () => {
  assert.ok(EXPECTED_PRICE_BASE_UNITS < SPEND_CEILING_BASE_UNITS)
  assert.doesNotThrow(() => assertSpendPolicy(requirement))
  assert.throws(() => assertSpendPolicy({ ...requirement, amount: String(SPEND_CEILING_BASE_UNITS + BigInt(1)) }), /hard ceiling/)
  assert.throws(() => assertSpendPolicy({ ...requirement, amount: '2000' }), /expects exactly/)
  assert.throws(() => assertSpendPolicy({ ...requirement, payTo: '0x0000000000000000000000000000000000000000' }), /unexpected payee/)
})

test('the recipe inspects the Bazaar input and output schemas before use', () => {
  const resource: BazaarResource = {
    resource: MAHA_CONTEXT_RESOURCE,
    description: 'Context compiler',
    accepts: [requirement],
    extensions: { bazaar: { info: { input: { body: { task: 'Long enough task', documents: [], tokenBudget: 128, clientRequestId: 'request_123' } } }, schema: { properties: { input: { properties: { body: { required: ['task', 'documents', 'tokenBudget', 'clientRequestId'], properties: { task: {}, documents: {}, tokenBudget: {}, clientRequestId: {} } } } }, output: { properties: { example: { properties: { packId: {}, context: {} } } } } } } } },
  }
  const inspected = inspectBazaarContract(resource)
  assert.deepEqual(Object.keys(inspected.inputSchema.properties as object), ['task', 'documents', 'tokenBudget', 'clientRequestId'])
  assert.deepEqual(Object.keys(inspected.outputSchema.properties as object), ['packId', 'context'])
})

test('PAYMENT-RESPONSE must bind settlement to the signing wallet and Base transaction', () => {
  const payer = '0x7b7ff44288fADe4A1829abA2584DFCeB952146f2'
  const receipt = { success: true, transaction: `0x${'a'.repeat(64)}`, network: BASE_NETWORK, payer }
  assert.doesNotThrow(() => verifyPaymentReceipt(receipt, payer))
  assert.throws(() => verifyPaymentReceipt(null, payer), /omitted PAYMENT-RESPONSE/)
  assert.throws(() => verifyPaymentReceipt({ ...receipt, payer: MAHA_PAYEE }, payer), /does not match/)
})
