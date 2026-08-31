import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { evaluateAxiomPolicy, PERMITTED_AXIOMS } from '../packages/maha-lean-bridge/src/axioms.ts'
import {
  assertValidBindingManifest,
  bindingManifestDigest,
  type BindingManifest,
} from '../packages/maha-lean-bridge/src/bindings.ts'
import { canonicalJson, normalizeSourceText } from '../packages/maha-lean-bridge/src/canonicalize.ts'
import { compileFromBinding } from '../packages/maha-lean-bridge/src/compiler.ts'
import { formalProofNodes, formalProofSection } from '../packages/maha-lean-bridge/src/dossier.ts'
import { PROOF_ESCAPES, qualifiedName, type FormalProofAttachment, type ProofManifest } from '../packages/maha-lean-bridge/src/schema.ts'
import { manifestDigest, safeSourcePath, verifyAttachments } from '../packages/maha-lean-bridge/src/verifier.ts'

const PACKAGE = resolve(import.meta.dirname, '../packages/maha-lean-bridge')
const MANIFEST = JSON.parse(readFileSync(join(PACKAGE, 'fixtures/formal-proof-manifest.json'), 'utf8')) as ProofManifest
const BINDINGS = JSON.parse(readFileSync(join(PACKAGE, 'fixtures/formal-claim-bindings.json'), 'utf8')) as BindingManifest

// The dossier declares more claims than the bindings authorize. That gap is the
// point: an unrelated claim can exist and still not be a legal target.
const DECLARED_CLAIMS = ['clm_interval_composition', 'clm_process_window', 'clm_unrelated']
const PINNED_VERSION = readFileSync(join(PACKAGE, 'lean-toolchain'), 'utf8').trim().replace(/^.*:v/, '')

/**
 * Lean is not installed in this environment, so these tests inject the Lean
 * result rather than shelling out. They establish that the refusal logic works,
 * NOT that any theorem is proved. Only a real `lake build` does that, and it
 * runs in CI.
 */
const leanSucceeds = () => ({ ok: true, output: '' })
const axiomsClean = (_root: string, names: readonly string[]) => ({
  ok: true,
  output: names.map((n) => `'${n}' depends on axioms: [propext, Classical.choice, Quot.sound]`).join('\n'),
})

function baseAttachments(): FormalProofAttachment[] {
  return BINDINGS.bindings.map((binding) =>
    compileFromBinding({ theoremId: `thm_${binding.bindingId}`, bindingId: binding.bindingId }, BINDINGS, MANIFEST, PACKAGE),
  )
}

const options = (overrides: Record<string, unknown> = {}) => ({
  packageRoot: PACKAGE,
  manifest: MANIFEST,
  bindingManifest: BINDINGS,
  declaredClaimIds: DECLARED_CLAIMS,
  dossierId: BINDINGS.bindings[0].dossierId,
  runLeanBuild: leanSucceeds,
  runAxiomCheck: axiomsClean,
  resolveLeanVersion: () => PINNED_VERSION,
  ...overrides,
})

/** Every refusal must produce zero verified attachments, never a partial pass. */
function assertRefused(outcome: ReturnType<typeof verifyAttachments>, code: string) {
  assert.equal(outcome.verified.length, 0, `expected nothing verified for ${code}`)
  assert.ok(outcome.failures.some((f) => f.code === code), `expected failure ${code}, got ${outcome.failures.map((f) => f.code).join(', ') || 'none'}`)
}

// ---------------------------------------------------------------- happy path

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
  assert.deepEqual(outcome.failures, [])
  assert.equal(outcome.verified.length, BINDINGS.bindings.length)
  for (const attachment of outcome.verified) {
    assert.equal(attachment.proofStatus, 'verified')
    assert.equal(attachment.assurance.machineChecked, true)
    assert.equal(attachment.assurance.empiricallyValidated, false)
    assert.equal(attachment.assurance.independentlyReproduced, false)
    assert.equal(attachment.assurance.compilerEquivalenceProven, false)
    assert.equal(attachment.assurance.scientificModelCertified, false)
  }
})

// ------------------------------------------------------- assurance overreach

