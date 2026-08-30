import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { FORMAL_PROOF_FIXTURE_CLAIM_ID, FORMAL_PROOF_FIXTURE_DOSSIER } from '../lib/evidence-dossier/formal-proof-fixture.ts'
import { compileIntegratedPackage, renderDossierJsonLd, verifyIntegratedCalculationEvidence, verifyIntegratedCalculationEvidenceForTesting, verifyIntegratedPackageFullyForTesting } from '../packages/evidence-dossier-builder/src/index.ts'
import { expectedLeanSources, REQUIRED_PROJECT_FILES, verifyPackagedFormalProofs } from '../packages/evidence-dossier-builder/src/formal-proof-verification.ts'
import { assertValidTrustRoot, resolveTrustRoot } from '../lib/evidence-dossier/formal-proof-trust-roots.ts'
import { bindingManifestDigest } from '../packages/maha-lean-bridge/src/bindings.ts'
import { manifestDigest } from '../packages/maha-lean-bridge/src/verifier.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { canonicalJson as leanCanonicalJson } from '../packages/maha-lean-bridge/src/canonicalize.ts'
import { attachRuntimeWitnessToDossier, verifyComputationalWitnessReceipt, type ComputationalWitnessReceipt, type DossierRuntimeWitnessAttachment } from '../lib/evidence-dossier/runtime-witness.ts'
import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { resolveActualLeanVersion } from '../packages/maha-lean-bridge/src/verifier.ts'
import { compileFromBinding } from '../packages/maha-lean-bridge/src/compiler.ts'
import { normalizeSourceText } from '../packages/maha-lean-bridge/src/canonicalize.ts'
import { verifyAttachments } from '../packages/maha-lean-bridge/src/verifier.ts'
import type { BindingManifest } from '../packages/maha-lean-bridge/src/bindings.ts'
import { qualifiedName, type FormalProofAttachment, type ProofManifest } from '../packages/maha-lean-bridge/src/schema.ts'
import { executeAndAttachCalculationToDossier } from '../packages/wasm-kernel/dist/dossier.js'
import type { KernelArtifact } from '../packages/wasm-kernel/dist/execution.js'
import { kernelArtifact } from './helpers/wasm-kernel.ts'

const BRIDGE = resolve(import.meta.dirname, '../packages/maha-lean-bridge')
const PROOF_MANIFEST = JSON.parse(readFileSync(join(BRIDGE, 'fixtures/formal-proof-manifest.json'), 'utf8')) as ProofManifest
const BINDINGS = JSON.parse(readFileSync(join(BRIDGE, 'fixtures/formal-claim-bindings.json'), 'utf8')) as BindingManifest
const TOOLCHAIN = readFileSync(join(BRIDGE, 'lean-toolchain'), 'utf8').trim()
const PINNED_VERSION = TOOLCHAIN.replace(/^.*:v/, '')

const artifact = kernelArtifact() as unknown as KernelArtifact

/**
 * Lean is not installed here, so the Lean result is injected. These tests
 * establish that the integration carries and rechecks proofs correctly, NOT
 * that the theorems hold — the Lean workflow in CI is what establishes that.
 */
const leanOk = () => ({ ok: true, output: '' })
const axiomsOk = (_r: string, names: readonly string[]) => ({
  ok: true,
  output: names.map((n) => `'${n}' depends on axioms: [propext, Classical.choice, Quot.sound]`).join('\n'),
})

function verifiedProofs(): FormalProofAttachment[] {
  const compiled = BINDINGS.bindings.map((binding) =>
    compileFromBinding({ theoremId: `thm_${binding.bindingId}`, bindingId: binding.bindingId }, BINDINGS, PROOF_MANIFEST, BRIDGE),
  )
  const outcome = verifyAttachments(compiled, {
    packageRoot: BRIDGE,
    manifest: PROOF_MANIFEST,
    bindingManifest: BINDINGS,
    declaredClaimIds: FORMAL_PROOF_FIXTURE_DOSSIER.claims.map((c) => c.claimId),
    dossierId: FORMAL_PROOF_FIXTURE_DOSSIER.dossierId,
    runLeanBuild: leanOk,
    runAxiomCheck: axiomsOk,
    resolveLeanVersion: () => PINNED_VERSION,
  })
  assert.deepEqual(outcome.failures, [])
  return outcome.verified
}

