import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { canonicalJson, normalizeSourceText } from '../packages/maha-lean-bridge/src/canonicalize.ts'
import { compileAttachment } from '../packages/maha-lean-bridge/src/compiler.ts'
import { formalProofNodes, formalProofSection } from '../packages/maha-lean-bridge/src/dossier.ts'
import { PROOF_ESCAPES, qualifiedName, type FormalProofAttachment, type ProofManifest } from '../packages/maha-lean-bridge/src/schema.ts'
import { manifestDigest, verifyAttachments } from '../packages/maha-lean-bridge/src/verifier.ts'

const PACKAGE = resolve(import.meta.dirname, '../packages/maha-lean-bridge')
const MANIFEST = JSON.parse(readFileSync(join(PACKAGE, 'fixtures/formal-proof-manifest.json'), 'utf8')) as ProofManifest
const CLAIMS = JSON.parse(readFileSync(join(PACKAGE, 'fixtures/formal-claims.json'), 'utf8')) as {
  dossierId: string
  bindings: Array<{
    theoremId: string
    qualifiedTheorem: string
    claimIds: string[]
    assumptions: string[]
    informalBoundary: string
  }>
}

const DECLARED_CLAIMS = ['clm_figure_conditions', 'clm_process_window']

/**
 * Lean is not installed in this environment, so every test here injects the
 * Lean result rather than shelling out. That is deliberate and it is also the
 * boundary of what these tests establish: they prove the verifier's refusal
 * logic and its handling of a Lean outcome. They do NOT establish that any
 * theorem is proved — only a real `lake build` does that, which runs in CI.
 */
const leanSucceeds = () => ({ ok: true, output: '' })
const axiomsClean = (_root: string, names: readonly string[]) => ({
  ok: true,
  output: names.map((n) => `'${n}' depends on axioms: [propext, Classical.choice, Quot.sound]`).join('\n'),
})

function baseAttachments(): FormalProofAttachment[] {
  return CLAIMS.bindings.map((binding) =>
    compileAttachment(
      { ...binding, dossierId: CLAIMS.dossierId },
      MANIFEST,
      PACKAGE,
    ),
  )
}

const options = (overrides: Partial<Parameters<typeof verifyAttachments>[1]> = {}) => ({
  packageRoot: PACKAGE,
  manifest: MANIFEST,
  declaredClaimIds: DECLARED_CLAIMS,
  dossierId: CLAIMS.dossierId,
  runLeanBuild: leanSucceeds,
  runAxiomCheck: axiomsClean,
  ...overrides,
})

test('a compiled attachment is unverified and claims nothing', () => {
  for (const attachment of baseAttachments()) {
    assert.equal(attachment.proofStatus, 'unverified')
    assert.equal(attachment.assurance.machineChecked, false)
    assert.equal(attachment.assurance.empiricallyValidated, false)
    assert.equal(attachment.assurance.independentlyReproduced, false)
    assert.equal(attachment.assurance.compilerEquivalenceProven, false)
    assert.equal(attachment.assurance.scientificModelCertified, false)
  }
})

test('a successful Lean result is what promotes an attachment', () => {
  const outcome = verifyAttachments(baseAttachments(), options())
  assert.equal(outcome.failures.length, 0)
  assert.equal(outcome.verified.length, CLAIMS.bindings.length)
  for (const attachment of outcome.verified) {
    assert.equal(attachment.proofStatus, 'verified')
    assert.equal(attachment.assurance.machineChecked, true)
    // Everything else stays false no matter what Lean said.
    assert.equal(attachment.assurance.empiricallyValidated, false)
    assert.equal(attachment.assurance.independentlyReproduced, false)
    assert.equal(attachment.assurance.compilerEquivalenceProven, false)
    assert.equal(attachment.assurance.scientificModelCertified, false)
  }
})

