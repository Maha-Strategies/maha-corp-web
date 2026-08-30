import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

import { evaluateAxiomPolicy } from './axioms.ts'
import {
  assertValidBindingManifest,
  bindingManifestDigest,
  findBinding,
  sameOrderedList,
  type BindingManifest,
} from './bindings.ts'
import { canonicalJson, normalizeSourceText } from './canonicalize.ts'
import { PROOF_ESCAPES, qualifiedName, type FormalProofAttachment, type ProofManifest } from './schema.ts'

/**
 * Verification of formal-proof attachments.
 *
 * Two rules govern everything here.
 *
 * First: the caller's object is evidence of nothing. Verification never
 * promotes a submitted attachment. It reconstructs a clean one from trusted
 * inputs — the binding manifest and the proof manifest — and returns that. A
 * forged field therefore cannot survive even if some later check passes,
 * because the forged object is discarded rather than corrected.
 *
 * Second: existence is not authorization. A theorem that is genuinely proved,
 * attached to a claim that genuinely exists, is still wrong if nobody
 * authorized that pairing. The binding manifest is the authorization, and every
 * submitted field is compared against it.
 *
 * Lean's own result is required on top of both: `lake build` must exit zero,
 * and every theorem must produce exactly one axiom report resting only on
 * Lean's three core axioms. A `sorry` warns rather than errors, so exit status
 * alone would let a hole through.
 */

export interface VerificationFailure {
  code:
    | 'source-missing'
    | 'source-path-unsafe'
    | 'source-path-mismatch'
    | 'source-digest-stale'
    | 'toolchain-stale'
    | 'toolchain-file-mismatch'
    | 'toolchain-version-mismatch'
    | 'lean-unavailable'
    | 'manifest-digest-stale'
    | 'binding-manifest-stale'
    | 'binding-missing'
    | 'theorem-unknown'
    | 'statement-changed'
    | 'assumptions-changed'
    | 'boundary-changed'
    | 'claims-changed'
    | 'calculation-operations-changed'
    | 'duplicate-theorem'
    | 'claim-unknown'
    | 'dossier-mismatch'
    | 'proof-escape-present'
    | 'lean-build-failed'
    | 'sorry-axiom-present'
    | 'axiom-policy-violation'
    | 'assurance-overreach'
    | 'boundary-missing'
  detail: string
  theoremId?: string
}

export interface VerificationOutcome {
  verified: FormalProofAttachment[]
  failures: VerificationFailure[]
  /** True only when Lean actually ran. Absent Lean, nothing can be verified. */
  leanExecuted: boolean
  axiomFree: number
  restingOnPermittedAxiomsOnly: number
}

export interface VerifyOptions {
  packageRoot: string
  manifest: ProofManifest
  /** The trusted authorization for theorem-to-claim pairings. */
  bindingManifest: BindingManifest
  /** Declared claim ids of the dossier the attachments bind to. */
  declaredClaimIds: readonly string[]
  dossierId: string
  /** Injectable for tests: runs `lake build` and returns success. */
  runLeanBuild?: (packageRoot: string) => { ok: boolean; output: string }
  /** Injectable for tests: returns the axioms each theorem depends on. */
  runAxiomCheck?: (packageRoot: string, names: readonly string[]) => { ok: boolean; output: string }
  /** Injectable for tests: the Lean version actually on PATH. */
  resolveLeanVersion?: () => string | null
}

const LEAN_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  // Verification must not reach the network once the toolchain is installed.
  ELAN_HOME: process.env.ELAN_HOME ?? join(process.env.HOME ?? '', '.elan'),
  // A fixed locale, so nothing Lean prints is locale-ordered.
  LC_ALL: 'C',
  LANG: 'C',
}

/**
 * The Lean version actually on PATH, or null when Lean is unavailable.
 *
 * Resolved inside the package directory on purpose. elan picks a toolchain from
 * the nearest `lean-toolchain`, so asking from anywhere else either fails or
 * answers about a different toolchain than the one that will check the proofs.
 *
 * Parsed from `lean --version`, which prints e.g.
 * `Lean (version 4.33.1, x86_64-unknown-linux-gnu, commit ..., Release)`.
 */
export function resolveActualLeanVersion(cwd?: string): string | null {
  try {
    const output = execFileSync('lean', ['--version'], {
      cwd,
      env: LEAN_ENV,
      encoding: 'utf8',
      stdio: 'pipe',
    })
    return /version (\d+\.\d+\.\d+)/.exec(output)?.[1] ?? null
  } catch {
    return null
  }
}

export function leanAvailable(cwd?: string): boolean {
  return resolveActualLeanVersion(cwd) !== null
}

