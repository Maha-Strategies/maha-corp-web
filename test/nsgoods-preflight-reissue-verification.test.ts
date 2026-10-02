import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { recoverMessageAddress } from 'viem'

const ROOT = resolve(import.meta.dirname, '..')
const ENVELOPE_PATH = resolve(
  ROOT,
  'fixtures/x402-composite-preflight-v3/reissues/preflight_v3_reissue_pf_be2a8c76d0e7dcc7.json',
)
const REPORT_PATH = resolve(
  ROOT,
  'public/artifacts/integrations/nsgoods-preflight-v3-reissue-validation-2026-09-03.json',
)
const VERIFIER_PATH = resolve(ROOT, 'scripts/verify-x402-composite-preflight-live.py')
const EXPECTED_SIGNER = '0x57fF0F084Cba33e6761503f90eEF0Da9F159350c'
const EXPECTED_SUBJECT = {
  address: '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28',
  chain: 'eip155:8453',
  role: 'payee',
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

function canonicalJson(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

test('the provider re-issue is preserved byte-for-byte', () => {
  const bytes = readFileSync(ENVELOPE_PATH)
  assert.equal(bytes.length, 3_673)
  assert.equal(sha256(bytes), '01f3e1f8a6dd85f5a68b41f330591f42067d382ef9cf74d26f75790661c50f8f')
})

test('every component digest and signature verifies independently', async () => {
  const envelope = JSON.parse(readFileSync(ENVELOPE_PATH, 'utf8'))
  assert.deepEqual(envelope.request.subject, EXPECTED_SUBJECT)
  assert.equal(envelope.request.request_id, 'pf_be2a8c76d0e7dcc7')
  assert.equal(envelope.components_evaluated, 3)

  for (const component of envelope.components) {
    const { component_digest: digest, component_signature: signature, ...signed } = component
    assert.equal(sha256(canonicalJson(signed)), digest, `${component.component} digest`)
    assert.equal(
      await recoverMessageAddress({ message: canonicalJson(signed), signature }),
      EXPECTED_SIGNER,
      `${component.component} signer`,
    )
    assert.deepEqual(component.subject_echo, EXPECTED_SUBJECT)
    assert.equal(component.manifest.url, 'https://x402.nsgoods.org/proof/index.json')
    assert.equal(component.manifest.entry, 'preflight')
  }
})

test('the pinned manifest independently authorizes the recovered signer', () => {
  const manifest = JSON.parse(
    readFileSync(resolve(ROOT, 'fixtures/x402-composite-preflight-v3/proof-index.json'), 'utf8'),
  )
  const registry = manifest.signer_registry[EXPECTED_SIGNER]
  const services = manifest.services.filter((service: { name: string }) => service.name === 'preflight')
  assert.equal(registry.status, 'active')
  assert.ok(registry.services.includes('preflight'))
  assert.equal(services.length, 1)
  assert.equal(services[0].signer, EXPECTED_SIGNER)
  assert.match(services[0].schema, /preflight_v3/)
})

test('the whole-envelope signature and declared observation spread verify', async () => {
  const envelope = JSON.parse(readFileSync(ENVELOPE_PATH, 'utf8'))
  const signature = envelope.envelope.signature
  delete envelope.envelope.signature
  assert.equal(await recoverMessageAddress({ message: canonicalJson(envelope), signature }), EXPECTED_SIGNER)

  const observed = envelope.components.map((component: { observed_at: string }) => Date.parse(component.observed_at))
  assert.deepEqual(observed, [...observed].sort((a, b) => a - b))
  assert.equal(Math.round(Math.max(...observed) - Math.min(...observed)), envelope.observation.spread_ms)
  assert.ok(observed.every((value: number) => value <= Date.parse(envelope.request.request_time)))
})

test('mutations fail the signed boundaries', async () => {
  const original = JSON.parse(readFileSync(ENVELOPE_PATH, 'utf8'))
  const componentMutation = structuredClone(original)
  componentMutation.components[0].verdict = 'NOT_PAYABLE'
  const { component_digest: digest, component_signature: signature, ...signed } = componentMutation.components[0]
  assert.notEqual(sha256(canonicalJson(signed)), digest)
  assert.notEqual(await recoverMessageAddress({ message: canonicalJson(signed), signature }), EXPECTED_SIGNER)

  const envelopeMutation = structuredClone(original)
  envelopeMutation.unexpected = true
  const envelopeSignature = envelopeMutation.envelope.signature
  delete envelopeMutation.envelope.signature
  assert.notEqual(
    await recoverMessageAddress({ message: canonicalJson(envelopeMutation), signature: envelopeSignature }),
    EXPECTED_SIGNER,
  )
})

test('the sanitized report cannot be mistaken for a paid canary', () => {
  const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8'))
  assert.equal(report.status, 'passed')
  assert.equal(report.sourceArtifact.sha256, '01f3e1f8a6dd85f5a68b41f330591f42067d382ef9cf74d26f75790661c50f8f')
  assert.equal(report.verification.componentSignatures, 3)
  assert.equal(report.verification.envelopeSignatures, 1)
  assert.equal(report.boundary.networkCallsMadeByVerifier, 0)
  assert.equal(report.boundary.paymentsMade, 0)
  assert.equal(report.boundary.credentialsUsed, false)
  assert.equal(report.boundary.settlementEvidenceIncluded, false)
  assert.equal(report.boundary.isPaidLiveImplementationCanary, false)
  assert.equal(report.boundary.assertsOriginalPaidResponseContents, false)
})

test('the envelope CLI is a local read-only path', () => {
  const verifier = readFileSync(VERIFIER_PATH, 'utf8')
  assert.match(verifier, /mode\.add_argument\("--envelope"/)
  assert.match(verifier, /--envelope is read-only and cannot be combined with --payment or --manifest/)
  assert.doesNotMatch(verifier, /\b(?:requests|urllib|httpx|aiohttp)\b/)
  assert.doesNotMatch(verifier, /subprocess|os\.system|urlopen/)
})