test('any forged assurance flag verifies nothing, even when Lean succeeds', () => {
  // The original defect: the failure was recorded and the attachment was
  // verified anyway. Every flag is now fatal on its own.
  for (const flag of ['machineChecked', 'empiricallyValidated', 'independentlyReproduced', 'compilerEquivalenceProven', 'scientificModelCertified'] as const) {
    const forged = baseAttachments().map((a) => ({ ...a, assurance: { ...a.assurance, [flag]: true } })) as FormalProofAttachment[]
    const outcome = verifyAttachments(forged, options())
    assert.equal(outcome.verified.length, 0, `${flag} must verify nothing`)
    assert.ok(outcome.failures.some((f) => f.code === 'assurance-overreach'), flag)
  }
})

test('the verifier never returns the caller object', () => {
  // A field the caller changed but that is not separately checked must still not
  // reach the output, because the output is rebuilt from trusted inputs.
  const tampered = baseAttachments().map((a) => ({ ...a, buildConfiguration: 'debug-tampered' }))
  const outcome = verifyAttachments(tampered, options())
  assert.equal(outcome.verified.length, BINDINGS.bindings.length)
  for (const attachment of outcome.verified) {
    assert.equal(attachment.buildConfiguration, MANIFEST.buildConfiguration)
  }
})

// -------------------------------------------------------- trusted bindings

test('a theorem cannot be attached to an unrelated but existing claim', () => {
  const rebound = baseAttachments().map((a) => ({ ...a, claimIds: ['clm_unrelated'] }))
  assertRefused(verifyAttachments(rebound, options()), 'claims-changed')
})

test('changed assumptions are refused', () => {
  const changed = baseAttachments().map((a) => ({ ...a, assumptions: ['a different assumption'] }))
  assertRefused(verifyAttachments(changed, options()), 'assumptions-changed')
})

test('reordered assumptions are refused, because order is meaningful', () => {
  const reordered = baseAttachments().map((a) => ({ ...a, assumptions: [...a.assumptions].reverse() }))
  assertRefused(verifyAttachments(reordered, options()), 'assumptions-changed')
})

test('a missing assumption is refused', () => {
  const dropped = baseAttachments().map((a) => ({ ...a, assumptions: a.assumptions.slice(1) }))
  assertRefused(verifyAttachments(dropped, options()), 'assumptions-changed')
})

test('a changed informal boundary is refused', () => {
  const softened = baseAttachments().map((a) => ({ ...a, informalBoundary: 'This proves the model describes reality.' }))
  assertRefused(verifyAttachments(softened, options()), 'boundary-changed')
})

test('changed calculation-operation ids are refused', () => {
  const changed = baseAttachments().map((a) => ({ ...a, calculationOperationIds: ['thermal-resistance'] }))
  assertRefused(verifyAttachments(changed, options()), 'calculation-operations-changed')
})

test('a stale binding manifest digest is refused', () => {
  const stale = baseAttachments().map((a) => ({ ...a, bindingManifestSha256: `sha256:${'2'.repeat(64)}` }))
  assertRefused(verifyAttachments(stale, options()), 'binding-manifest-stale')
})

test('a stale binding revision is refused', () => {
  const stale = baseAttachments().map((a) => ({ ...a, bindingRevision: 99 }))
  assertRefused(verifyAttachments(stale, options()), 'binding-missing')
})

test('an unauthorized theorem is refused even when it is genuinely proved', () => {
  // Maha.Angle.normalize_idempotent is a real, checked theorem. It has no
  // binding for this dossier, so it cannot be attached.
  const angle = MANIFEST.theorems.find((t) => qualifiedName(t) === 'Maha.Angle.normalize_idempotent')!
  const [first] = baseAttachments()
  const unauthorized = [{
    ...first,
    theoremName: angle.theoremName,
    theoremNamespace: angle.theoremNamespace,
    sourceFile: angle.sourceFile,
    sourceSha256: angle.sourceSha256,
    formalStatement: angle.formalStatement,
  }]
  assertRefused(verifyAttachments(unauthorized, options()), 'binding-missing')
})