test('a caller cannot set machineChecked itself', () => {
  const forged = baseAttachments().map((a) => ({ ...a, assurance: { ...a.assurance, machineChecked: true } }))
  const outcome = verifyAttachments(forged, options({ runLeanBuild: () => ({ ok: false, output: 'build failed' }) }))
  assert.ok(outcome.failures.some((f) => f.code === 'assurance-overreach'))
  assert.equal(outcome.verified.length, 0)
})

test('a caller cannot assert empirical or reproduction assurance', () => {
  for (const flag of ['empiricallyValidated', 'independentlyReproduced', 'compilerEquivalenceProven', 'scientificModelCertified'] as const) {
    const forged = baseAttachments().map((a) => ({ ...a, assurance: { ...a.assurance, [flag]: true } }))
    const outcome = verifyAttachments(forged as FormalProofAttachment[], options())
    assert.ok(outcome.failures.some((f) => f.code === 'assurance-overreach'), flag)
  }
})

test('a failed Lean build verifies nothing', () => {
  const outcome = verifyAttachments(baseAttachments(), options({ runLeanBuild: () => ({ ok: false, output: 'error: unknown identifier' }) }))
  assert.equal(outcome.verified.length, 0)
  assert.ok(outcome.failures.some((f) => f.code === 'lean-build-failed'))
})

test('a sorryAx dependency verifies nothing even when the build succeeds', () => {
  // `sorry` warns rather than errors, so exit status alone would let it through.
  const outcome = verifyAttachments(
    baseAttachments(),
    options({ runAxiomCheck: () => ({ ok: true, output: "'Maha.Interval.add_valid' depends on axioms: [propext, sorryAx]" }) }),
  )
  assert.equal(outcome.verified.length, 0)
  assert.ok(outcome.failures.some((f) => f.code === 'sorry-axiom-present'))
})

test('a stale source digest is refused', () => {
  const stale = baseAttachments().map((a) => ({ ...a, sourceSha256: `sha256:${'0'.repeat(64)}` }))
  const outcome = verifyAttachments(stale, options())
  assert.equal(outcome.verified.length, 0)
  assert.ok(outcome.failures.some((f) => f.code === 'source-digest-stale'))
})

test('a stale toolchain identity is refused', () => {
  const stale = baseAttachments().map((a) => ({ ...a, leanVersion: '4.0.0' }))
  const outcome = verifyAttachments(stale, options())
  assert.ok(outcome.failures.some((f) => f.code === 'toolchain-stale'))
  assert.equal(outcome.verified.length, 0)
})

test('a changed theorem statement is refused', () => {
  const changed = baseAttachments().map((a) => ({ ...a, formalStatement: `${a.formalStatement} extra` }))
  const outcome = verifyAttachments(changed, options())
  assert.ok(outcome.failures.some((f) => f.code === 'statement-changed'))
})

test('an unknown theorem is refused', () => {
  const unknown = baseAttachments().map((a) => ({ ...a, theoremName: 'no_such_theorem' }))
  const outcome = verifyAttachments(unknown, options())
  assert.ok(outcome.failures.some((f) => f.code === 'theorem-unknown'))
})

test('a duplicate theorem id is refused', () => {
  const [first] = baseAttachments()
  const outcome = verifyAttachments([first, { ...first }], options())
  assert.ok(outcome.failures.some((f) => f.code === 'duplicate-theorem'))
})

test('a substituted dossier is refused', () => {
  const outcome = verifyAttachments(baseAttachments(), options({ dossierId: 'dsr_something_else' }))
  assert.ok(outcome.failures.some((f) => f.code === 'dossier-mismatch'))
  assert.equal(outcome.verified.length, 0)
})

test('a substituted claim is refused', () => {
  const substituted = baseAttachments().map((a) => ({ ...a, claimIds: ['clm_not_declared'] }))
  const outcome = verifyAttachments(substituted, options())
  assert.ok(outcome.failures.some((f) => f.code === 'claim-unknown'))
})

test('a stale proof manifest is refused', () => {
  const stale = baseAttachments().map((a) => ({ ...a, proofManifestSha256: `sha256:${'1'.repeat(64)}` }))
  const outcome = verifyAttachments(stale, options())
  assert.ok(outcome.failures.some((f) => f.code === 'manifest-digest-stale'))
})

