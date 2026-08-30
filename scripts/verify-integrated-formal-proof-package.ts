import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { FORMAL_PROOF_FIXTURE_CLAIM_ID, FORMAL_PROOF_FIXTURE_DOSSIER } from '../lib/evidence-dossier/formal-proof-fixture.ts'
import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { attachRuntimeWitnessToDossier, type ComputationalWitnessReceipt } from '../lib/evidence-dossier/runtime-witness.ts'
import { compileIntegratedPackage, verifyIntegratedCalculationEvidence } from '../packages/evidence-dossier-builder/src/index.ts'
import { expectedLeanSources, REQUIRED_PROJECT_FILES } from '../packages/evidence-dossier-builder/src/formal-proof-verification.ts'
import { normalizeSourceText } from '../packages/maha-lean-bridge/src/canonicalize.ts'
import { compileFromBinding } from '../packages/maha-lean-bridge/src/compiler.ts'
import { resolveActualLeanVersion, verifyAttachments } from '../packages/maha-lean-bridge/src/verifier.ts'
import { checkTrustRootSignature, loadSignedTrustRoot } from '../lib/evidence-dossier/formal-proof-trust-roots.ts'
import { isSyntheticKey, resolveSigningKey } from '../lib/evidence-dossier/formal-proof-signing-keys.ts'
import type { BindingManifest } from '../packages/maha-lean-bridge/src/bindings.ts'
import type { ProofManifest } from '../packages/maha-lean-bridge/src/schema.ts'
import { executeAndAttachCalculationToDossier } from '../packages/wasm-kernel/dist/dossier.js'
import type { KernelArtifact } from '../packages/wasm-kernel/dist/execution.js'

/**
 * Builds and verifies the integrated fixture package with the real toolchain.
 *
 * This is the check that matters in CI: the standalone bridge building is not
 * evidence that a dossier package's proofs recheck. Here the package is
 * generated twice, compared byte for byte, and then verified through the
 * production path — which runs the pinned Lean against the sources the package
 * itself carries, and fails closed if Lean is missing.
 */

const BRIDGE = resolve('packages/maha-lean-bridge')
const PROOF_MANIFEST = JSON.parse(readFileSync(join(BRIDGE, 'fixtures/formal-proof-manifest.json'), 'utf8')) as ProofManifest
const BINDINGS = JSON.parse(readFileSync(join(BRIDGE, 'fixtures/formal-claim-bindings.json'), 'utf8')) as BindingManifest
const TOOLCHAIN = readFileSync(join(BRIDGE, 'lean-toolchain'), 'utf8').trim()

const kernel: KernelArtifact = {
  bytes: readFileSync(resolve('packages/wasm-kernel/dist/kernel.wasm')),
  manifest: JSON.parse(readFileSync(resolve('packages/wasm-kernel/conformance/kernel-manifest.json'), 'utf8')),
}

function leanSources(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const path of REQUIRED_PROJECT_FILES) {
    out[path] = normalizeSourceText(readFileSync(join(BRIDGE, path), 'utf8'))
  }
  // Every module the root imports, not only the ones holding theorems: a
  // definitions-only module is still required for the build to succeed.
  for (const path of expectedLeanSources(PROOF_MANIFEST, out['Maha.lean'])) {
    out[path] = normalizeSourceText(readFileSync(join(BRIDGE, path), 'utf8'))
  }
  return out
}

const signedTrustRoot = loadSignedTrustRoot()
if (!signedTrustRoot) {
  console.error('The signed trust root is missing. Formal proofs cannot be authorized without it.')
  process.exit(1)
}
const signature = checkTrustRootSignature(signedTrustRoot, FORMAL_PROOF_FIXTURE_DOSSIER.dossierId)
if (!signature.authentic) {
  console.error(`Trust-root signature is not authentic: ${signature.failures.join(', ')}`)
  process.exit(1)
}
if (!signature.authorityValid) {
  console.error(`Signing key is not authorized for this payload: ${signature.authorityFailures.join(', ')}`)
  process.exit(1)
}
const signingKey = resolveSigningKey(signedTrustRoot.signature.keyId)
const authority = {
  signatureAlgorithm: signedTrustRoot.signature.algorithm,
  canonicalization: signedTrustRoot.signature.canonicalization,
  keyId: signedTrustRoot.signature.keyId,
  authorityId: signedTrustRoot.payload.authorityId,
  authorityEpoch: signedTrustRoot.payload.authorityEpoch,
  signatureAuthentic: true,
  signingAuthorityValid: true,
  permittedDossierIds: signingKey.scope.permittedDossierIds,
  bindingManifestSha256: signedTrustRoot.payload.bindingManifestSha256,
  bindingManifestRevision: signedTrustRoot.payload.bindingManifestRevision,
  syntheticTestKey: isSyntheticKey(signingKey),
}

const leanVersion = resolveActualLeanVersion(BRIDGE)
if (leanVersion === null) {
  console.error('Lean is not available. This check exists to run the real toolchain and cannot proceed without it.')
  process.exit(1)
}

// Verify the attachments against real Lean before packaging them.
const compiled = BINDINGS.bindings.map((binding) =>
  compileFromBinding({ theoremId: `thm_${binding.bindingId}`, bindingId: binding.bindingId }, BINDINGS, PROOF_MANIFEST, BRIDGE),
)
const outcome = verifyAttachments(compiled, {
  packageRoot: BRIDGE,
  manifest: PROOF_MANIFEST,
  bindingManifest: BINDINGS,
  declaredClaimIds: FORMAL_PROOF_FIXTURE_DOSSIER.claims.map((claim) => claim.claimId),
  dossierId: FORMAL_PROOF_FIXTURE_DOSSIER.dossierId,
})
if (outcome.failures.length || outcome.verified.length !== compiled.length) {
  console.error('Real Lean verification failed:')
  for (const failure of outcome.failures) console.error(`  - ${failure.code}: ${failure.detail.slice(0, 300)}`)
  process.exit(1)
}