test('a substituted dossier is refused', () => {
  assertRefused(verifyAttachments(baseAttachments(), options({ dossierId: 'dsr_something_else' })), 'dossier-mismatch')
})

test('a binding whose claim the dossier does not declare is refused', () => {
  assertRefused(verifyAttachments(baseAttachments(), options({ declaredClaimIds: ['clm_process_window'] })), 'claim-unknown')
})

// ------------------------------------------------------------ source identity

test('an absolute source path is refused', () => {
  assert.equal(safeSourcePath(PACKAGE, '/etc/passwd'), null)
})

test('parent traversal is refused', () => {
  assert.equal(safeSourcePath(PACKAGE, '../../etc/passwd'), null)
  assert.equal(safeSourcePath(PACKAGE, 'Maha/../../escape.lean'), null)
})

test('alternate separators and drive letters are refused', () => {
  assert.equal(safeSourcePath(PACKAGE, 'Maha\\Intervals.lean'), null)
  assert.equal(safeSourcePath(PACKAGE, 'C:/Maha/Intervals.lean'), null)
})

test('a path that normalizes differently from what was submitted is refused', () => {
  assert.equal(safeSourcePath(PACKAGE, './Maha/Intervals.lean'), null)
  assert.equal(safeSourcePath(PACKAGE, 'Maha//Intervals.lean'), null)
  assert.ok(safeSourcePath(PACKAGE, 'Maha/Intervals.lean'))
})

test('a source path differing from the manifest is refused', () => {
  const swapped = baseAttachments().map((a) => ({ ...a, sourceFile: 'Maha/Angles.lean' }))
  assertRefused(verifyAttachments(swapped, options()), 'source-path-mismatch')
})

test('a stale source digest is refused', () => {
  const stale = baseAttachments().map((a) => ({ ...a, sourceSha256: `sha256:${'0'.repeat(64)}` }))
  assertRefused(verifyAttachments(stale, options()), 'source-digest-stale')
})

test('a changed theorem statement is refused', () => {
  const changed = baseAttachments().map((a) => ({ ...a, formalStatement: `${a.formalStatement} extra` }))
  assertRefused(verifyAttachments(changed, options()), 'statement-changed')
})

test('an unknown theorem is refused', () => {
  const unknown = baseAttachments().map((a) => ({ ...a, theoremName: 'no_such_theorem' }))
  assertRefused(verifyAttachments(unknown, options()), 'binding-missing')
})

test('a duplicate theorem id is refused', () => {
  const [first] = baseAttachments()
  const outcome = verifyAttachments([first, { ...first }], options())
  assert.ok(outcome.failures.some((f) => f.code === 'duplicate-theorem'))
})

test('a stale proof manifest is refused', () => {
  const stale = baseAttachments().map((a) => ({ ...a, proofManifestSha256: `sha256:${'1'.repeat(64)}` }))
  assertRefused(verifyAttachments(stale, options()), 'manifest-digest-stale')
})

// ---------------------------------------------------------------- toolchain

test('a stale toolchain identity on the attachment is refused', () => {
  const stale = baseAttachments().map((a) => ({ ...a, leanVersion: '4.0.0' }))
  assertRefused(verifyAttachments(stale, options()), 'toolchain-stale')
})

test('a proof manifest disagreeing with lean-toolchain is refused', () => {
  const drifted = { ...MANIFEST, leanVersion: '4.0.0' }
  assertRefused(verifyAttachments(baseAttachments(), options({ manifest: drifted })), 'toolchain-file-mismatch')
})

test('a Lean on PATH of the wrong version verifies nothing', () => {
  assertRefused(verifyAttachments(baseAttachments(), options({ resolveLeanVersion: () => '4.9.9' })), 'toolchain-version-mismatch')
})

test('an unavailable Lean verifies nothing', () => {
  assertRefused(verifyAttachments(baseAttachments(), options({ resolveLeanVersion: () => null })), 'lean-unavailable')
})

