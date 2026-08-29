import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  evaluatePayableAddressPreflight,
  PAYABLE_ADDRESS_MANIFEST_PIN,
  PAYABLE_ADDRESS_PREVIEW_SIGNER,
  resolvePayableAddressManifestSigner,
  payableAddressCanonicalJson,
} from '../lib/payable-address-preflight.ts'

const previewPath = new URL('../fixtures/payable-address-preflight/locked-preview.json', import.meta.url)
const fixturesPath = new URL('../fixtures/payable-address-preflight/fixtures.json', import.meta.url)
const schemaPath = new URL('../fixtures/payable-address-preflight/schema.json', import.meta.url)
const manifestPath = new URL('../fixtures/payable-address-preflight/proof-manifest.json', import.meta.url)
const ADDRESS = '0xc87a06DEE4c0E85912296002617120BBfd5EF990'
const NEW_SIGNER = '0x0000000000000000000000000000000000000001'
const NOW = new Date('2026-08-29T15:53:00.000Z')
const ROTATION_NOW = new Date('2026-08-23T04:29:40.000Z')
const FIXTURE_BUNDLE_SHA256 = '83cc0a2cba1150059abbe67f275e7f0a6d72b2ad2a1903445b61db8d4a28ecd9'
const PROOF_MANIFEST_SHA256 = 'afad74421615403c80862e63b47336ab25d7b948460fcabdbabaabafe41a9809'

type SignedEnvelope = {
  case: string
  canonical_body: string
  canonical_sha256: string
  evaluation_time: string
  example_downstream_policy: string
  expected: {
    classification: string
    code_present: boolean
    direct_recipient_plausibility: string
    proxy_indication: string
    transfer_path_result: string
    transfer_path_revert_reason: string | null
  }
  input: { address: string; chain: string; token: string | null }
  proof_manifest: { generated_at: string; sha256: string; url: string; version: string }
  reason_codes: string[]
  response: Record<string, unknown>
}

async function lockedPreview() {
  return JSON.parse(await readFile(previewPath, 'utf8')) as Record<string, unknown>
}

async function proofManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>
}

async function signedEnvelopeBundle() {
  return JSON.parse(await readFile(fixturesPath, 'utf8')) as {
    signed_envelopes: { envelopes: SignedEnvelope[]; example_downstream_policy_note: string }
  }
}

function registrySignerEntry(manifest: Record<string, unknown>, address: string): Record<string, unknown> {
  const registry = manifest.signer_registry as Record<string, Record<string, unknown>>
  const key = Object.keys(registry).find((candidate) => candidate.toLowerCase() === address.toLowerCase())
  assert.ok(key)
  return registry[key]
}

function payableAddressService(manifest: Record<string, unknown>): Record<string, unknown> {
  const services = manifest.services as Array<Record<string, unknown>>
  const matches = services.filter((service) => service.name === 'payable-address')
  assert.equal(matches.length, 1)
  return matches[0]
}

test('pins IllWar’s expanded public signed-envelope bundle by its declared digest', async () => {
  const bytes = await readFile(fixturesPath)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), FIXTURE_BUNDLE_SHA256)
})

test('pins the provider schema and refuses to silently widen its versioned contract', async () => {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as { description: string; properties: Record<string, { const?: unknown }>; required: string[] }
  assert.equal(schema.properties.address_schema_version.const, 1)
  assert.equal(schema.properties.freshness_bound_seconds.const, 60)
  assert.ok(schema.required.includes('signature'))
  assert.ok(schema.required.includes('limitations'))
  assert.match(schema.description, /ensure_ascii=True/)
  assert.match(schema.description, /EIP-191 personal_sign/)
})