function defaultBuild(packageRoot: string): { ok: boolean; output: string } {
  try {
    const output = execFileSync('lake', ['build'], {
      cwd: packageRoot,
      env: LEAN_ENV,
      encoding: 'utf8',
      stdio: 'pipe',
    })
    return { ok: true, output }
  } catch (error) {
    const shell = error as { stdout?: string; stderr?: string }
    return { ok: false, output: `${shell.stdout ?? ''}${shell.stderr ?? ''}` }
  }
}

/**
 * Asks Lean which axioms each theorem depends on.
 *
 * The theorem names are written into a probe file rather than passed to a
 * shell, and the command is fixed here. Nothing an attachment or manifest
 * carries is ever executed: `verificationCommand` is descriptive text for a
 * human reader, not an instruction to this process.
 */
function defaultAxiomCheck(packageRoot: string, names: readonly string[]): { ok: boolean; output: string } {
  const probe = join(packageRoot, 'AxiomProbe.lean')
  const body = ['import Maha', ...names.map((name) => `#print axioms ${name}`)].join('\n')
  writeFileSync(probe, `${body}\n`)
  try {
    const output = execFileSync('lake', ['env', 'lean', 'AxiomProbe.lean'], {
      cwd: packageRoot,
      env: LEAN_ENV,
      encoding: 'utf8',
      stdio: 'pipe',
    })
    return { ok: true, output }
  } catch (error) {
    const shell = error as { stdout?: string; stderr?: string }
    return { ok: false, output: `${shell.stdout ?? ''}${shell.stderr ?? ''}` }
  } finally {
    rmSync(probe, { force: true })
  }
}

export function manifestDigest(manifest: ProofManifest): string {
  return `sha256:${createHash('sha256').update(canonicalJson(manifest), 'utf8').digest('hex')}`
}

/**
 * Resolves a repository-relative source path and proves it stays inside the
 * package.
 *
 * Returns null when the path is absolute, uses a Windows drive or UNC form,
 * traverses upward, or normalizes to somewhere outside `packageRoot`. The
 * containment check is done after resolution because a path can look harmless
 * and still escape once `..` segments are applied.
 */
export function safeSourcePath(packageRoot: string, sourceFile: string): string | null {
  if (!sourceFile || isAbsolute(sourceFile)) return null
  // Backslashes and drive letters are rejected outright rather than normalized:
  // a manifest is written by us, so an alternate separator means something is
  // wrong rather than something to be repaired.
  if (/[\\]/.test(sourceFile) || /^[A-Za-z]:/.test(sourceFile)) return null
  if (sourceFile.split('/').some((segment) => segment === '..')) return null

  const root = resolve(packageRoot)
  const resolved = resolve(root, sourceFile)
  const rel = relative(root, resolved)
  if (rel.startsWith('..') || isAbsolute(rel)) return null
  // Reject any path whose normalized form differs from what was submitted, so
  // `Maha//Intervals.lean` or `./Maha/Intervals.lean` cannot stand in for the
  // manifest's exact string.
  if (rel.split(sep).join('/') !== sourceFile) return null
  return resolved
}

/**
 * Verifies attachments against trusted bindings, the Lean sources and a real
 * Lean run.
 *
 * Returns freshly constructed attachments, never the submitted ones.
 */