test('the verificationCommand is descriptive and never executed', () => {
  // A hostile command in the manifest must not run. The verifier's own build and
  // axiom commands are fixed in code.
  const hostile = { ...MANIFEST, verificationCommand: 'rm -rf /' }
  // Compiled against the hostile manifest so the digests agree and the
  // attachment reaches the build stage at all.
  const attachments = BINDINGS.bindings.map((binding) =>
    compileFromBinding({ theoremId: `thm_${binding.bindingId}`, bindingId: binding.bindingId }, BINDINGS, hostile, PACKAGE),
  )
  let ran = false
  const outcome = verifyAttachments(
    attachments,
    options({ manifest: hostile, runLeanBuild: () => { ran = true; return { ok: true, output: '' } } }),
  )
  assert.equal(ran, true, 'the fixed build runner is what executes')
  assert.equal(outcome.verified.length, BINDINGS.bindings.length)
  assert.equal(outcome.verified[0].verificationCommand, 'rm -rf /', 'carried as text only')
})

// ------------------------------------------------------------------- axioms

test('a failed Lean build verifies nothing', () => {
  assertRefused(verifyAttachments(baseAttachments(), options({ runLeanBuild: () => ({ ok: false, output: 'error' }) })), 'lean-build-failed')
})

test('a sorryAx dependency verifies nothing even when the build succeeds', () => {
  const outcome = verifyAttachments(
    baseAttachments(),
    options({ runAxiomCheck: (_r: string, n: readonly string[]) => ({ ok: true, output: n.map((x) => `'${x}' depends on axioms: [propext, sorryAx]`).join('\n') }) }),
  )
  assertRefused(outcome, 'sorry-axiom-present')
})

test('a missing axiom report verifies nothing', () => {
  const outcome = verifyAttachments(
    baseAttachments(),
    options({ runAxiomCheck: () => ({ ok: true, output: "'Maha.Interval.add_valid' depends on axioms: [propext]" }) }),
  )
  assertRefused(outcome, 'axiom-policy-violation')
})

test('a duplicate axiom report verifies nothing', () => {
  const outcome = verifyAttachments(
    baseAttachments(),
    options({ runAxiomCheck: (_r: string, n: readonly string[]) => ({ ok: true, output: [...n, n[0]].map((x) => `'${x}' depends on axioms: [propext]`).join('\n') }) }),
  )
  assertRefused(outcome, 'axiom-policy-violation')
})

test('an unexpected user-declared axiom verifies nothing', () => {
  const outcome = verifyAttachments(
    baseAttachments(),
    options({ runAxiomCheck: (_r: string, n: readonly string[]) => ({ ok: true, output: n.map((x) => `'${x}' depends on axioms: [propext, Maha.assumedLemma]`).join('\n') }) }),
  )
  assertRefused(outcome, 'axiom-policy-violation')
})

test('an axiom-free proof is accepted, not treated as missing', () => {
  const outcome = verifyAttachments(
    baseAttachments(),
    options({ runAxiomCheck: (_r: string, n: readonly string[]) => ({ ok: true, output: n.map((x) => `'${x}' does not depend on any axioms`).join('\n') }) }),
  )
  assert.deepEqual(outcome.failures, [])
  assert.equal(outcome.verified.length, BINDINGS.bindings.length)
  assert.equal(outcome.axiomFree, BINDINGS.bindings.length)
})

test('the shared axiom policy permits exactly Lean core', () => {
  assert.deepEqual([...PERMITTED_AXIOMS].sort(), ['Classical.choice', 'Quot.sound', 'propext'])
  const ok = evaluateAxiomPolicy("'A' depends on axioms: [propext, Classical.choice, Quot.sound]", ['A'])
  assert.equal(ok.ok, true)
  assert.equal(evaluateAxiomPolicy("'A' depends on axioms: [myAxiom]", ['A']).ok, false)
  assert.equal(evaluateAxiomPolicy('', ['A']).ok, false)
})

// ------------------------------------------------------------- binding rules

test('the binding manifest is internally consistent', () => {
  assertValidBindingManifest(BINDINGS)
  assert.ok(bindingManifestDigest(BINDINGS).startsWith('sha256:'))
})