test('all four frozen envelopes verify end to end and reach only their governed pre-money outcome', async () => {
  const bundle = await signedEnvelopeBundle()
  const manifestBytes = await readFile(manifestPath)
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as Record<string, unknown>
  const manifestDigest = createHash('sha256').update(manifestBytes).digest('hex')
  assert.equal(manifestDigest, PROOF_MANIFEST_SHA256)
  assert.deepEqual(bundle.signed_envelopes.envelopes.map((envelope) => envelope.case), [
    'known_eoa',
    'plain_contract',
    'eip1967_proxy',
    'genuine_transfer_revert',
  ])
  assert.match(bundle.signed_envelopes.example_downstream_policy_note, /ILLUSTRATIVE/)

  const expectedDecision = new Map([
    ['known_eoa', ['approved_for_pre_money_progress', 'signed_fresh_eoa_direct_recipient']],
    ['plain_contract', ['review_required', 'contract_recipient_path_not_established']],
    ['eip1967_proxy', ['review_required', 'contract_recipient_path_not_established']],
    ['genuine_transfer_revert', ['denied', 'transfer_path_reverted']],
  ])

  for (const envelope of bundle.signed_envelopes.envelopes) {
    const signedPayload = { ...envelope.response }
    delete signedPayload.signature
    delete signedPayload.signed_by
    assert.equal(payableAddressCanonicalJson(signedPayload), envelope.canonical_body)
    assert.equal(createHash('sha256').update(envelope.canonical_body).digest('hex'), envelope.canonical_sha256)
    assert.equal(envelope.proof_manifest.sha256, manifestDigest)
    assert.equal(envelope.proof_manifest.url, PAYABLE_ADDRESS_MANIFEST_PIN.manifestUrl)
    assert.equal(envelope.proof_manifest.version, manifest.schema_version)
    assert.equal(envelope.proof_manifest.generated_at, manifest.generated_at)
    assert.equal(envelope.input.chain, 'base')
    assert.equal(envelope.input.token, null)
    assert.equal(envelope.response.address, envelope.input.address)
    assert.equal(envelope.response.classification, envelope.expected.classification)
    assert.equal(envelope.response.code_present, envelope.expected.code_present)
    assert.equal(envelope.response.proxy_indication, envelope.expected.proxy_indication)
    assert.equal(envelope.response.direct_recipient_plausibility, envelope.expected.direct_recipient_plausibility)
    const transferPath = envelope.response.transfer_path as Record<string, unknown>
    assert.equal(transferPath.result, envelope.expected.transfer_path_result)
    assert.equal(transferPath.revert_reason, envelope.expected.transfer_path_revert_reason)

    const outcome = await evaluatePayableAddressPreflight(envelope.response, {
      address: envelope.input.address,
      now: new Date(envelope.evaluation_time),
      signerManifest: manifest,
    })
    const expected = expectedDecision.get(envelope.case)
    assert.ok(expected)
    assert.equal(outcome.decision, expected[0])
    assert.deepEqual(outcome.reasonCodes, [expected[1]])
    assert.equal(outcome.manifestPinned, true)
    assert.equal(outcome.signatureVerified, true)

    const wrapperOutcome = await evaluatePayableAddressPreflight(envelope, {
      address: envelope.input.address,
      now: new Date(envelope.evaluation_time),
      signerManifest: manifest,
    })
    assert.equal(wrapperOutcome.decision, 'denied')
    assert.deepEqual(wrapperOutcome.reasonCodes, ['unknown_response_field'])
  }
})

test('every frozen envelope fails closed after a signed policy field is tampered with', async () => {
  const bundle = await signedEnvelopeBundle()
  const manifest = await proofManifest()
  for (const envelope of bundle.signed_envelopes.envelopes) {
    const tampered = structuredClone(envelope.response)
    if (envelope.case === 'genuine_transfer_revert') {
      ;(tampered.transfer_path as Record<string, unknown>).result = 'simulated_ok'
    } else {
      tampered.classification = tampered.classification === 'eoa' ? 'contract' : 'eoa'
    }
    const outcome = await evaluatePayableAddressPreflight(tampered, {
      address: envelope.input.address,
      now: new Date(envelope.evaluation_time),
      signerManifest: manifest,
    })
    assert.equal(outcome.decision, 'denied')
    assert.deepEqual(outcome.reasonCodes, ['signature_invalid'])
    assert.equal(outcome.signatureVerified, false)
  }
})

