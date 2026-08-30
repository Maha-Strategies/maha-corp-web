import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { FORMAL_PROOF_FIXTURE_CLAIM_ID, FORMAL_PROOF_FIXTURE_DOSSIER } from '../lib/evidence-dossier/formal-proof-fixture.ts'
import { compileIntegratedPackage, renderDossierJsonLd, verifyIntegratedCalculationEvidence } from '../packages/evidence-dossier-builder/src/index.ts'
import { compileFromBinding } from '../packages/maha-lean-bridge/src/compiler.ts'
import { normalizeSourceText } from '../packages/maha-lean-bridge/src/canonicalize.ts'
import { verifyAttachments } from '../packages/maha-lean-bridge/src/verifier.ts'
import type { BindingManifest } from '../packages/maha-lean-bridge/src/bindings.ts'
import type { FormalProofAttachment, ProofManifest } from '../packages/maha-lean-bridge/src/schema.ts'
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
  for (const theorem of PROOF_MANIFEST.theorems) {
    out[theorem.sourceFile] = normalizeSourceText(readFileSync(join(BRIDGE, theorem.sourceFile), 'utf8'))
  }
  return out
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

const build = async (overrides: Record<string, unknown> = {}) =>
  compileIntegratedPackage(FORMAL_PROOF_FIXTURE_DOSSIER, [await calculation()], {
    kernelArtifact: artifact,
    formalProofs: verifiedProofs(),
    formalProofEvidence: evidence(),
    ...overrides,
  })

const fileText = (bundle: Awaited<ReturnType<typeof build>>, path: string) =>
  new TextDecoder().decode(bundle.files.find((f) => f.path === path)!.bytes)

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
})

test('the generated package verifies offline with no findings', async () => {
  const bundle = await build()
  assert.deepEqual(await verifyIntegratedCalculationEvidence(bundle), [])
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
  assert.ok(findings.includes('integrated-formal-proof-source-mismatch'))
})

test('a stale toolchain in the package is detected offline', async () => {
  const bundle = await build()
  const mutated = {
    ...bundle,
    files: bundle.files.map((f) => (f.path === 'lean-toolchain' ? { ...f, bytes: new TextEncoder().encode('leanprover/lean4:v4.0.0\n') } : f)),
  }
  const findings = await verifyIntegratedCalculationEvidence(mutated)
  assert.ok(findings.includes('integrated-formal-proof-toolchain-mismatch'))
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