test('a binding manifest authorizing one theorem twice is rejected', () => {
  const doubled: BindingManifest = { ...BINDINGS, bindings: [BINDINGS.bindings[0], { ...BINDINGS.bindings[0], bindingId: 'bnd_other' }] }
  assert.throws(() => assertValidBindingManifest(doubled), /authorized twice/)
})

test('a binding without a boundary is rejected', () => {
  const bare: BindingManifest = { ...BINDINGS, bindings: [{ ...BINDINGS.bindings[0], informalBoundary: '  ' }] }
  assert.throws(() => assertValidBindingManifest(bare), /does not establish/)
})

// --------------------------------------------------------------- projection

test('only verified proofs reach the JSON-LD projection', () => {
  assert.deepEqual(formalProofNodes(baseAttachments()), [])
  const verified = verifyAttachments(baseAttachments(), options()).verified
  assert.equal(formalProofNodes(verified).length, BINDINGS.bindings.length)
})

test('absence of formal proofs is an explicit empty array, not an omission', () => {
  const section = formalProofSection([])
  assert.deepEqual(section.proofs, [])
  assert.ok(section.title.length > 0)
})

test('the boundary notice refuses every empirical reading', () => {
  const { notice } = formalProofSection([])
  for (const phrase of ['not an experiment', 'not an independent reproduction', 'not expert review', 'not regulatory approval']) {
    assert.ok(notice.includes(phrase), phrase)
  }
})

// ------------------------------------------------------------- determinism

test('the Lean sources contain no unfinished-proof escape', () => {
  for (const file of ['Maha/CanonicalArithmetic.lean', 'Maha/Angles.lean', 'Maha/Intervals.lean', 'Maha/ThermalModel.lean', 'Maha/EvidenceBoundary.lean']) {
    const source = readFileSync(join(PACKAGE, file), 'utf8')
    for (const escape of PROOF_ESCAPES) {
      assert.equal(new RegExp(`\\b${escape}\\b`).test(source), false, `${file} contains ${escape}`)
    }
  }
})

test('the manifest is deterministic and free of machine-specific paths', () => {
  const serialized = canonicalJson(MANIFEST)
  assert.equal(serialized, canonicalJson(JSON.parse(serialized)))
  assert.equal(/\/Users\/|\/home\/|[A-Za-z]:\\/.test(serialized), false)
  for (const theorem of MANIFEST.theorems) {
    assert.ok(theorem.sourceFile.startsWith('Maha/'))
  }
})

test('the manifest records every theorem exactly once, sorted', () => {
  const names = MANIFEST.theorems.map(qualifiedName)
  assert.equal(new Set(names).size, names.length)
  assert.deepEqual(names, [...names].sort())
})

test('recorded source digests match the sources on disk', () => {
  for (const theorem of MANIFEST.theorems) {
    const actual = `sha256:${createHash('sha256').update(normalizeSourceText(readFileSync(join(PACKAGE, theorem.sourceFile), 'utf8')), 'utf8').digest('hex')}`
    assert.equal(actual, theorem.sourceSha256, theorem.sourceFile)
  }
})

test('digests are stable across regeneration', () => {
  assert.equal(manifestDigest(MANIFEST), manifestDigest(JSON.parse(JSON.stringify(MANIFEST)) as ProofManifest))
  assert.equal(bindingManifestDigest(BINDINGS), bindingManifestDigest(JSON.parse(JSON.stringify(BINDINGS)) as BindingManifest))
})

test('no Lean build cache or toolchain path is committed', async () => {
  const { execFileSync } = await import('node:child_process')
  const tracked = execFileSync('git', ['ls-files', 'packages/maha-lean-bridge'], { cwd: resolve(PACKAGE, '../..'), encoding: 'utf8' })
  for (const path of tracked.trim().split('\n').filter(Boolean)) {
    assert.equal(path.includes('/.lake/'), false, path)
    assert.equal(path.includes('/build/'), false, path)
    assert.equal(path.endsWith('.olean'), false, path)
    // lake-manifest.json is regenerated by every build and embeds .lake paths.
    // It slipped past the earlier form of this guard, which named only the
    // directories.
    assert.equal(path.endsWith('lake-manifest.json'), false, path)
  }
})