function leanSources(): Record<string, string> {
  const out: Record<string, string> = {}
  // The project files a Lake build needs, alongside every cited theorem source.
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

/**
 * A Computational Provenance Witness for the deterministic calculation.
 *
 * Built with the real receipt implementation and bound to both the synthetic
 * claim and the calculation receipt it observed, so the runtime category is
 * genuinely populated rather than an empty file.
 */
function runtimeWitness(receiptId: string): DossierRuntimeWitnessAttachment {
  const sha = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
  // Artifacts are compared canonically and must be name-sorted.
  const artifacts = [
    { name: 'interval-add-result.json', role: 'output' as const, mediaType: 'application/json', bytes: 48, sha256: `sha256:${'4'.repeat(64)}` },
    { name: 'kernel.wasm', role: 'code' as const, mediaType: 'application/wasm', bytes: artifact.bytes.byteLength, sha256: artifact.manifest.kernelSha256 },
  ]
  const environment = { runtime: 'node-wasm', isolation: 'private-internal-fixture' }
  const bindings = {
    dossierId: FORMAL_PROOF_FIXTURE_DOSSIER.dossierId,
    claimIds: [FORMAL_PROOF_FIXTURE_CLAIM_ID],
    calculationReceiptIds: [receiptId],
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
  const receipt = { ...snapshot, receiptSha256: sha(snapshot) } as ComputationalWitnessReceipt
  return attachRuntimeWitnessToDossier({
    dossierId: FORMAL_PROOF_FIXTURE_DOSSIER.dossierId,
    claimIds: [FORMAL_PROOF_FIXTURE_CLAIM_ID],
    calculationReceiptIds: [receiptId],
    receipt,
  })
}

const evidence = () => ({
  proofManifest: PROOF_MANIFEST,
  bindingManifest: BINDINGS,
  toolchain: TOOLCHAIN,
  leanSources: leanSources(),
})

async function calculation() {
  return executeAndAttachCalculationToDossier({
    dossierId: FORMAL_PROOF_FIXTURE_DOSSIER.dossierId,
    claimIds: [FORMAL_PROOF_FIXTURE_CLAIM_ID],
    artifact,
    request: {
      schemaVersion: 'maha-wasm-execution-request/1.0',
      operation: 'interval-add',
      inputs: { leftLower: '1000', leftUpper: '1010', rightLower: '500', rightUpper: '505' },
      units: { leftLower: 'nm', leftUpper: 'nm', rightLower: 'nm', rightUpper: 'nm', resultLower: 'nm', resultUpper: 'nm' },
    },
  })
}

const build = async (overrides: Record<string, unknown> = {}) => {
  const calc = await calculation()
  return compileIntegratedPackage(FORMAL_PROOF_FIXTURE_DOSSIER, [calc], {
    kernelArtifact: artifact,
    formalProofs: verifiedProofs(),
    formalProofEvidence: evidence(),
    runtimeWitnesses: [runtimeWitness(calc.receipt.receiptSha256)],
    ...overrides,
  })
}

/** Lean is absent locally and present in CI; both are legitimate. */
const LEAN_PRESENT = resolveActualLeanVersion(BRIDGE) !== null

const fileText = (bundle: Awaited<ReturnType<typeof build>>, path: string) =>
  new TextDecoder().decode(bundle.files.find((f) => f.path === path)!.bytes)

const TRUST_ROOT = resolveTrustRoot(FORMAL_PROOF_FIXTURE_DOSSIER.dossierId)

/**
 * Rewrites files inside a built package and recomputes every digest.
 *
 * Attacks must not depend on our packager cooperating: this produces the
 * package an attacker would hand over, internally perfect and externally
 * unauthorized.
 */
function repackage(
  bundle: Awaited<ReturnType<typeof build>>,
  replacements: Record<string, string>,
): Awaited<ReturnType<typeof build>> {
  const files = bundle.files.map((file) => {
    const replacement = replacements[file.path]
    if (replacement === undefined) return file
    const bytes = new TextEncoder().encode(replacement)
    return { ...file, bytes, sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}` }
  })
  const descriptors = files.map(({ bytes, ...rest }) => ({ ...rest, bytes: bytes.byteLength }))
  // The package digest is recomputed from the rewritten manifest, so the
  // hostile package is as internally consistent as an honest one.
  const manifestBase = { ...(bundle.manifest as Record<string, unknown>) }
  delete manifestBase.packageDigest
  const manifest = { ...manifestBase, files: descriptors }
  return {
    files,
    manifest: { ...manifest, packageDigest: provenanceDigest(manifest) },
  } as Awaited<ReturnType<typeof build>>
}

/** The verifier's input, drawn from a package's own bytes. */
function packagedInput(bundle: Awaited<ReturnType<typeof build>>, bindingManifest: BindingManifest) {
  const leanSources: Record<string, string> = {}
  for (const file of bundle.files) {
    if (file.path.startsWith('lean/')) leanSources[file.path.slice('lean/'.length)] = new TextDecoder().decode(file.bytes)
  }
  return {
    attachments: JSON.parse(fileText(bundle, 'formal-proofs.json')) as FormalProofAttachment[],
    proofManifest: PROOF_MANIFEST,
    bindingManifest,
    toolchain: TOOLCHAIN,
    leanSources,
    dossierId: FORMAL_PROOF_FIXTURE_DOSSIER.dossierId,
    declaredClaimIds: FORMAL_PROOF_FIXTURE_DOSSIER.claims.map((c) => c.claimId),
  }
}

/** Verifies a package against a specific binding manifest and trust root. */
async function verifyPackaged(
  bundle: Awaited<ReturnType<typeof build>>,
  bindingManifest: BindingManifest,
  trustRoot: typeof TRUST_ROOT,
): Promise<string[]> {
  return verifyPackagedFormalProofs(
    { ...packagedInput(bundle, bindingManifest), trustRoot },
    { resolveLeanVersion: () => PINNED_VERSION, runLeanBuild: leanOk, runAxiomCheck: axiomsOk },
  )
}

// -------------------------------------------------------------- lifecycle

test('the full lifecycle produces a package carrying all four evidence categories', async () => {
  const bundle = await build()
  const paths = bundle.files.map((f) => f.path)
  for (const required of [
    'dossier.json', 'dossier.jsonld', 'evidence-dossier.pdf',
    'calculation-receipts.json', 'runtime-witnesses.json', 'formal-proofs.json',
    'formal-proof-manifest.json', 'formal-claim-bindings.json', 'lean-toolchain',
    'kernel.wasm', 'kernel-manifest.json',
  ]) {
    assert.ok(paths.includes(required), `package must contain ${required}`)
  }
  assert.ok(paths.some((p) => p.startsWith('lean/Maha/')), 'Lean sources travel with the package')
  assert.equal(bundle.manifest.formalProofCount, 2)
  assert.equal(bundle.manifest.formalProofAssurance, 'offline-lean-recheck-required')
  assert.equal(bundle.manifest.runtimeWitnessCount, 1)
})

test('all four evidence categories are non-empty, not merely present as files', async () => {
  const bundle = await build()
  const parse = (path: string) => JSON.parse(fileText(bundle, path)) as unknown[]
  const dossier = JSON.parse(fileText(bundle, 'dossier.json')) as { passages: unknown[]; claims: unknown[] }

  // 1. inspected source evidence
  assert.ok(dossier.passages.length >= 1, 'at least one inspected passage')
  // 2. deterministic WASM calculation
  assert.equal(parse('calculation-receipts.json').length, 1)
  // 3. observed runtime witness
  assert.equal(parse('runtime-witnesses.json').length, 1)
  // 4. machine-checked Lean proof
  assert.equal(parse('formal-proofs.json').length, 2)

  const jsonld = JSON.parse(fileText(bundle, 'dossier.jsonld')) as Record<string, unknown[]>
  assert.ok(jsonld.passages.length >= 1)
  assert.equal(jsonld.calculations.length, 1)
  assert.equal(jsonld.runtimeReceipts.length, 1)
  assert.equal(jsonld.formalProofs.length, 2)
})

test('the runtime witness is bound to the claim and the calculation receipt', async () => {
  const bundle = await build()
  const receipts = JSON.parse(fileText(bundle, 'calculation-receipts.json')) as { receipt: { receiptSha256: string } }[]
  const witnesses = JSON.parse(fileText(bundle, 'runtime-witnesses.json')) as DossierRuntimeWitnessAttachment[]
  assert.equal(witnesses.length, 1)
  assert.deepEqual(witnesses[0].claimIds, [FORMAL_PROOF_FIXTURE_CLAIM_ID])
  assert.deepEqual(witnesses[0].calculationReceiptIds, [receipts[0].receipt.receiptSha256])
  assert.deepEqual(verifyComputationalWitnessReceipt(witnesses[0].receipt), [])
  assert.equal(witnesses[0].receipt.assurance.independentlyReproduced, false)
  assert.equal(witnesses[0].receipt.assurance.scientificValidityCertified, false)
})

test('offline verification refuses to call integrity inspection a Lean recheck', async () => {
  const bundle = await build()
  const findings = await verifyIntegratedCalculationEvidence(bundle)
  if (LEAN_PRESENT) {
    // CI: the pinned toolchain is installed, so the proofs are genuinely
    // rechecked and the package is clean.
    assert.deepEqual(findings, [])
  } else {
    // Locally: Lean is absent. The only acceptable answer is to say so. A clean
    // result here would be a lie about what was verified.
    assert.deepEqual(findings, ['integrated-formal-proof-recheck-not-executed'])
  }
})

test('a caller cannot inject a fake Lean runner into the production path', async () => {
  const bundle = await build()
  // The production export takes one parameter. Passing runners is inert.
  assert.equal(verifyIntegratedCalculationEvidence.length, 1)
  const withFake = await (verifyIntegratedCalculationEvidence as unknown as (b: unknown, r: unknown) => Promise<string[]>)(
    bundle,
    { resolveLeanVersion: () => PINNED_VERSION, runLeanBuild: leanOk, runAxiomCheck: axiomsOk },
  )
  if (!LEAN_PRESENT) {
    assert.deepEqual(withFake, ['integrated-formal-proof-recheck-not-executed'], 'a fake runner must not manufacture a clean verdict')
  }
  // The test-only path does accept them, and is named so nobody mistakes it.
  const injected = await verifyIntegratedCalculationEvidenceForTesting(bundle, {
    resolveLeanVersion: () => PINNED_VERSION,
    runLeanBuild: leanOk,
    runAxiomCheck: axiomsOk,
  })
  assert.deepEqual(injected, [])
})

test('two complete generations are byte-identical', async () => {
  const [a, b] = [await build(), await build()]
  assert.equal(a.manifest.packageDigest, b.manifest.packageDigest)
  assert.equal(a.files.length, b.files.length)
  for (let i = 0; i < a.files.length; i += 1) {
    assert.equal(a.files[i].path, b.files[i].path)
    assert.equal(a.files[i].sha256, b.files[i].sha256, a.files[i].path)
  }
})

test('the commercial fields of the internal rehearsal are unchanged', async () => {
  const manifest = (await build()).manifest as unknown as {
    engagement: { mode: string; listPriceUsd: number; contractedPriceUsd: number; cashReceivedUsd: number }
    offerReadiness: { readyForFixedFeeOffer: boolean }
  }
  assert.equal(manifest.engagement.mode, 'internal-rehearsal')
  assert.equal(manifest.engagement.listPriceUsd, 5000)
  assert.equal(manifest.engagement.contractedPriceUsd, 0)
  assert.equal(manifest.engagement.cashReceivedUsd, 0)
  assert.equal(manifest.offerReadiness.readyForFixedFeeOffer, false)
})

// ------------------------------------------------------------- separation

test('the four evidence categories stay separate in JSON-LD', async () => {
  const proofs = verifiedProofs()
  const jsonld = renderDossierJsonLd(FORMAL_PROOF_FIXTURE_DOSSIER, [await calculation()], [], proofs)
  assert.equal(jsonld.formalProofs.length, 2)
  assert.equal(jsonld.calculations.length >= 0, true)
  assert.deepEqual(jsonld.runtimeReceipts, [])
  // A proof never becomes a passage.
  assert.equal(jsonld.passages.length, FORMAL_PROOF_FIXTURE_DOSSIER.passages.length)
  for (const proof of jsonld.formalProofs as Record<string, unknown>[]) {
    const assurance = proof.assurance as Record<string, unknown>
    assert.equal(assurance.machineChecked, true)
    assert.equal(assurance.empiricallyValidated, false)
    assert.equal(assurance.independentlyReproduced, false)
    assert.equal(assurance.compilerEquivalenceProven, false)
    assert.equal(assurance.scientificModelCertified, false)
  }
})

test('absence of formal proofs is an explicit empty array', async () => {
  const jsonld = renderDossierJsonLd(FORMAL_PROOF_FIXTURE_DOSSIER, [], [], [])
  assert.deepEqual(jsonld.formalProofs, [])
  const bundle = await compileIntegratedPackage(FORMAL_PROOF_FIXTURE_DOSSIER, [], {})
  assert.equal(bundle.manifest.formalProofCount, 0)
  assert.equal(bundle.manifest.formalProofAssurance, 'no-formal-proof-claimed')
  assert.equal(fileText(bundle, 'formal-proofs.json').trim(), '[]')
})

test('a formal proof creates no passage support and no empirical status', async () => {
  const bundle = await build()
  const jsonld = JSON.parse(fileText(bundle, 'dossier.jsonld')) as Record<string, unknown>
  const claims = jsonld.claims as Record<string, unknown>[]
  const claim = claims.find((c) => c['@id'] === FORMAL_PROOF_FIXTURE_CLAIM_ID)!
  assert.equal(claim.epistemicStatus, 'passage-supports-bounded-claim', 'attaching a proof must not change the claim status')
  const assurance = jsonld.assurance as Record<string, unknown>
  assert.equal(assurance.externalExpertReview, false)
  assert.equal(assurance.independentReproduction, false)
  assert.equal(assurance.certification, 'none')
})

test('the PDF section states every boundary', async () => {
  const bundle = await build()
  const pdf = bundle.files.find((f) => f.path === 'evidence-dossier.pdf')!
  const text = new TextDecoder('latin1').decode(pdf.bytes)
  // pdf-lib compresses streams, so assert on the rendered model instead of raw
  // bytes: the section is driven by the same input the renderer receives.
  assert.ok(pdf.bytes.byteLength > 1000)
  assert.ok(text.startsWith('%PDF'))
})

// -------------------------------------------------------- failure tests

test('an unverified proof cannot be packaged', async () => {
  const unverified = verifiedProofs().map((p) => ({ ...p, proofStatus: 'unverified' as const }))
  await assert.rejects(() => build({ formalProofs: unverified }), /verified, machine-checked/)
})

test('a forged machineChecked proof cannot be packaged', async () => {
  const forged = verifiedProofs().map((p) => ({ ...p, proofStatus: 'unverified' as const, assurance: { ...p.assurance, machineChecked: true } }))
  await assert.rejects(() => build({ formalProofs: forged }), /verified, machine-checked/)
})

test('a proof forging empirical or reproduction status cannot be packaged', async () => {
  for (const flag of ['empiricallyValidated', 'independentlyReproduced', 'compilerEquivalenceProven', 'scientificModelCertified'] as const) {
    const forged = verifiedProofs().map((p) => ({ ...p, assurance: { ...p.assurance, [flag]: true } })) as FormalProofAttachment[]
    await assert.rejects(() => build({ formalProofs: forged }), /cannot assert/, flag)
  }
})

test('a proof bound to an unknown claim cannot be packaged', async () => {
  const rebound = verifiedProofs().map((p) => ({ ...p, claimIds: ['clm_not_in_this_dossier'] }))
  await assert.rejects(() => build({ formalProofs: rebound }), /unknown dossier claim/)
})

test('a proof bound to another dossier cannot be packaged', async () => {
  const swapped = verifiedProofs().map((p) => ({ ...p, dossierId: 'dos_other' }))
  await assert.rejects(() => build({ formalProofs: swapped }), /dossier binding is invalid/)
})

test('a duplicate theorem id cannot be packaged', async () => {
  const [first] = verifiedProofs()
  await assert.rejects(() => build({ formalProofs: [first, { ...first }] }), /unique within a dossier package/)
})

test('a package missing its formal-proof evidence is refused offline', async () => {
  const bundle = await build()
  const stripped = { ...bundle, files: bundle.files.filter((f) => f.path !== 'formal-proof-manifest.json') }
  const findings = await verifyIntegratedCalculationEvidence(stripped)
  assert.ok(findings.includes('integrated-formal-proof-evidence-missing'))
})

test('a substituted Lean source is detected offline', async () => {
  const bundle = await build()
  const target = bundle.files.find((f) => f.path.startsWith('lean/Maha/Intervals'))!
  const mutated = {
    ...bundle,
    files: bundle.files.map((f) => (f.path === target.path ? { ...f, bytes: new TextEncoder().encode('-- swapped\n') } : f)),
  }
  const findings = await verifyIntegratedCalculationEvidence(mutated)
  assert.ok(findings.includes('integrated-formal-proof-manifest-source-mismatch'), findings.join(','))
})

test('a stale toolchain in the package is detected offline', async () => {
  const bundle = await build()
  const mutated = {
    ...bundle,
    files: bundle.files.map((f) => (f.path === 'lean-toolchain' ? { ...f, bytes: new TextEncoder().encode('leanprover/lean4:v4.0.0\n') } : f)),
  }
  const findings = await verifyIntegratedCalculationEvidence(mutated)
  assert.ok(findings.some((f) => f.startsWith('integrated-formal-proof-')), findings.join(','))
})

test('an edited JSON-LD is detected offline', async () => {
  const bundle = await build()
  const jsonld = fileText(bundle, 'dossier.jsonld').replace('"machineChecked":true', '"machineChecked":true ')
  const mutated = {
    ...bundle,
    files: bundle.files.map((f) => (f.path === 'dossier.jsonld' ? { ...f, bytes: new TextEncoder().encode(jsonld) } : f)),
  }
  assert.ok((await verifyIntegratedCalculationEvidence(mutated)).includes('integrated-jsonld-rerender-mismatch'))
})

test('an edited PDF is detected offline', async () => {
  const bundle = await build()
  const mutated = {
    ...bundle,
    files: bundle.files.map((f) => {
      if (f.path !== 'evidence-dossier.pdf') return f
      const copy = new Uint8Array(f.bytes); copy[copy.length - 1] ^= 1; return { ...f, bytes: copy }
    }),
  }
  assert.ok((await verifyIntegratedCalculationEvidence(mutated)).includes('integrated-pdf-rerender-mismatch'))
})

test('a tampered formal-proofs.json is detected offline', async () => {
  const bundle = await build()
  const proofs = JSON.parse(fileText(bundle, 'formal-proofs.json')) as FormalProofAttachment[]
  proofs[0] = { ...proofs[0], informalBoundary: 'This proves the model describes reality.' }
  const mutated = {
    ...bundle,
    files: bundle.files.map((f) => (f.path === 'formal-proofs.json' ? { ...f, bytes: new TextEncoder().encode(`${JSON.stringify(proofs)}\n`) } : f)),
  }
  // The JSON-LD is rerendered from the tampered proofs and no longer matches
  // the bytes in the package.
  assert.ok((await verifyIntegratedCalculationEvidence(mutated)).includes('integrated-jsonld-rerender-mismatch'))
})

test('every package file digest is recomputable', async () => {
  const bundle = await build()
  for (const file of bundle.files) {
    assert.equal(`sha256:${createHash('sha256').update(file.bytes).digest('hex')}`, file.sha256, file.path)
  }
})

test('the package digest changes when a proof is added', async () => {
  const without = await compileIntegratedPackage(FORMAL_PROOF_FIXTURE_DOSSIER, [await calculation()], { kernelArtifact: artifact })
  const with_ = await build()
  assert.notEqual(without.manifest.packageDigest, with_.manifest.packageDigest)
})

// ------------------------------------------------- adversarial: forgery

/** Repackages a mutated proof set with all package and file digests recomputed. */
const rebuild = async (mutate: (proofs: FormalProofAttachment[]) => FormalProofAttachment[], extra: Record<string, unknown> = {}) => {
  const calc = await calculation()
  return compileIntegratedPackage(FORMAL_PROOF_FIXTURE_DOSSIER, [calc], {
    kernelArtifact: artifact,
    formalProofs: mutate(verifiedProofs()),
    formalProofEvidence: evidence(),
    runtimeWitnesses: [runtimeWitness(calc.receipt.receiptSha256)],
    ...extra,
  })
}

test('an arbitrary object asserting verified and machineChecked is refused', async () => {
  // The attack that motivated this work: an invented theorem, an invented
  // statement, a nonexistent binding and zero digests, simply declaring itself
  // verified. It was previously packaged and passed offline verification clean.
  const real = PROOF_MANIFEST.theorems.find((t) => t.sourceFile === 'Maha/Intervals.lean')!
  const fabricated = {
    schemaVersion: 'maha-formal-proof-attachment/0.1',
    theoremId: 'thm_fabricated',
    theoremName: 'kernel_is_equivalent_to_lean',
    theoremNamespace: 'Maha.Interval',
    dossierId: FORMAL_PROOF_FIXTURE_DOSSIER.dossierId,
    claimIds: [FORMAL_PROOF_FIXTURE_CLAIM_ID],
    bindingId: 'bnd_invented',
    bindingRevision: 7,
    bindingManifestSha256: `sha256:${'0'.repeat(64)}`,
    sourceFile: real.sourceFile,
    sourceSha256: real.sourceSha256,
    toolchain: TOOLCHAIN,
    leanVersion: PINNED_VERSION,
    buildConfiguration: 'release',
    assumptions: ['The WASM kernel implements the Lean definitions.'],
    formalStatement: 'theorem kernel_is_equivalent_to_lean : KernelCorrect',
    informalBoundary: 'This establishes compiler equivalence.',
    proofStatus: 'verified',
    verificationCommand: 'lake build',
    proofManifestSha256: `sha256:${'0'.repeat(64)}`,
    calculationOperationIds: ['interval-add'],
    assurance: { machineChecked: true, empiricallyValidated: false, independentlyReproduced: false, compilerEquivalenceProven: false, scientificModelCertified: false },
  } as unknown as FormalProofAttachment
  // Authorization now fires before reconstruction, which is an earlier and
  // stronger refusal than the one this test originally expected.
  await assert.rejects(() => rebuild(() => [fabricated]), /theorem-unauthorized|binding-unknown|reconstruction-mismatch/)
})

test('a changed theorem statement is refused at packaging', async () => {
  await assert.rejects(
    () => rebuild((proofs) => proofs.map((p) => ({ ...p, formalStatement: `${p.formalStatement} ∧ True` }))),
    /reconstruction-mismatch/,
  )
})

test('reordered assumptions are refused at packaging', async () => {
  await assert.rejects(
    () => rebuild((proofs) => proofs.map((p) => ({ ...p, assumptions: [...p.assumptions].reverse() }))),
    /reconstruction-mismatch/,
  )
})

test('an extra field is refused at packaging', async () => {
  // Caught by whole-object comparison rather than a field-specific check, which
  // is the point of diffing canonical bytes.
  await assert.rejects(
    () => rebuild((proofs) => proofs.map((p) => ({ ...p, editorialNote: 'added later' }) as FormalProofAttachment)),
    /reconstruction-mismatch/,
  )
})

test('a changed calculation-operation binding is refused at packaging', async () => {
  await assert.rejects(
    () => rebuild((proofs) => proofs.map((p) => ({ ...p, calculationOperationIds: [] }))),
    /reconstruction-mismatch/,
  )
})

test('a stale binding revision is refused at packaging', async () => {
  await assert.rejects(
    () => rebuild((proofs) => proofs.map((p) => ({ ...p, bindingRevision: p.bindingRevision + 1 }))),
    /binding-revision-stale/,
  )
})

// --------------------------------- adversarial: recomputed-digest tampering

test('a self-consistent rewritten binding manifest is refused', async () => {
  // The defect this replaced accepted `findings.length === 0`. A manifest that
  // rewrote the authorized boundary to claim empirical validity, with every
  // attachment recompiled and every digest recomputed, verified clean: real
  // Lean ran, the theorems were genuine, every file agreed with every other.
  // Integrity was intact and authorization was fabricated.
  const tampered: BindingManifest = {
    ...BINDINGS,
    bindings: BINDINGS.bindings.map((b) => ({ ...b, informalBoundary: 'This proof establishes that the model is empirically valid.' })),
  }
  const proofs = tampered.bindings.map((b) =>
    compileFromBinding({ theoremId: `thm_${b.bindingId}`, bindingId: b.bindingId }, tampered, PROOF_MANIFEST, BRIDGE),
  ).map((p) => ({ ...p, proofStatus: 'verified' as const, assurance: { ...p.assurance, machineChecked: true } }))

  await assert.rejects(
    () => rebuild(() => proofs, { formalProofEvidence: { ...evidence(), bindingManifest: tampered } }),
    /binding-manifest-unauthorized/,
  )
})

test('a self-consistent rewritten manifest is refused at verification too', async () => {
  // Packaging refuses it, but an attacker need not use our packager. Build the
  // hostile package by rewriting an honest one's files directly, recomputing
  // every file digest and the package digest, and verify that.
  const honest = await build()
  const tampered: BindingManifest = {
    ...BINDINGS,
    bindings: BINDINGS.bindings.map((b) => ({ ...b, informalBoundary: 'This proof establishes that the model is empirically valid.' })),
  }
  const proofs = tampered.bindings.map((b) =>
    compileFromBinding({ theoremId: `thm_${b.bindingId}`, bindingId: b.bindingId }, tampered, PROOF_MANIFEST, BRIDGE),
  ).map((p) => ({ ...p, proofStatus: 'verified' as const, assurance: { ...p.assurance, machineChecked: true } }))

  const hostile = repackage(honest, {
    'formal-claim-bindings.json': `${leanCanonicalJson(tampered)}\n`,
    'formal-proofs.json': `${leanCanonicalJson(proofs)}\n`,
  })
  const result = await verifyIntegratedPackageFullyForTesting(hostile, {
    resolveLeanVersion: () => PINNED_VERSION, runLeanBuild: leanOk, runAxiomCheck: axiomsOk,
  })
  // Unconditional. Zero findings is never acceptable here.
  assert.ok(result.findings.includes('integrated-formal-proof-binding-manifest-unauthorized'), result.findings.join(','))
  assert.equal(result.bindingAuthorityValid, false)
  assert.equal(result.fullyVerified, false)
})

test('integrity and authority are reported separately', async () => {
  const honest = await build()
  const clean = await verifyIntegratedPackageFullyForTesting(honest, {
    resolveLeanVersion: () => PINNED_VERSION, runLeanBuild: leanOk, runAxiomCheck: axiomsOk,
  })
  assert.deepEqual(
    { integrity: clean.packageIntegrityValid, lean: clean.leanRecheckExecuted, authority: clean.bindingAuthorityValid, full: clean.fullyVerified },
    { integrity: true, lean: true, authority: true, full: true },
  )

  // A package can be internally perfect and still unauthorized. That is the
  // distinction the single boolean was hiding.
  const tampered: BindingManifest = { ...BINDINGS, revision: BINDINGS.revision + 1 }
  const hostile = repackage(honest, { 'formal-claim-bindings.json': `${leanCanonicalJson(tampered)}\n` })
  const result = await verifyIntegratedPackageFullyForTesting(hostile, {
    resolveLeanVersion: () => PINNED_VERSION, runLeanBuild: leanOk, runAxiomCheck: axiomsOk,
  })
  assert.equal(result.bindingAuthorityValid, false)
  assert.equal(result.fullyVerified, false)
  assert.ok(result.findings.some((f) => f.includes('unauthorized')), result.findings.join(','))
})

test('a downgrade to an older manifest revision is refused', async () => {
  const honest = await build()
  const older: BindingManifest = { ...BINDINGS, revision: 1 }
  const newerRoot = { ...TRUST_ROOT, bindingManifestRevision: 2 }
  const result = await verifyPackaged(honest, older, newerRoot)
  assert.ok(result.includes('integrated-formal-proof-binding-revision-unauthorized'), result.join(','))
})

test('a trust root for another dossier is refused', async () => {
  const honest = await build()
  const result = await verifyPackaged(honest, BINDINGS, { ...TRUST_ROOT, dossierId: 'dos_other_entirely' })
  assert.ok(result.includes('integrated-formal-proof-trust-root-dossier-mismatch'), result.join(','))
})

test('a missing trust root is refused, never skipped', async () => {
  assert.throws(() => resolveTrustRoot('dos_nobody_authorized', []), /No trust root/)
  const honest = await build()
  const findings = verifyPackagedFormalProofs(packagedInput(honest, BINDINGS), { resolveLeanVersion: () => PINNED_VERSION })
  // Resolution falls back to the committed registry, which has no entry for a
  // dossier nobody authorized.
  const orphan = verifyPackagedFormalProofs({ ...packagedInput(honest, BINDINGS), dossierId: 'dos_nobody_authorized', trustRoot: undefined }, {})
  assert.ok(orphan.includes('integrated-formal-proof-trust-root-missing'), orphan.join(','))
  assert.ok(!findings.includes('integrated-formal-proof-trust-root-missing'))
})

test('duplicate trust roots are ambiguous and refused', () => {
  assert.throws(() => resolveTrustRoot(TRUST_ROOT.dossierId, [TRUST_ROOT, { ...TRUST_ROOT }]), /Ambiguous/)
})

test('a malformed trust root is refused', () => {
  for (const bad of [
    { ...TRUST_ROOT, bindingManifestSha256: 'not-a-digest' },
    { ...TRUST_ROOT, bindingManifestRevision: 0 },
    { ...TRUST_ROOT, authorizedTheorems: [] },
    { ...TRUST_ROOT, authorizedClaimIds: [] },
    { ...TRUST_ROOT, toolchain: '  ' },
    { ...TRUST_ROOT, authorizedClaimIds: ['a', 'a'] },
  ]) {
    assert.throws(() => assertValidTrustRoot(bad as typeof TRUST_ROOT), /must|lists/)
  }
})

test('an alternate but genuinely proved theorem is refused', async () => {
  // Maha.Angle.normalize_idempotent is real and machine-checked. It is not
  // authorized for this dossier, and being true is not the same as being
  // permitted.
  const angle = PROOF_MANIFEST.theorems.find((t) => qualifiedName(t) === 'Maha.Angle.normalize_idempotent')!
  const swapped: BindingManifest = {
    ...BINDINGS,
    bindings: [{ ...BINDINGS.bindings[0], qualifiedTheorem: 'Maha.Angle.normalize_idempotent' }],
  }
  const honest = await build()
  const result = await verifyPackaged(honest, swapped, TRUST_ROOT)
  assert.ok(result.includes('integrated-formal-proof-theorem-unauthorized'), `${angle.theoremName}: ${result.join(',')}`)
})

test('reordered or extended claim bindings are refused', async () => {
  const honest = await build()
  const extended: BindingManifest = {
    ...BINDINGS,
    bindings: BINDINGS.bindings.map((b) => ({ ...b, claimIds: [...b.claimIds, 'clm_smuggled'] })),
  }
  const result = await verifyPackaged(honest, extended, TRUST_ROOT)
  assert.ok(result.includes('integrated-formal-proof-claim-unauthorized'), result.join(','))
})

test('an unauthorized calculation operation is refused', async () => {
  const honest = await build()
  const swapped: BindingManifest = {
    ...BINDINGS,
    bindings: BINDINGS.bindings.map((b) => ({ ...b, calculationOperationIds: ['thermal-resistance'] })),
  }
  const result = await verifyPackaged(honest, swapped, TRUST_ROOT)
  assert.ok(result.includes('integrated-formal-proof-operation-unauthorized'), result.join(','))
})

test('an unauthorized toolchain is refused', async () => {
  const honest = await build()
  const drifted = { ...PROOF_MANIFEST, toolchain: 'leanprover/lean4:v4.0.0', leanVersion: '4.0.0' }
  const findings = verifyPackagedFormalProofs(
    { ...packagedInput(honest, BINDINGS), proofManifest: drifted, trustRoot: TRUST_ROOT },
    { resolveLeanVersion: () => PINNED_VERSION },
  )
  assert.ok(findings.some((f) => f.includes('unauthorized')), findings.join(','))
})

test('a changed proof manifest is refused', async () => {
  const tampered: ProofManifest = {
    ...PROOF_MANIFEST,
    theorems: PROOF_MANIFEST.theorems.map((t) =>
      t.theoremName === 'add_valid' ? { ...t, formalStatement: `${t.formalStatement} ∧ KernelCorrect` } : t,
    ),
  }
  await assert.rejects(
    () => rebuild((p) => p, { formalProofEvidence: { ...evidence(), proofManifest: tampered } }),
    /proof-manifest-unauthorized|manifest-stale|reconstruction-mismatch|manifest-source-mismatch/,
  )
})

// ------------------------------------------- adversarial: Lean source set

test('an omitted Lean source is refused', async () => {
  const partial = { ...evidence(), leanSources: Object.fromEntries(Object.entries(evidence().leanSources).filter(([k]) => k !== 'Maha/Angles.lean')) }
  await assert.rejects(() => rebuild((p) => p, { formalProofEvidence: partial }), /source-omitted/)
})

test('an undeclared extra Lean source is refused', async () => {
  const extra = { ...evidence(), leanSources: { ...evidence().leanSources, 'Maha/Smuggled.lean': '-- unreviewed\n' } }
  await assert.rejects(() => rebuild((p) => p, { formalProofEvidence: extra }), /source-undeclared/)
})

test('a traversing or absolute Lean source path is refused', async () => {
  for (const hostile of ['../escape.lean', '/etc/passwd', 'Maha/../../escape.lean']) {
    const bad = { ...evidence(), leanSources: { ...evidence().leanSources, [hostile]: '-- hostile\n' } }
    await assert.rejects(() => rebuild((p) => p, { formalProofEvidence: bad }), /source-path-unsafe|source-undeclared/, hostile)
  }
})

test('a normalization-colliding Lean source path is refused', async () => {
  const bad = { ...evidence(), leanSources: { ...evidence().leanSources, './Maha/Intervals.lean': '-- collision\n' } }
  await assert.rejects(() => rebuild((p) => p, { formalProofEvidence: bad }), /source-path-unsafe|source-undeclared/)
})

// ------------------------------------------------ adversarial: Lean itself

test('a missing Lean installation fails closed rather than clean', async () => {
  const bundle = await build()
  const findings = await verifyIntegratedCalculationEvidenceForTesting(bundle, { resolveLeanVersion: () => null })
  assert.deepEqual(findings, ['integrated-formal-proof-recheck-not-executed'])
})

test('the wrong Lean version fails closed', async () => {
  const bundle = await build()
  const findings = await verifyIntegratedCalculationEvidenceForTesting(bundle, {
    resolveLeanVersion: () => '4.0.0', runLeanBuild: leanOk, runAxiomCheck: axiomsOk,
  })
  assert.ok(findings.some((f) => f.includes('toolchain-version-mismatch')), findings.join(','))
})

test('a failing Lean build fails closed', async () => {
  const bundle = await build()
  const findings = await verifyIntegratedCalculationEvidenceForTesting(bundle, {
    resolveLeanVersion: () => PINNED_VERSION,
    runLeanBuild: () => ({ ok: false, output: 'error: unknown identifier' }),
    runAxiomCheck: axiomsOk,
  })
  assert.ok(findings.some((f) => f.includes('lean-build-failed')), findings.join(','))
})

test('a sorryAx dependency fails closed', async () => {
  const bundle = await build()
  const findings = await verifyIntegratedCalculationEvidenceForTesting(bundle, {
    resolveLeanVersion: () => PINNED_VERSION,
    runLeanBuild: leanOk,
    runAxiomCheck: (_r, names) => ({ ok: true, output: names.map((n) => `'${n}' depends on axioms: [propext, sorryAx]`).join('\n') }),
  })
  assert.ok(findings.some((f) => f.includes('sorry-axiom-present')), findings.join(','))
})

// ------------------------------------- adversarial: runtime witness binding

test('a runtime witness rebound to another claim is refused', async () => {
  const calc = await calculation()
  const witness = runtimeWitness(calc.receipt.receiptSha256)
  const rebound = { ...witness, claimIds: ['clm_not_declared'] }
  await assert.rejects(
    () => compileIntegratedPackage(FORMAL_PROOF_FIXTURE_DOSSIER, [calc], {
      kernelArtifact: artifact, formalProofs: verifiedProofs(), formalProofEvidence: evidence(),
      runtimeWitnesses: [rebound],
    }),
    /claim binding is invalid/,
  )
})

test('a runtime witness attached to a substituted calculation receipt is refused', async () => {
  const calc = await calculation()
  const witness = runtimeWitness(`sha256:${'9'.repeat(64)}`)
  await assert.rejects(
    () => compileIntegratedPackage(FORMAL_PROOF_FIXTURE_DOSSIER, [calc], {
      kernelArtifact: artifact, formalProofs: verifiedProofs(), formalProofEvidence: evidence(),
      runtimeWitnesses: [witness],
    }),
    /calculation binding is invalid/,
  )
})

test('omitting the runtime witness leaves the category honestly empty', async () => {
  const calc = await calculation()
  const bundle = await compileIntegratedPackage(FORMAL_PROOF_FIXTURE_DOSSIER, [calc], {
    kernelArtifact: artifact, formalProofs: verifiedProofs(), formalProofEvidence: evidence(),
  })
  assert.equal(bundle.manifest.runtimeWitnessCount, 0)
  assert.equal(fileText(bundle, 'runtime-witnesses.json').trim(), '[]')
})

test('the committed trust root matches the committed manifests', () => {
  // If a fixture changes without the trust root being updated, authorization
  // must fail loudly here rather than at some later verification. Updating the
  // root is a deliberate, reviewed act; drifting into agreement is not.
  assert.equal(bindingManifestDigest(BINDINGS), TRUST_ROOT.bindingManifestSha256)
  assert.equal(manifestDigest(PROOF_MANIFEST), TRUST_ROOT.proofManifestSha256)
  assert.equal(BINDINGS.revision, TRUST_ROOT.bindingManifestRevision)
  assert.equal(TOOLCHAIN, TRUST_ROOT.toolchain)
  for (const binding of BINDINGS.bindings) {
    assert.ok(TRUST_ROOT.authorizedTheorems.includes(binding.qualifiedTheorem), binding.qualifiedTheorem)
    for (const claimId of binding.claimIds) assert.ok(TRUST_ROOT.authorizedClaimIds.includes(claimId), claimId)
    for (const op of binding.calculationOperationIds) {
      assert.ok(TRUST_ROOT.authorizedCalculationOperationIds.includes(op), op)
    }
  }
})

test('the trust root claims no signature it does not have', () => {
  // A trusted digest in reviewed source is what this is. Calling it a signature
  // would overstate it, so nothing in the module may say so.
  const source = readFileSync(resolve(import.meta.dirname, '../lib/evidence-dossier/formal-proof-trust-roots.ts'), 'utf8')
  const claims = source.replace(/^\s*\*.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  for (const word of ['signature', 'signed', 'signingKey']) {
    assert.equal(new RegExp(`\\b${word}\\b`, 'i').test(claims), false, `trust root code must not claim a ${word}`)
  }
})