test('locked preview verifies its provider signature through the pinned proof manifest and approves only pre-money progress', async () => {
  const outcome = await evaluatePayableAddressPreflight(await lockedPreview(), {
    address: ADDRESS,
    now: NOW,
    preview: true,
    signerManifest: await proofManifest(),
  })
  assert.equal(outcome.decision, 'approved_for_pre_money_progress')
  assert.equal(outcome.manifestPinned, true)
  assert.equal(outcome.signatureVerified, true)
  assert.deepEqual(outcome.reasonCodes, ['signed_fresh_eoa_direct_recipient'])
})

test('the signature covers the evaluated classification rather than a self-asserted response', async () => {
  const response = await lockedPreview()
  response.classification = 'contract'
  const outcome = await evaluatePayableAddressPreflight(response, {
    address: ADDRESS, now: NOW, preview: true, signerManifest: await proofManifest(),
  })
  assert.equal(outcome.decision, 'denied')
  assert.deepEqual(outcome.reasonCodes, ['signature_invalid'])
})

test('stale, unannounced, unknown and unestablished responses cannot advance to a paid test', async () => {
  const stale = await lockedPreview()
  assert.equal((await evaluatePayableAddressPreflight(stale, { address: ADDRESS, now: new Date('2026-08-29T15:54:15Z'), preview: true, signerManifest: await proofManifest() })).decision, 'denied')

  const manifestWithNewSigner = await proofManifest()
  const signer = payableAddressService(manifestWithNewSigner)
  signer.signer = NEW_SIGNER
  ;(manifestWithNewSigner.signer_registry as Record<string, unknown>)[NEW_SIGNER] = {
    services: ['payable-address'], status: 'active', valid_from: null, valid_until: null,
  }
  const unannounced = await lockedPreview()
  const outcome = await evaluatePayableAddressPreflight(unannounced, { address: ADDRESS, now: NOW, preview: true, signerManifest: manifestWithNewSigner })
  assert.equal(outcome.decision, 'denied')
  assert.deepEqual(outcome.reasonCodes, ['manifest_signer_inactive_unannounced_or_service_mismatched'])

  const extra = await lockedPreview()
  extra.undeclared = true
  assert.equal((await evaluatePayableAddressPreflight(extra, { address: ADDRESS, now: NOW, preview: true, signerManifest: await proofManifest() })).decision, 'denied')
})

test('a response signer which is not the manifest-pinned signer fails closed before crypto verification', async () => {
  const response = await lockedPreview()
  response.signed_by = '0x0000000000000000000000000000000000000001'
  const outcome = await evaluatePayableAddressPreflight(response, { address: ADDRESS, now: NOW, preview: true, signerManifest: await proofManifest() })
  assert.equal(outcome.decision, 'denied')
  assert.deepEqual(outcome.reasonCodes, ['unannounced_signer_change'])
  assert.equal(outcome.signatureVerified, false)
})

test('an announced rotation is accepted only inside its published registry boundaries', async () => {
  const manifest = await proofManifest()
  const registry = manifest.signer_registry as Record<string, Record<string, unknown>>
  registrySignerEntry(manifest, PAYABLE_ADDRESS_PREVIEW_SIGNER).valid_until = '2026-08-23T04:30:00.000Z'
  registry[NEW_SIGNER] = {
    services: ['payable-address'], status: 'active', valid_from: '2026-08-23T04:29:00.000Z', valid_until: null,
  }
  payableAddressService(manifest).signer = NEW_SIGNER
  ;(manifest.signer_rotations as unknown[]).push({
    address_old: PAYABLE_ADDRESS_PREVIEW_SIGNER,
    address_new: NEW_SIGNER,
    old_valid_until: '2026-08-23T04:30:00.000Z',
    new_valid_from: '2026-08-23T04:29:00.000Z',
    services: ['payable-address'],
    announced_at: '2026-08-23T04:20:00.000Z',
  })

  const duringOverlap = resolvePayableAddressManifestSigner(manifest, PAYABLE_ADDRESS_MANIFEST_PIN, ROTATION_NOW)
  assert.ok('signerAddresses' in duringOverlap)
  assert.deepEqual(duringOverlap.signerAddresses.map((address) => address.toLowerCase()).sort(), [NEW_SIGNER, PAYABLE_ADDRESS_PREVIEW_SIGNER].sort())
  assert.deepEqual(
    resolvePayableAddressManifestSigner(manifest, PAYABLE_ADDRESS_MANIFEST_PIN, new Date('2026-08-23T04:28:59.000Z')),
    { error: 'manifest_signer_inactive_unannounced_or_service_mismatched' },
  )
})

