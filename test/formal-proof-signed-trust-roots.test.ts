import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { FORMAL_PROOF_FIXTURE_DOSSIER } from '../lib/evidence-dossier/formal-proof-fixture.ts'
import {
  SIGNING_KEY_REGISTRY,
  SYNTHETIC_REVOKED_KEY_ID,
  SYNTHETIC_REVOKED_KEY_SEED_HEX,
  SYNTHETIC_TEST_KEY_ID,
  SYNTHETIC_TEST_KEY_SEED_HEX,
  currentAuthorityEpoch,
  resolveSigningKey,
  type SigningKeyEntry,
} from '../lib/evidence-dossier/formal-proof-signing-keys.ts'
import {
  rawPublicKeyBase64,
  signTrustRoot,
  signingBytes,
  verifyTrustRootSignature,
  type SignedTrustRootEnvelope,
  type TrustRootPayload,
} from '../lib/evidence-dossier/formal-proof-signing.ts'
import { checkTrustRootSignature, loadSignedTrustRoot, trustRootFromEnvelope } from '../lib/evidence-dossier/formal-proof-trust-roots.ts'
import { checkBindingAuthority } from '../packages/evidence-dossier-builder/src/formal-proof-verification.ts'
import { bindingManifestDigest, type BindingManifest } from '../packages/maha-lean-bridge/src/bindings.ts'
import { manifestDigest } from '../packages/maha-lean-bridge/src/verifier.ts'
import type { ProofManifest } from '../packages/maha-lean-bridge/src/schema.ts'

const BRIDGE = resolve(import.meta.dirname, '../packages/maha-lean-bridge')
const PROOF_MANIFEST = JSON.parse(readFileSync(join(BRIDGE, 'fixtures/formal-proof-manifest.json'), 'utf8')) as ProofManifest
const BINDINGS = JSON.parse(readFileSync(join(BRIDGE, 'fixtures/formal-claim-bindings.json'), 'utf8')) as BindingManifest
const TOOLCHAIN = readFileSync(join(BRIDGE, 'lean-toolchain'), 'utf8').trim()
const DOSSIER = FORMAL_PROOF_FIXTURE_DOSSIER.dossierId

const SEED = Buffer.from(SYNTHETIC_TEST_KEY_SEED_HEX, 'hex')
const REVOKED_SEED = Buffer.from(SYNTHETIC_REVOKED_KEY_SEED_HEX, 'hex')

const payload = (overrides: Partial<TrustRootPayload> = {}): TrustRootPayload => ({
  dossierId: DOSSIER,
  bindingManifestSha256: bindingManifestDigest(BINDINGS),
  bindingManifestRevision: BINDINGS.revision,
  proofManifestSha256: manifestDigest(PROOF_MANIFEST),
  authorizedClaimIds: ['clm_interval_composition'],
  authorizedTheorems: ['Maha.Interval.add_mem', 'Maha.Interval.add_valid'],
  authorizedCalculationOperationIds: ['interval-add'],
  toolchain: TOOLCHAIN,
  authorityEpoch: 2,
  validity: { kind: 'non-expiring-test-fixture', reason: 'internal fixture' },
  ...overrides,
})

const signed = (overrides: Partial<TrustRootPayload> = {}) => signTrustRoot(payload(overrides), SEED, SYNTHETIC_TEST_KEY_ID)

/** Every refusal must be unambiguous: authentic false and a named code. */
function assertRefused(check: ReturnType<typeof checkTrustRootSignature>, code: string) {
  assert.equal(check.authentic, false, `expected refusal for ${code}`)
  assert.ok(check.failures.includes(code as never), `expected ${code}, got ${check.failures.join(',') || 'none'}`)
}

// ------------------------------------------------------------- honest path

test('the committed envelope verifies against the committed registry', () => {
  const envelope = loadSignedTrustRoot(resolve(import.meta.dirname, '../content/evidence-dossier/formal-proof-trust-root.json'))
  assert.ok(envelope, 'the signed trust root must be committed')
  const check = checkTrustRootSignature(envelope, DOSSIER)
  assert.deepEqual(check.failures, [])
  assert.equal(check.authentic, true)
  assert.equal(check.keyId, SYNTHETIC_TEST_KEY_ID)
})

