import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { canonicalJson, normalizeSourceText } from './canonicalize.ts'
import {
  PROOF_ESCAPES,
  qualifiedName,
  type FormalProofAttachment,
  type ProofManifest,
} from './schema.ts'

/**
 * Verification of formal-proof attachments.
 *
 * The rule this module exists to enforce: `machineChecked` is set here, from a
 * real Lean result, and nowhere else. A caller who hands us an attachment
 * claiming `machineChecked: true` gets it stripped before anything else runs,
 * because the claim has no standing until we reproduce it.
 *
 * Two Lean facts are required, and text scanning is neither of them:
 *
 *   1. `lake build` exits zero, so the source elaborates and every proof
 *      genuinely closes its goal;
 *   2. `#print axioms <theorem>` does not report `sorryAx`, which is what a
 *      `sorry` leaves behind. A `sorry` only warns during a build, so exit
 *      status alone would let a hole through.
 *
 * The escape-token scan is kept as a cheap first refusal, not as the proof.
 */

export interface VerificationFailure {
  code:
    | 'source-missing'
    | 'source-digest-stale'
    | 'toolchain-stale'
    | 'manifest-digest-stale'
    | 'theorem-unknown'
    | 'statement-changed'
    | 'assumptions-changed'
    | 'duplicate-theorem'
    | 'claim-unknown'
    | 'dossier-mismatch'
    | 'proof-escape-present'
    | 'lean-build-failed'
    | 'sorry-axiom-present'
    | 'assurance-overreach'
    | 'boundary-missing'
    | 'lean-unavailable'
  detail: string
  theoremId?: string
}

export interface VerificationOutcome {
  verified: FormalProofAttachment[]
  failures: VerificationFailure[]
  /** True only when Lean actually ran. Absent Lean, nothing can be verified. */
  leanExecuted: boolean
}

export interface VerifyOptions {
  packageRoot: string
  manifest: ProofManifest
  /** Declared claim ids of the dossier the attachments bind to. */
  declaredClaimIds: readonly string[]
  dossierId: string
  /** Injectable for tests: runs `lake build` and returns success. */
  runLeanBuild?: (packageRoot: string) => { ok: boolean; output: string }
  /** Injectable for tests: returns the axioms each theorem depends on. */
  runAxiomCheck?: (packageRoot: string, names: readonly string[]) => { ok: boolean; output: string }
}

const LEAN_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  // Verification must not reach the network once the toolchain is installed.
  ELAN_HOME: process.env.ELAN_HOME ?? join(process.env.HOME ?? '', '.elan'),
  // A fixed locale, so nothing Lean prints is locale-ordered.
  LC_ALL: 'C',
  LANG: 'C',
}

export function leanAvailable(): boolean {
  try {
    execFileSync('lake', ['--version'], { env: LEAN_ENV, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
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
 * A proof closed by `sorry` depends on `sorryAx`. This is the check that cannot
 * be faked by editing text, because it is computed from the elaborated
 * environment.
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
 * Verifies attachments against the Lean sources and a real Lean run.
 *
 * Returns only attachments that passed every check. A failure never downgrades
 * to a warning: an attachment either earns `machineChecked` or does not appear.
 */
export function verifyAttachments(
  attachments: readonly FormalProofAttachment[],
  options: VerifyOptions,
): VerificationOutcome {
  const failures: VerificationFailure[] = []
  const candidates: FormalProofAttachment[] = []
  const root = resolve(options.packageRoot)
  const digest = manifestDigest(options.manifest)
  const byName = new Map(options.manifest.theorems.map((t) => [qualifiedName(t), t]))
  const seenIds = new Set<string>()
  const seenTheorems = new Set<string>()

  for (const submitted of attachments) {
    // A caller's assurance claims carry no weight. Strip them to the baseline
    // and let verification decide what is earned.
    const attachment: FormalProofAttachment = {
      ...submitted,
      proofStatus: 'unverified',
      assurance: {
        machineChecked: false,
        empiricallyValidated: false,
        independentlyReproduced: false,
        compilerEquivalenceProven: false,
        scientificModelCertified: false,
      },
    }
    const fail = (code: VerificationFailure['code'], detail: string) => {
      failures.push({ code, detail, theoremId: submitted.theoremId })
    }

    // Read through an unknown-shaped view: the declared types say these are
    // literal `false`, but an attachment arriving as JSON is not bound by the
    // type, and that is precisely the forgery this refuses.
    const claimed = (submitted.assurance ?? {}) as unknown as Record<string, unknown>
    if (claimed.machineChecked === true) {
      fail('assurance-overreach', 'A submitted attachment cannot assert machineChecked; it is set by verification.')
    }
    for (const flag of ['empiricallyValidated', 'independentlyReproduced', 'compilerEquivalenceProven', 'scientificModelCertified'] as const) {
      if (claimed[flag] === true) {
        fail('assurance-overreach', `${flag} cannot be true: nothing in this package can establish it.`)
      }
    }
    if (!submitted.informalBoundary?.trim()) {
      fail('boundary-missing', 'An attachment must state what the proof does not establish.')
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
    const unknownClaims = submitted.claimIds.filter((id) => !options.declaredClaimIds.includes(id))
    if (unknownClaims.length > 0) {
      fail('claim-unknown', `Claims not declared by the dossier: ${unknownClaims.join(', ')}.`)
      continue
    }
    if (submitted.proofManifestSha256 !== digest) {
      fail('manifest-digest-stale', 'Attachment cites a different proof manifest than the one supplied.')
      continue
    }
    if (submitted.toolchain !== options.manifest.toolchain || submitted.leanVersion !== options.manifest.leanVersion) {
      fail('toolchain-stale', `Attachment cites ${submitted.toolchain}/${submitted.leanVersion}, manifest declares ${options.manifest.toolchain}/${options.manifest.leanVersion}.`)
      continue
    }

    const known = byName.get(name)
    if (!known) {
      fail('theorem-unknown', `${name} is not in the proof manifest.`)
      continue
    }

    const sourcePath = join(root, submitted.sourceFile)
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

    candidates.push(attachment)
  }

  if (candidates.length === 0) return { verified: [], failures, leanExecuted: false }

  const build = (options.runLeanBuild ?? defaultBuild)(root)
  if (!build.ok) {
    failures.push({ code: 'lean-build-failed', detail: build.output.slice(0, 4000) })
    return { verified: [], failures, leanExecuted: true }
  }

  const names = candidates.map(qualifiedName)
  const axioms = (options.runAxiomCheck ?? defaultAxiomCheck)(root, names)
  if (!axioms.ok) {
    failures.push({ code: 'lean-build-failed', detail: axioms.output.slice(0, 4000) })
    return { verified: [], failures, leanExecuted: true }
  }
  if (/sorryAx/.test(axioms.output)) {
    // One theorem depending on sorryAx invalidates the run: we cannot tell from
    // the aggregate output which are sound without per-theorem attribution.
    failures.push({ code: 'sorry-axiom-present', detail: 'Lean reports a sorryAx dependency; no attachment can be verified from this build.' })
    return { verified: [], failures, leanExecuted: true }
  }

  return {
    verified: candidates.map((attachment) => ({
      ...attachment,
      proofStatus: 'verified',
      assurance: { ...attachment.assurance, machineChecked: true },
    })),
    failures,
    leanExecuted: true,
  }
}