export function verifyAttachments(
  attachments: readonly FormalProofAttachment[],
  options: VerifyOptions,
): VerificationOutcome {
  const failures: VerificationFailure[] = []
  const candidates: FormalProofAttachment[] = []
  const root = resolve(options.packageRoot)
  const proofDigest = manifestDigest(options.manifest)
  const byName = new Map(options.manifest.theorems.map((t) => [qualifiedName(t), t]))
  const seenIds = new Set<string>()
  const seenTheorems = new Set<string>()
  const empty = { verified: [], failures, leanExecuted: false, axiomFree: 0, restingOnPermittedAxiomsOnly: 0 }

  assertValidBindingManifest(options.bindingManifest)
  const bindingDigest = bindingManifestDigest(options.bindingManifest)

  // The toolchain the package actually pins, read from disk rather than taken
  // from a manifest that could have been edited alongside the attachment.
  const toolchainPath = join(root, 'lean-toolchain')
  if (!existsSync(toolchainPath)) {
    failures.push({ code: 'toolchain-file-mismatch', detail: 'lean-toolchain is missing from the package.' })
    return empty
  }
  const pinnedToolchain = readFileSync(toolchainPath, 'utf8').trim()
  if (pinnedToolchain !== options.manifest.toolchain) {
    failures.push({
      code: 'toolchain-file-mismatch',
      detail: `lean-toolchain pins ${pinnedToolchain} but the proof manifest declares ${options.manifest.toolchain}.`,
    })
    return empty
  }
  const pinnedVersion = pinnedToolchain.replace(/^.*:v/, '')
  if (pinnedVersion !== options.manifest.leanVersion) {
    failures.push({
      code: 'toolchain-file-mismatch',
      detail: `lean-toolchain resolves to ${pinnedVersion} but the proof manifest declares ${options.manifest.leanVersion}.`,
    })
    return empty
  }

  for (const submitted of attachments) {
    const fail = (code: VerificationFailure['code'], detail: string) => {
      failures.push({ code, detail, theoremId: submitted.theoremId })
    }

    // Assurance overreach is fatal, not advisory. A caller that asserts any of
    // these has demonstrated it is not merely mistaken about one field.
    const claimed = (submitted.assurance ?? {}) as unknown as Record<string, unknown>
    const overreached = (
      ['machineChecked', 'empiricallyValidated', 'independentlyReproduced', 'compilerEquivalenceProven', 'scientificModelCertified'] as const
    ).filter((flag) => claimed[flag] === true)
    if (overreached.length > 0) {
      fail('assurance-overreach', `An attachment cannot assert ${overreached.join(', ')}; assurance is set by verification.`)
      continue
    }

    if (seenIds.has(submitted.theoremId)) {
      fail('duplicate-theorem', `theoremId ${submitted.theoremId} appears more than once.`)
      continue
    }
    seenIds.add(submitted.theoremId)

    const name = qualifiedName(submitted)
    if (seenTheorems.has(name)) {
      fail('duplicate-theorem', `${name} is attached more than once.`)
      continue
    }
    seenTheorems.add(name)

    if (submitted.dossierId !== options.dossierId) {
      fail('dossier-mismatch', `Attachment binds dossier ${submitted.dossierId}, expected ${options.dossierId}.`)
      continue
    }

    // Authorization. Existence of the claim is checked separately and is not
    // sufficient on its own.
    const binding = findBinding(options.bindingManifest, options.dossierId, name)
    if (!binding) {
      fail('binding-missing', `No binding authorizes ${name} for ${options.dossierId}.`)
      continue
    }
    if (submitted.bindingManifestSha256 !== bindingDigest) {
      fail('binding-manifest-stale', 'Attachment cites a different binding manifest than the one supplied.')
      continue
    }
    if (submitted.bindingId !== binding.bindingId || submitted.bindingRevision !== binding.revision) {
      fail('binding-missing', `Attachment cites binding ${submitted.bindingId}@${submitted.bindingRevision}, authorized is ${binding.bindingId}@${binding.revision}.`)
      continue
    }

    // Every field the caller supplied must equal what the binding authorizes.
    // These are ordered lists, not sets, so reordering is a change.
    if (!sameOrderedList(submitted.claimIds, binding.claimIds)) {
      fail('claims-changed', `Attachment claims [${submitted.claimIds.join(', ')}] differ from authorized [${binding.claimIds.join(', ')}].`)
      continue
    }
    if (!sameOrderedList(submitted.assumptions, binding.assumptions)) {
      fail('assumptions-changed', 'Attachment assumptions differ from the authorized binding.')
      continue
    }
    if (submitted.informalBoundary !== binding.informalBoundary) {
      fail('boundary-changed', 'Attachment boundary differs from the authorized binding.')
      continue
    }
    if (!sameOrderedList(submitted.calculationOperationIds, binding.calculationOperationIds)) {
      fail('calculation-operations-changed', 'Attachment calculation operations differ from the authorized binding.')
      continue
    }

    // The binding authorizes claims; the dossier must actually declare them.
    const unknownClaims = binding.claimIds.filter((id) => !options.declaredClaimIds.includes(id))
    if (unknownClaims.length > 0) {
      fail('claim-unknown', `Claims not declared by the dossier: ${unknownClaims.join(', ')}.`)
      continue
    }

    if (submitted.proofManifestSha256 !== proofDigest) {
      fail('manifest-digest-stale', 'Attachment cites a different proof manifest than the one supplied.')
      continue
    }
    if (submitted.toolchain !== pinnedToolchain || submitted.leanVersion !== pinnedVersion) {
      fail('toolchain-stale', `Attachment cites ${submitted.toolchain}/${submitted.leanVersion}, package pins ${pinnedToolchain}/${pinnedVersion}.`)
      continue
    }

    const known = byName.get(name)
    if (!known) {
      fail('theorem-unknown', `${name} is not in the proof manifest.`)
      continue
    }
    if (submitted.sourceFile !== known.sourceFile) {
      fail('source-path-mismatch', `Attachment cites ${submitted.sourceFile}, the manifest records ${known.sourceFile}.`)
      continue
    }
    const sourcePath = safeSourcePath(root, submitted.sourceFile)
    if (!sourcePath) {
      fail('source-path-unsafe', `${submitted.sourceFile} is not a safe repository-relative path inside the package.`)
      continue
    }
    if (!existsSync(sourcePath)) {
      fail('source-missing', `${submitted.sourceFile} does not exist.`)
      continue
    }
    const actual = `sha256:${createHash('sha256').update(normalizeSourceText(readFileSync(sourcePath, 'utf8')), 'utf8').digest('hex')}`
    if (actual !== submitted.sourceSha256 || actual !== known.sourceSha256) {
      fail('source-digest-stale', `${submitted.sourceFile} has changed since the attachment was written.`)
      continue
    }
    if (submitted.formalStatement.replace(/\s+/g, ' ').trim() !== known.formalStatement) {
      fail('statement-changed', `The recorded statement of ${name} does not match the source.`)
      continue
    }

    const sourceText = readFileSync(sourcePath, 'utf8')
    const escape = PROOF_ESCAPES.find((token) => new RegExp(`\\b${token}\\b`).test(sourceText))
    if (escape) {
      fail('proof-escape-present', `${submitted.sourceFile} contains the proof escape \`${escape}\`.`)
      continue
    }

    // Reconstructed from trusted inputs only. Nothing the caller sent survives
    // into the returned object except identity fields already proved to match.
    candidates.push({
      schemaVersion: submitted.schemaVersion,
      theoremId: submitted.theoremId,
      theoremName: known.theoremName,
      theoremNamespace: known.theoremNamespace,
      dossierId: binding.dossierId,
      claimIds: [...binding.claimIds],
      bindingId: binding.bindingId,
      bindingRevision: binding.revision,
      bindingManifestSha256: bindingDigest,
      sourceFile: known.sourceFile,
      sourceSha256: known.sourceSha256,
      toolchain: pinnedToolchain,
      leanVersion: pinnedVersion,
      buildConfiguration: options.manifest.buildConfiguration,
      assumptions: [...binding.assumptions],
      formalStatement: known.formalStatement,
      informalBoundary: binding.informalBoundary,
      proofStatus: 'unverified',
      verificationCommand: options.manifest.verificationCommand,
      proofManifestSha256: proofDigest,
      calculationOperationIds: [...binding.calculationOperationIds],
      assurance: {
        machineChecked: false,
        empiricallyValidated: false,
        independentlyReproduced: false,
        compilerEquivalenceProven: false,
        scientificModelCertified: false,
      },
    })
  }

  if (candidates.length === 0) return { ...empty, failures }

  // The toolchain on PATH must be the one the package pins. A proof checked by
  // a different Lean is not a proof of what the attachment claims.
  const actualVersion = options.resolveLeanVersion ? options.resolveLeanVersion() : resolveActualLeanVersion(root)
  if (actualVersion === null) {
    failures.push({ code: 'lean-unavailable', detail: 'Lean is not available; nothing can be verified.' })
    return { ...empty, failures }
  }
  if (actualVersion !== pinnedVersion) {
    failures.push({
      code: 'toolchain-version-mismatch',
      detail: `Lean on PATH reports ${actualVersion} but the package pins ${pinnedVersion}.`,
    })
    return { ...empty, failures }
  }

  const build = (options.runLeanBuild ?? defaultBuild)(root)
  if (!build.ok) {
    failures.push({ code: 'lean-build-failed', detail: build.output.slice(0, 4000) })
    return { ...empty, failures, leanExecuted: true }
  }

  const names = candidates.map(qualifiedName)
  const axioms = (options.runAxiomCheck ?? defaultAxiomCheck)(root, names)
  if (!axioms.ok) {
    failures.push({ code: 'lean-build-failed', detail: axioms.output.slice(0, 4000) })
    return { ...empty, failures, leanExecuted: true }
  }

  // The same policy CI applies: exactly one attributable report per theorem,
  // resting only on Lean's three core axioms.
  const policy = evaluateAxiomPolicy(axioms.output, names)
  if (!policy.ok) {
    for (const problem of policy.problems) {
      const code = /sorryAx/.test(problem) ? 'sorry-axiom-present' : 'axiom-policy-violation'
      failures.push({ code, detail: problem })
    }
    return { ...empty, failures, leanExecuted: true }
  }

  return {
    verified: candidates.map((attachment) => ({
      ...attachment,
      proofStatus: 'verified',
      assurance: { ...attachment.assurance, machineChecked: true },
    })),
    failures,
    leanExecuted: true,
    axiomFree: policy.axiomFree,
    restingOnPermittedAxiomsOnly: policy.restingOnPermittedAxiomsOnly,
  }
}
