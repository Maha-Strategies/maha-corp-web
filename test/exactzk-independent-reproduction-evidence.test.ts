import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const ROOT = join(import.meta.dirname, '..')
const ATTESTATION = join(ROOT, 'artifacts/integrations/exactzk-independent-reproduction-attestation-001.json')
const PUBLISHED_ATTESTATION = join(ROOT, 'public/artifacts/integrations/exactzk-independent-reproduction-attestation-001.json')
const RECORD = join(ROOT, 'artifacts/integrations/exactzk-independent-reproduction-record-2026-09-01.json')
const PUBLISHED_RECORD = join(ROOT, 'public/artifacts/integrations/exactzk-independent-reproduction-record-2026-09-01.json')

const sha256 = (value: Buffer) => createHash('sha256').update(value).digest('hex')

test('ExactZK attestation and evidence record are published byte-identically', () => {
  assert.deepEqual(readFileSync(PUBLISHED_ATTESTATION), readFileSync(ATTESTATION))
  assert.deepEqual(readFileSync(PUBLISHED_RECORD), readFileSync(RECORD))
})

test('ExactZK evidence pins the immutable upstream publication and bounded claim', () => {
  const attestationBytes = readFileSync(ATTESTATION)
  const attestation = JSON.parse(attestationBytes.toString('utf8'))
  const record = JSON.parse(readFileSync(RECORD, 'utf8'))

  assert.equal(sha256(attestationBytes), '39ef9f94bec3adf3a85c955ca40381a48c7d20e75afa613a18e600e8bbb8d009')
  assert.equal(record.integration.publicationCommit, 'a2bc90d0a33a548fbcae09bb1756a4fc31286f4a')
  assert.equal(record.integration.state, 'published')
  assert.equal(record.attestation.canonicalPayloadSha256, '978523dfd9d96b2d3a598d6f6db3389a0cb28b9a69d52171218f130b755af87f')
  assert.equal(record.verification.upstreamMaintainerReportedIndependentVerification.status, 'passed')
  assert.equal(record.verification.mahaSignatureReverification.status, 'passed')
  assert.equal(attestation.reproductionDate, '2026-08-31')
  assert.equal(attestation.proof.canonicalization, 'RFC8785')
  assert.equal(attestation.proof.proofPurpose, 'assertionMethod')
  assert.match(record.claimBoundary, /limited to the identified MNIST MLP circuit-provenance verifying-key digests/i)
  assert.ok(record.nonClaims.some((claim: string) => /does not validate the full escrow system/i.test(claim)))
  assert.ok(record.nonClaims.some((claim: string) => /test SRS is suitable for production use/i.test(claim)))
})

test('public ExactZK evidence contains no secret or local-path material', () => {
  const text = readFileSync(PUBLISHED_ATTESTATION, 'utf8') + readFileSync(PUBLISHED_RECORD, 'utf8')
  for (const forbidden of ['/Users/', '/private/tmp', 'PRIVATE KEY', 'Bearer ', 'CARP_AGENT_PRIVATE_KEY']) {
    assert.ok(!text.includes(forbidden), `public ExactZK evidence contains ${forbidden}`)
  }
})

