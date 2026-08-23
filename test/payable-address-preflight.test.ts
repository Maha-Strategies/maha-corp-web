import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  evaluatePayableAddressPreflight,
  PAYABLE_ADDRESS_PREVIEW_SIGNER,
  payableAddressCanonicalJson,
} from '../lib/payable-address-preflight.ts'

const previewPath = new URL('../fixtures/payable-address-preflight/locked-preview.json', import.meta.url)
const fixturesPath = new URL('../fixtures/payable-address-preflight/fixtures.json', import.meta.url)
const schemaPath = new URL('../fixtures/payable-address-preflight/schema.json', import.meta.url)
const ADDRESS = '0xc87a06DEE4c0E85912296002617120BBfd5EF990'
const NOW = new Date('2026-08-23T04:29:40.000Z')

async function lockedPreview() {
  return JSON.parse(await readFile(previewPath, 'utf8')) as Record<string, unknown>
}

test('pins IllWar’s public fixture set by its declared digest', async () => {
  const bytes = await readFile(fixturesPath)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '529fa30d6be7b12cbff6752b53d032a32eb888a39057c54ac3c26bebe52fc893')
})

test('pins the provider schema and refuses to silently widen its versioned contract', async () => {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as { properties: Record<string, { const?: unknown }>; required: string[] }
  assert.equal(schema.properties.address_schema_version.const, 1)
  assert.equal(schema.properties.freshness_bound_seconds.const, 60)
  assert.ok(schema.required.includes('signature'))
  assert.ok(schema.required.includes('limitations'))
})

test('locked preview verifies its provider signature and approves only pre-money progress', async () => {
  const outcome = await evaluatePayableAddressPreflight(await lockedPreview(), {
    address: ADDRESS,
    now: NOW,
    preview: true,
    expectedSignerAddresses: [PAYABLE_ADDRESS_PREVIEW_SIGNER],
  })
  assert.equal(outcome.decision, 'approved_for_pre_money_progress')
  assert.equal(outcome.signatureVerified, true)
  assert.deepEqual(outcome.reasonCodes, ['signed_fresh_eoa_direct_recipient'])
})

test('the signature covers the evaluated classification rather than a self-asserted response', async () => {
  const response = await lockedPreview()
  response.classification = 'contract'
  const outcome = await evaluatePayableAddressPreflight(response, {
    address: ADDRESS, now: NOW, preview: true, expectedSignerAddresses: [PAYABLE_ADDRESS_PREVIEW_SIGNER],
  })
  assert.equal(outcome.decision, 'denied')
  assert.deepEqual(outcome.reasonCodes, ['signature_invalid'])
})

test('stale, untrusted, unknown and unestablished responses cannot advance to a paid test', async () => {
  const stale = await lockedPreview()
  assert.equal((await evaluatePayableAddressPreflight(stale, { address: ADDRESS, now: new Date('2026-08-23T04:31:00Z'), preview: true, expectedSignerAddresses: [PAYABLE_ADDRESS_PREVIEW_SIGNER] })).decision, 'denied')

  const untrusted = await lockedPreview()
  assert.equal((await evaluatePayableAddressPreflight(untrusted, { address: ADDRESS, now: NOW, preview: true, expectedSignerAddresses: ['0x0000000000000000000000000000000000000001'] })).decision, 'denied')

  const extra = await lockedPreview()
  extra.undeclared = true
  assert.equal((await evaluatePayableAddressPreflight(extra, { address: ADDRESS, now: NOW, preview: true, expectedSignerAddresses: [PAYABLE_ADDRESS_PREVIEW_SIGNER] })).decision, 'denied')
})

test('the canonical serializer retains Python json.dumps ASCII escaping required by the provider signature contract', () => {
  assert.equal(payableAddressCanonicalJson({ title: 'Ceylon — tea', z: 1 }), '{"title":"Ceylon \\u2014 tea","z":1}')
})