test('an attachment without a stated boundary is refused', () => {
  const bare = baseAttachments().map((a) => ({ ...a, informalBoundary: '   ' }))
  const outcome = verifyAttachments(bare, options())
  assert.ok(outcome.failures.some((f) => f.code === 'boundary-missing'))
})

test('the Lean sources contain no unfinished-proof escape', () => {
  // A cheap first refusal. It is not the proof of completeness: the axiom check
  // is, because a hole can be introduced without the literal token.
  for (const file of ['Maha/CanonicalArithmetic.lean', 'Maha/Angles.lean', 'Maha/Intervals.lean', 'Maha/ThermalModel.lean', 'Maha/EvidenceBoundary.lean']) {
    const source = readFileSync(join(PACKAGE, file), 'utf8')
    for (const escape of PROOF_ESCAPES) {
      assert.equal(new RegExp(`\\b${escape}\\b`).test(source), false, `${file} contains ${escape}`)
    }
  }
})

test('only verified proofs reach the JSON-LD projection', () => {
  const attachments = baseAttachments()
  assert.deepEqual(formalProofNodes(attachments), [], 'unverified proofs must not appear')
  const verified = verifyAttachments(attachments, options()).verified
  assert.equal(formalProofNodes(verified).length, attachments.length)
})

test('absence of formal proofs is an explicit empty array, not an omission', () => {
  const section = formalProofSection([])
  assert.deepEqual(section.proofs, [])
  assert.ok(section.title.length > 0)
  assert.match(section.notice, /not an experiment/)
})

test('the boundary notice refuses every empirical reading', () => {
  const { notice } = formalProofSection([])
  for (const phrase of ['not an experiment', 'not an independent reproduction', 'not expert review', 'not regulatory approval']) {
    assert.ok(notice.includes(phrase), phrase)
  }
})

test('the manifest is deterministic and free of machine-specific paths', () => {
  const serialized = canonicalJson(MANIFEST)
  assert.equal(serialized, canonicalJson(JSON.parse(serialized)))
  assert.equal(/\/Users\/|\/home\/|[A-Za-z]:\\/.test(serialized), false, 'no absolute path may enter the manifest')
  for (const theorem of MANIFEST.theorems) {
    assert.equal(theorem.sourceFile.startsWith('/'), false)
    assert.ok(theorem.sourceFile.startsWith('Maha/'))
  }
})

test('the manifest records every theorem exactly once', () => {
  const names = MANIFEST.theorems.map(qualifiedName)
  assert.equal(new Set(names).size, names.length)
  // Sorted by qualified name, so generation order cannot change the digest.
  assert.deepEqual(names, [...names].sort())
})

test('recorded source digests match the sources on disk', () => {
  for (const theorem of MANIFEST.theorems) {
    const actual = `sha256:${createHash('sha256')
      .update(normalizeSourceText(readFileSync(join(PACKAGE, theorem.sourceFile), 'utf8')), 'utf8')
      .digest('hex')}`
    assert.equal(actual, theorem.sourceSha256, theorem.sourceFile)
  }
})

test('the manifest digest is stable across regeneration', () => {
  const first = manifestDigest(MANIFEST)
  const second = manifestDigest(JSON.parse(JSON.stringify(MANIFEST)) as ProofManifest)
  assert.equal(first, second)
})

test('no Lean build cache or toolchain path is committed', async () => {
  const { execFileSync } = await import('node:child_process')
  const tracked = execFileSync('git', ['ls-files', 'packages/maha-lean-bridge'], {
    cwd: resolve(PACKAGE, '../..'),
    encoding: 'utf8',
  })
  for (const path of tracked.trim().split('\n').filter(Boolean)) {
    assert.equal(path.includes('/.lake/'), false, path)
    assert.equal(path.includes('/build/'), false, path)
    assert.equal(path.endsWith('.olean'), false, path)
  }
})