const sha = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`

async function buildPackage() {
  const calculation = await executeAndAttachCalculationToDossier({
    dossierId: FORMAL_PROOF_FIXTURE_DOSSIER.dossierId,
    claimIds: [FORMAL_PROOF_FIXTURE_CLAIM_ID],
    artifact: kernel,
    request: {
      schemaVersion: 'maha-wasm-execution-request/1.0',
      operation: 'interval-add',
      inputs: { leftLower: '1000', leftUpper: '1010', rightLower: '500', rightUpper: '505' },
      units: { leftLower: 'nm', leftUpper: 'nm', rightLower: 'nm', rightUpper: 'nm', resultLower: 'nm', resultUpper: 'nm' },
    },
  })
  const artifacts = [
    { name: 'interval-add-result.json', role: 'output' as const, mediaType: 'application/json', bytes: 48, sha256: `sha256:${'4'.repeat(64)}` },
    { name: 'kernel.wasm', role: 'code' as const, mediaType: 'application/wasm', bytes: kernel.bytes.byteLength, sha256: kernel.manifest.kernelSha256 },
  ]
  const environment = { runtime: 'node-wasm', isolation: 'private-internal-fixture' }
  const bindings = {
    dossierId: FORMAL_PROOF_FIXTURE_DOSSIER.dossierId,
    claimIds: [FORMAL_PROOF_FIXTURE_CLAIM_ID],
    calculationReceiptIds: [calculation.receipt.receiptSha256],
  }
  const snapshot = {
    schemaVersion: 'maha-computational-witness/0.1' as const,
    canonicalizationVersion: 'maha-dossier-canonical/1.0' as const,
    witnessVersion: 'maha-witness/0.3',
    jobId: 'job_interval_tolerance_fixture',
    callable: { module: '@maha/wasm-kernel', qualname: 'intervalAdd' },
    execution: { status: 'succeeded' as const, startedAt: '2026-08-30T00:00:00Z', finishedAt: '2026-08-30T00:00:01Z', failureType: null },
    artifacts,
    inputSha256: sha(artifacts.filter((a) => a.role === 'code')),
    outputSha256: sha(artifacts.filter((a) => a.role === 'output')),
    environment,
    environmentSha256: sha(environment),
    randomSeeds: {},
    configuration: { deterministic: true },
    adapters: [{ kind: 'wasm' }],
    bindings,
    assurance: {
      executionObserved: true as const,
      independentlyReproduced: false as const,
      scientificValidityCertified: false as const,
      environmentComplete: true,
      secretsCaptured: false as const,
    },
  }
  const witness = attachRuntimeWitnessToDossier({
    dossierId: FORMAL_PROOF_FIXTURE_DOSSIER.dossierId,
    claimIds: [FORMAL_PROOF_FIXTURE_CLAIM_ID],
    calculationReceiptIds: [calculation.receipt.receiptSha256],
    receipt: { ...snapshot, receiptSha256: sha(snapshot) } as ComputationalWitnessReceipt,
  })
  return compileIntegratedPackage(FORMAL_PROOF_FIXTURE_DOSSIER, [calculation], {
    kernelArtifact: kernel,
    formalProofs: outcome.verified,
    formalProofEvidence: { proofManifest: PROOF_MANIFEST, bindingManifest: BINDINGS, toolchain: TOOLCHAIN, leanSources: leanSources(), signedTrustRoot },
    formalProofAuthority: authority,
    runtimeWitnesses: [witness],
  })
}

const first = await buildPackage()
const second = await buildPackage()

const problems: string[] = []
if (first.manifest.packageDigest !== second.manifest.packageDigest) problems.push('Two generations produced different package digests.')
if (first.files.length !== second.files.length) problems.push('Two generations produced different file counts.')
for (let index = 0; index < first.files.length; index += 1) {
  if (first.files[index].path !== second.files[index].path || first.files[index].sha256 !== second.files[index].sha256) {
    problems.push(`File ${first.files[index].path} is not byte-identical across generations.`)
  }
}

// The production path: no injected runners, real Lean, fails closed.
const findings = await verifyIntegratedCalculationEvidence(first)
if (findings.length) problems.push(`Package verification returned findings: ${findings.join(', ')}`)

if (problems.length) {
  console.error('Integrated formal-proof package verification failed:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

if (process.env.MAHA_PDF_OUT) {
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync(process.env.MAHA_PDF_OUT, { recursive: true })
  writeFileSync(`${process.env.MAHA_PDF_OUT}/evidence-dossier.pdf`, first.files.find((f) => f.path === 'evidence-dossier.pdf')!.bytes)
}

console.log(
  JSON.stringify(
    {
      leanVersion,
      signatureAlgorithm: signedTrustRoot.signature.algorithm,
      signatureKeyId: signedTrustRoot.signature.keyId,
      signatureAuthentic: true,
      signingAuthorityValid: true,
      authorityId: signedTrustRoot.payload.authorityId,
      authorityEpoch: signedTrustRoot.payload.authorityEpoch,
      syntheticTestKey: isSyntheticKey(signingKey),
      formalProofs: first.manifest.formalProofCount,
      calculations: 1,
      runtimeWitnesses: first.manifest.runtimeWitnessCount,
      packageFiles: first.files.length,
      packageDigest: first.manifest.packageDigest,
      byteIdenticalAcrossTwoGenerations: true,
      leanRecheckExecuted: true,
    },
    null,
    2,
  ),
)