test('inactive, expired, service-mismatched and malformed registry records fail closed', async () => {
  const inactive = await proofManifest()
  registrySignerEntry(inactive, PAYABLE_ADDRESS_PREVIEW_SIGNER).status = 'retired'
  assert.deepEqual(resolvePayableAddressManifestSigner(inactive, PAYABLE_ADDRESS_MANIFEST_PIN, NOW), { error: 'manifest_signer_inactive_unannounced_or_service_mismatched' })

  const expired = await proofManifest()
  registrySignerEntry(expired, PAYABLE_ADDRESS_PREVIEW_SIGNER).valid_until = '2026-08-23T04:29:00.000Z'
  assert.deepEqual(resolvePayableAddressManifestSigner(expired, PAYABLE_ADDRESS_MANIFEST_PIN, NOW), { error: 'manifest_signer_inactive_unannounced_or_service_mismatched' })

  const wrongService = await proofManifest()
  registrySignerEntry(wrongService, PAYABLE_ADDRESS_PREVIEW_SIGNER).services = ['payable']
  assert.deepEqual(resolvePayableAddressManifestSigner(wrongService, PAYABLE_ADDRESS_MANIFEST_PIN, NOW), { error: 'manifest_signer_inactive_unannounced_or_service_mismatched' })

  const malformedRotation = await proofManifest()
  ;(malformedRotation.signer_rotations as unknown[]).push({ address_old: PAYABLE_ADDRESS_PREVIEW_SIGNER })
  assert.deepEqual(resolvePayableAddressManifestSigner(malformedRotation, PAYABLE_ADDRESS_MANIFEST_PIN, NOW), { error: 'invalid_signer_rotation' })

  const duplicateAddress = await proofManifest()
  ;(duplicateAddress.signer_registry as Record<string, unknown>)[PAYABLE_ADDRESS_PREVIEW_SIGNER] = {
    services: ['payable-address'], status: 'active', valid_from: null, valid_until: null,
  }
  assert.deepEqual(resolvePayableAddressManifestSigner(duplicateAddress, PAYABLE_ADDRESS_MANIFEST_PIN, NOW), { error: 'ambiguous_signer_registry' })

  const duplicateService = await proofManifest()
  ;(duplicateService.services as unknown[]).push({ name: 'payable-address', base_url: 'https://payable.nsgoods.org', signer: PAYABLE_ADDRESS_PREVIEW_SIGNER })
  assert.deepEqual(resolvePayableAddressManifestSigner(duplicateService, PAYABLE_ADDRESS_MANIFEST_PIN, NOW), { error: 'payable_service_missing_or_ambiguous' })
})

test('the local pin is fixed to the public proof manifest rather than a response-provided signer', () => {
  assert.equal(PAYABLE_ADDRESS_MANIFEST_PIN.signerAddress.toLowerCase(), PAYABLE_ADDRESS_PREVIEW_SIGNER)
  assert.equal(PAYABLE_ADDRESS_MANIFEST_PIN.manifestUrl, 'https://x402.nsgoods.org/proof/index.json')
  assert.equal(PAYABLE_ADDRESS_MANIFEST_PIN.service, 'payable-address')
})

test('the canonical serializer retains Python json.dumps ASCII escaping required by the provider signature contract', () => {
  assert.equal(payableAddressCanonicalJson({ title: 'Ceylon — tea', z: 1 }), '{"title":"Ceylon \\u2014 tea","z":1}')
})