test('signing is deterministic across runs', () => {
  // Ed25519 has no random nonce, so identical input yields identical bytes.
  // A randomized scheme would put a varying field inside otherwise
  // byte-reproducible material.
  assert.equal(signed().signature.value, signed().signature.value)
  assert.equal(Buffer.from(signed().signature.value, 'base64').byteLength, 64)
})

test('canonical signing bytes are stable and platform-independent', () => {
  // Key order in the source object must not change the signed bytes, or macOS
  // and Linux could sign different material for identical content.
  const reordered = { ...payload() }
  const shuffled = Object.fromEntries(Object.entries(reordered).reverse()) as unknown as TrustRootPayload
  assert.equal(signingBytes(payload()).toString('utf8'), signingBytes(shuffled).toString('utf8'))
  assert.equal(/\/Users\/|\/home\//.test(signingBytes(payload()).toString('utf8')), false)
})

// ------------------------------------------------------ adversarial: envelope

test('an unsigned trust root is refused', () => {
  assertRefused(checkTrustRootSignature(undefined, DOSSIER), 'signature-envelope-missing')
  const unsigned = { schemaVersion: signed().schemaVersion, payload: payload() } as unknown as SignedTrustRootEnvelope
  assertRefused(checkTrustRootSignature(unsigned, DOSSIER), 'signature-envelope-malformed')
})

test('an altered payload is refused', () => {
  for (const mutation of [
    { authorizedTheorems: ['Maha.Angle.normalize_idempotent'] },
    { authorizedClaimIds: ['clm_smuggled'] },
    { authorizedCalculationOperationIds: ['thermal-resistance'] },
    { bindingManifestSha256: `sha256:${'0'.repeat(64)}` },
    { proofManifestSha256: `sha256:${'0'.repeat(64)}` },
    { bindingManifestRevision: 99 },
    { toolchain: 'leanprover/lean4:v4.0.0' },
  ]) {
    const forged = { ...signed(), payload: payload(mutation) }
    assertRefused(checkTrustRootSignature(forged, DOSSIER), 'signature-invalid')
  }
})

test('an altered signature is refused', () => {
  const envelope = signed()
  const bytes = Buffer.from(envelope.signature.value, 'base64')
  bytes[0] ^= 1
  const tampered = { ...envelope, signature: { ...envelope.signature, value: bytes.toString('base64') } }
  assertRefused(checkTrustRootSignature(tampered, DOSSIER), 'signature-invalid')
})

test('a truncated or oversized signature is refused', () => {
  for (const value of ['', 'AAAA', Buffer.alloc(63).toString('base64'), Buffer.alloc(65).toString('base64')]) {
    const tampered = { ...signed(), signature: { ...signed().signature, value } }
    assertRefused(checkTrustRootSignature(tampered, DOSSIER), 'signature-invalid')
  }
})

test('a valid signature over the wrong dossier is refused', () => {
  // The signature is genuine; the payload authorizes a different dossier.
  const otherDossier = signed({ dossierId: 'dos_some_other_dossier' })
  assert.equal(verifyTrustRootSignature(otherDossier, rawPublicKeyBase64(SEED)), true, 'signature itself is valid')
  assertRefused(checkTrustRootSignature(otherDossier, DOSSIER), 'signature-dossier-mismatch')
})

test('a valid signature over substituted theorem, claim or operation sets is caught by authorization', () => {
  // Signing a different authorization produces a genuine signature over the
  // wrong facts. Authenticity holds and must hold — the separation of the two
  // verdicts is the point — so authorization is what has to refuse it.
  for (const mutation of [
    { authorizedTheorems: ['Maha.Angle.normalize_idempotent'] },
    { authorizedClaimIds: ['clm_smuggled'] },
    { authorizedCalculationOperationIds: ['thermal-resistance'] },
  ]) {
    const envelope = signed(mutation)
    assert.equal(checkTrustRootSignature(envelope, DOSSIER).authentic, true, 'signature over wrong facts is still authentic')

    const authority = checkBindingAuthority(
      trustRootFromEnvelope(envelope),
      BINDINGS,
      PROOF_MANIFEST,
      [],
      DOSSIER,
    )
    assert.ok(authority.length > 0, `authorization must refuse ${JSON.stringify(mutation)}`)
    assert.ok(
      authority.some((f) => f.includes('unauthorized')),
      authority.join(','),
    )
  }
})

// ----------------------------------------------------------- adversarial: keys

test('a package-supplied substitute key is never accepted as authority', () => {
  // The attacker signs their own authorization with their own key and ships the
  // public half. The registry is consulted by id, so their key is never used.
  const attackerSeed = Buffer.alloc(32, 0x41)
  const forged = signTrustRoot(payload({ authorizedTheorems: ['Maha.Fake.kernel_is_correct'] }), attackerSeed, SYNTHETIC_TEST_KEY_ID)
  const withKey = { ...forged, publicKey: rawPublicKeyBase64(attackerSeed) } as unknown as SignedTrustRootEnvelope
  assertRefused(checkTrustRootSignature(withKey, DOSSIER), 'signature-invalid')
  // It would verify under the attacker's key, which is precisely why the
  // envelope is not allowed to nominate one.
  assert.equal(verifyTrustRootSignature(forged, rawPublicKeyBase64(attackerSeed)), true)
})

test('an unknown key id is refused', () => {
  const envelope = signTrustRoot(payload(), SEED, 'no-such-key/v1')
  assertRefused(checkTrustRootSignature(envelope, DOSSIER), 'signature-key-unknown')
})

test('a revoked key is refused even with a valid signature', () => {
  const envelope = signTrustRoot(payload({ authorityEpoch: 1 }), REVOKED_SEED, SYNTHETIC_REVOKED_KEY_ID)
  assert.equal(verifyTrustRootSignature(envelope, rawPublicKeyBase64(REVOKED_SEED)), true, 'signature is genuine')
  assertRefused(checkTrustRootSignature(envelope, DOSSIER), 'signature-key-revoked')
})

test('a stale authority epoch is refused', () => {
  // The key is active and the signature genuine, but the payload claims an
  // epoch the key does not sign for: a replayed pre-rotation authorization.
  const envelope = signed({ authorityEpoch: 1 })
  assertRefused(checkTrustRootSignature(envelope, DOSSIER), 'signature-epoch-stale')
})

test('a key signing for a superseded epoch is refused', () => {
  const registry: SigningKeyEntry[] = [
    { keyId: 'k/v1', publicKey: rawPublicKeyBase64(SEED), status: 'active', epoch: 1, note: 'old', syntheticTestKey: true },
    { keyId: 'k/v2', publicKey: rawPublicKeyBase64(REVOKED_SEED), status: 'active', epoch: 2, note: 'new', syntheticTestKey: true },
  ]
  const envelope = signTrustRoot(payload({ authorityEpoch: 1 }), SEED, 'k/v1')
  assertRefused(checkTrustRootSignature(envelope, DOSSIER, { registry }), 'signature-key-epoch-stale')
})

test('duplicate registry entries are ambiguous and refused', () => {
  const entry = SIGNING_KEY_REGISTRY.find((k) => k.keyId === SYNTHETIC_TEST_KEY_ID)!
  const registry = [entry, { ...entry }]
  assertRefused(checkTrustRootSignature(signed(), DOSSIER, { registry }), 'signature-key-ambiguous')
  assert.throws(() => resolveSigningKey(SYNTHETIC_TEST_KEY_ID, registry), /Ambiguous/)
})

test('a malformed registry public key is refused', () => {
  const entry = SIGNING_KEY_REGISTRY.find((k) => k.keyId === SYNTHETIC_TEST_KEY_ID)!
  const registry = [{ ...entry, publicKey: 'not-base64!!' }]
  assertRefused(checkTrustRootSignature(signed(), DOSSIER, { registry }), 'signature-key-malformed')
})

test('an empty registry authorizes nothing', () => {
  assertRefused(checkTrustRootSignature(signed(), DOSSIER, { registry: [] }), 'signature-key-unknown')
})

// ------------------------------------------------------ adversarial: validity

test('an expired window is refused', () => {
  const envelope = signed({ validity: { kind: 'window', notBefore: '2020-01-01T00:00:00Z', notAfter: '2020-12-31T00:00:00Z' } })
  assertRefused(checkTrustRootSignature(envelope, DOSSIER, { now: new Date('2026-08-30T00:00:00Z') }), 'signature-expired')
})

test('a not-yet-valid window is refused', () => {
  const envelope = signed({ validity: { kind: 'window', notBefore: '2099-01-01T00:00:00Z', notAfter: '2099-12-31T00:00:00Z' } })
  assertRefused(checkTrustRootSignature(envelope, DOSSIER, { now: new Date('2026-08-30T00:00:00Z') }), 'signature-not-yet-valid')
})

test('a window in force is accepted', () => {
  const envelope = signed({ validity: { kind: 'window', notBefore: '2026-01-01T00:00:00Z', notAfter: '2027-01-01T00:00:00Z' } })
  const check = checkTrustRootSignature(envelope, DOSSIER, { now: new Date('2026-08-30T00:00:00Z') })
  assert.deepEqual(check.failures, [])
})

test('a root with neither a window nor fixture status is refused', () => {
  const envelope = signed({ validity: { kind: 'perpetual' } as unknown as TrustRootPayload['validity'] })
  assertRefused(checkTrustRootSignature(envelope, DOSSIER), 'signature-envelope-malformed')
})

// ------------------------------------------------------------ key hygiene

test('the registry contains only synthetic keys and no private material', () => {
  assert.equal(SIGNING_KEY_REGISTRY.every((key) => key.syntheticTestKey), true)
  assert.equal(currentAuthorityEpoch(), 2)
  const source = readFileSync(resolve(import.meta.dirname, '../lib/evidence-dossier/formal-proof-signing-keys.ts'), 'utf8')
  // The only seeds present are the two published fixture constants, and both
  // are named so they cannot be mistaken for production material.
  const seeds = source.match(/^\s*'[0-9a-f]{64}'$/gm) ?? []
  assert.equal(seeds.length, 2, 'only the two published fixture seeds may appear')
  assert.match(source, /DO-NOT-USE-IN-PRODUCTION/)
  assert.equal(/BEGIN (RSA |EC )?PRIVATE KEY/.test(source), false, 'no PEM private key may be committed')
})

test('the committed envelope authorizes only the internal fixture', () => {
  const envelope = loadSignedTrustRoot(resolve(import.meta.dirname, '../content/evidence-dossier/formal-proof-trust-root.json'))!
  assert.equal(envelope.payload.dossierId, DOSSIER)
  assert.match(envelope.payload.dossierId, /internal|fixture/)
  assert.equal(envelope.payload.validity.kind, 'non-expiring-test-fixture')
  assert.match(envelope.signature.keyId, /DO-NOT-USE-IN-PRODUCTION/)
})

test('assurance vocabulary appears only in negated form', () => {
  // "Empirically validated: no" is the safeguard, not a claim, so the guard
  // cannot simply ban the words. It bans them as assertions: every occurrence
  // in rendered output must be immediately negated.
  const rendered = [
    readFileSync(resolve(import.meta.dirname, '../packages/evidence-dossier-builder/src/pdf.ts'), 'utf8'),
    readFileSync(resolve(import.meta.dirname, '../packages/evidence-dossier-builder/src/jsonld.ts'), 'utf8'),
  ].join('\n')
  for (const term of ['Empirically validated', 'Scientific model certified', 'Compiler equivalence\\s*\\n?\\s*proven']) {
    const matches = rendered.match(new RegExp(`${term}[^.]{0,24}`, 'gi')) ?? []
    for (const match of matches) {
      assert.match(match, /:\s*\$\{|:\s*no|:\s*false/i, `"${match}" must be negated or bound to a false value`)
    }
  }
  // The affirmative forms must never appear as prose anywhere.
  for (const forbidden of ['is empirically validated', 'is scientifically proven', 'has been certified']) {
    assert.equal(new RegExp(forbidden, 'i').test(rendered), false, forbidden)
  }
})
