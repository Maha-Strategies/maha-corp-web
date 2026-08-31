import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import {
  SIGNING_KEY_REGISTRY,
  SYNTHETIC_FIXTURE_AUTHORITY_ID,
  SYNTHETIC_TEST_KEY_ID,
  SYNTHETIC_TEST_KEY_SEED_HEX,
} from '../lib/evidence-dossier/formal-proof-signing-keys.ts'
import { signTrustRoot, type TrustRootPayload } from '../lib/evidence-dossier/formal-proof-signing.ts'
import { FORMAL_PROOF_FIXTURE_DOSSIER } from '../lib/evidence-dossier/formal-proof-fixture.ts'
import { bindingManifestDigest, type BindingManifest } from '../packages/maha-lean-bridge/src/bindings.ts'
import { manifestDigest } from '../packages/maha-lean-bridge/src/verifier.ts'
import { canonicalJson } from '../packages/maha-lean-bridge/src/canonicalize.ts'
import type { ProofManifest } from '../packages/maha-lean-bridge/src/schema.ts'

/**
 * Regenerates the signed trust-root envelope for the internal fixture.
 *
 * Signing with a published seed is only acceptable because this envelope
 * authorizes nothing outside the fixture. A production root would be signed
 * where the private key lives, by someone who cannot also merge to this
 * repository; see PRODUCTION_SIGNING_BOUNDARY.
 */

const BRIDGE = resolve('packages/maha-lean-bridge')
const proofManifest = JSON.parse(readFileSync(join(BRIDGE, 'fixtures/formal-proof-manifest.json'), 'utf8')) as ProofManifest
const bindingManifest = JSON.parse(readFileSync(join(BRIDGE, 'fixtures/formal-claim-bindings.json'), 'utf8')) as BindingManifest
const toolchain = readFileSync(join(BRIDGE, 'lean-toolchain'), 'utf8').trim()

const signingKey = SIGNING_KEY_REGISTRY.find((entry) => entry.keyId === SYNTHETIC_TEST_KEY_ID)!
if (!signingKey.scope.permittedDossierIds.includes(FORMAL_PROOF_FIXTURE_DOSSIER.dossierId)) {
  throw new Error('The signing key is not permitted to authorize this dossier.')
}

const payload: TrustRootPayload = {
  authorityId: SYNTHETIC_FIXTURE_AUTHORITY_ID,
  dossierId: FORMAL_PROOF_FIXTURE_DOSSIER.dossierId,
  bindingManifestSha256: bindingManifestDigest(bindingManifest),
  bindingManifestRevision: bindingManifest.revision,
  proofManifestSha256: manifestDigest(proofManifest),
  authorizedClaimIds: ['clm_interval_composition'],
  authorizedTheorems: ['Maha.Interval.add_mem', 'Maha.Interval.add_valid'],
  authorizedCalculationOperationIds: ['interval-add'],
  toolchain,
  authorityEpoch: signingKey.epoch,
  validity: {
    kind: 'non-expiring-test-fixture',
    reason: 'Authorizes only the internal interval-tolerance fixture, signed by a key whose seed is a published constant. A production root carries a bounded window instead.',
  },
}

const envelope = signTrustRoot(payload, Buffer.from(SYNTHETIC_TEST_KEY_SEED_HEX, 'hex'), SYNTHETIC_TEST_KEY_ID)
const target = resolve('content/evidence-dossier/formal-proof-trust-root.json')
writeFileSync(target, `${JSON.stringify(JSON.parse(canonicalJson(envelope)), null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ wrote: target, keyId: envelope.signature.keyId, epoch: payload.authorityEpoch }, null, 2)}\n`)
