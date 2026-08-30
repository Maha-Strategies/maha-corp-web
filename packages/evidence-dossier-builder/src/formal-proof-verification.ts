import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { compileFromBinding } from '../../maha-lean-bridge/src/compiler.ts'
import { canonicalJson as leanCanonicalJson, normalizeSourceText } from '../../maha-lean-bridge/src/canonicalize.ts'
import {
  assertValidBindingManifest,
  bindingManifestDigest,
  type BindingManifest,
} from '../../maha-lean-bridge/src/bindings.ts'
import {
  qualifiedName,
  type FormalProofAttachment,
  type ProofManifest,
} from '../../maha-lean-bridge/src/schema.ts'
import {
  manifestDigest,
  resolveActualLeanVersion,
  safeSourcePath,
  verifyAttachments,
} from '../../maha-lean-bridge/src/verifier.ts'
import {
  checkTrustRootSignature,
  loadSignedTrustRoot,
  trustRootFromEnvelope,
  TrustRootError,
  type FormalProofTrustRoot,
} from '../../../lib/evidence-dossier/formal-proof-trust-roots.ts'
import type { SignedTrustRootEnvelope } from '../../../lib/evidence-dossier/formal-proof-signing.ts'
import type { SigningKeyEntry } from '../../../lib/evidence-dossier/formal-proof-signing-keys.ts'

/**
 * Integrated verification of the formal proofs carried by a dossier package.
 *
 * The gap this closes: packaging previously trusted an attachment that merely
 * *said* `proofStatus: "verified"` and `machineChecked: true`. A fabricated
 * theorem with an invented name, an invented statement and all-zero digests was
 * packaged and passed offline verification with no findings, appearing in the
 * JSON-LD as a machine-checked statement. Saying you were verified is not being
 * verified.
 *
 * Two rules replace that trust.
 *
 * First, nothing is accepted as given. Every attachment is rebuilt from the
 * manifests the package itself carries, and the rebuilt object is compared with
 * the submitted one as canonical bytes. Any difference at all — a changed
 * statement, a reordered assumption, an extra field — is a mismatch, so this
 * catches drift nobody thought to write a specific check for.
 *
 * Second, verification means Lean actually ran. The proofs are rechecked
 * against the sources inside the package, using the toolchain the package pins,
 * by the same `verifyAttachments` the standalone bridge uses. When Lean is
 * absent the result is an explicit refusal, never silence: integrity inspection
 * is not a recheck and must never be reported as one.
 */

/** Project files a Lake build needs beyond the theorem sources themselves. */
export const REQUIRED_PROJECT_FILES: readonly string[] = ['lakefile.toml', 'Maha.lean']

/**
 * Checks the packaged manifests against out-of-package authorization.
 *
 * Everything else in this file establishes that the package agrees with itself.
 * This establishes that what it agrees on is what was authorized — a distinct
 * question, and the one a self-consistent forgery answers falsely.
 */
export function checkBindingAuthority(
  root: FormalProofTrustRoot,
  bindingManifest: BindingManifest,
  proofManifest: ProofManifest,
  attachments: readonly FormalProofAttachment[],
  dossierId: string,
): string[] {
  const findings: string[] = []
  if (root.dossierId !== dossierId) {
    findings.push('integrated-formal-proof-trust-root-dossier-mismatch')
    return findings
  }
  if (bindingManifestDigest(bindingManifest) !== root.bindingManifestSha256) {
    findings.push('integrated-formal-proof-binding-manifest-unauthorized')
  }
  if (manifestDigest(proofManifest) !== root.proofManifestSha256) {
    findings.push('integrated-formal-proof-proof-manifest-unauthorized')
  }
  // A revision below the authorized one is a downgrade; above it is a manifest
  // nobody has authorized yet. Neither is acceptable.
  if (bindingManifest.revision !== root.bindingManifestRevision) {
    findings.push('integrated-formal-proof-binding-revision-unauthorized')
  }
  for (const binding of bindingManifest.bindings) {
    if (!root.authorizedTheorems.includes(binding.qualifiedTheorem)) {
      findings.push('integrated-formal-proof-theorem-unauthorized')
    }
    for (const claimId of binding.claimIds) {
      if (!root.authorizedClaimIds.includes(claimId)) findings.push('integrated-formal-proof-claim-unauthorized')
    }
    for (const operationId of binding.calculationOperationIds) {
      if (!root.authorizedCalculationOperationIds.includes(operationId)) {
        findings.push('integrated-formal-proof-operation-unauthorized')
      }
    }
  }
  // The attachments themselves, not only the manifest they cite.
  for (const attachment of attachments) {
    if (!root.authorizedTheorems.includes(qualifiedName(attachment))) {
      findings.push('integrated-formal-proof-theorem-unauthorized')
    }
    for (const claimId of attachment.claimIds) {
      if (!root.authorizedClaimIds.includes(claimId)) findings.push('integrated-formal-proof-claim-unauthorized')
    }
    for (const operationId of attachment.calculationOperationIds) {
      if (!root.authorizedCalculationOperationIds.includes(operationId)) {
        findings.push('integrated-formal-proof-operation-unauthorized')
      }
    }
    if (attachment.toolchain !== root.toolchain) findings.push('integrated-formal-proof-toolchain-unauthorized')
  }
  if (proofManifest.toolchain !== root.toolchain) findings.push('integrated-formal-proof-toolchain-unauthorized')
  return [...new Set(findings)]
}

export interface PackagedFormalProofInput {
  attachments: readonly FormalProofAttachment[]
  proofManifest: ProofManifest
  bindingManifest: BindingManifest
  /** Contents of `lean-toolchain`, trimmed. */
  toolchain: string
  /** Package-relative Lean path to its normalized text, as carried in the package. */
  leanSources: Readonly<Record<string, string>>
  dossierId: string
  declaredClaimIds: readonly string[]
  /**
   * The out-of-package authority. Absent means unauthorized, never "skip the
   * check": a package that arrives without a trust root is one nobody has
   * authorized.
   */
  trustRoot?: FormalProofTrustRoot
  /**
   * The signed envelope carrying that authority.
   *
   * `null` means the caller looked and found none — a package that shipped no
   * authorization — and fails closed. `undefined` means no package context, so
   * the committed envelope is resolved. The distinction matters: falling back
   * to the repository's copy when a package omits one would hand every
   * unauthorized package the repository's authorization for free.
   */
  signedTrustRoot?: SignedTrustRootEnvelope | null
  /** Test-only registry override. Production resolves the committed registry. */
  signingKeyRegistry?: readonly SigningKeyEntry[]
  /** Test-only clock for validity windows. */
  now?: Date
}

/** Injected Lean runners. Test-only; the production entry point accepts none. */
export interface LeanRunners {
  runLeanBuild?: (packageRoot: string) => { ok: boolean; output: string }
  runAxiomCheck?: (packageRoot: string, names: readonly string[]) => { ok: boolean; output: string }
  resolveLeanVersion?: () => string | null
  /** Test-only key registry override. Production resolves the committed one. */
  signingKeyRegistry?: readonly SigningKeyEntry[]
  /** Test-only clock for signature validity windows. */
  now?: Date
}

/**
 * The exact set of Lean files a package must carry.
 *
 * Deriving this from theorem-bearing files alone is not enough, and getting it
 * wrong is silent: `Maha/CanonicalArithmetic.lean` holds only definitions, so it
 * appears in no theorem's `sourceFile`, and a package without it builds nothing
 * because every other module imports it.
 *
 * The root module is the library's own declaration of what it contains, so the
 * expected set is what it imports, plus the project files a Lake build needs,
 * plus every file a cited theorem lives in.
 *
 * Both directions matter: an omitted source cannot be rechecked, and an
 * undeclared extra source is unreviewed material shipped inside an evidence
 * package.
 */
export function expectedLeanSources(proofManifest: ProofManifest, rootModuleText: string): string[] {
  const files = new Set<string>(REQUIRED_PROJECT_FILES)
  for (const line of rootModuleText.split('\n')) {
    const imported = /^\s*import\s+(Maha(?:\.[A-Za-z_][A-Za-z0-9_']*)*)\s*$/.exec(line)
    if (imported) files.add(`${imported[1].split('.').join('/')}.lean`)
  }
  for (const theorem of proofManifest.theorems) files.add(theorem.sourceFile)
  return [...files].sort()
}

/**
 * Writes the packaged Lean sources to a scratch directory.
 *
 * Verification runs against what the package carries, not against whatever
 * happens to be in the developer's checkout. Otherwise a package could be
 * declared valid on the strength of files it does not contain.
 */
function materialize(input: PackagedFormalProofInput): string {
  const root = mkdtempSync(join(tmpdir(), 'maha-formal-proof-verify-'))
  writeFileSync(join(root, 'lean-toolchain'), `${input.toolchain}\n`)
  for (const [path, text] of Object.entries(input.leanSources)) {
    // Re-checked here as well as in the caller: this is the point where a
    // hostile path would escape the scratch directory.
    if (!safeSourcePath(root, path)) continue
    const target = join(root, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, text)
  }
  return root
}

/**
 * Verifies the formal proofs a package carries.
 *
 * `runners` exists for tests and is deliberately absent from the production
 * entry point, so a caller cannot hand in a fake Lean result and obtain a
 * production-valid verdict.
 */
export function verifyPackagedFormalProofs(input: PackagedFormalProofInput, runners: LeanRunners = {}): string[] {
  const findings: string[] = []
  if (input.attachments.length === 0) return findings

  try {
    assertValidBindingManifest(input.bindingManifest)
  } catch {
    findings.push('integrated-formal-binding-manifest-invalid')
    return findings
  }

  // Signature first. Nothing the envelope's payload says may be believed before
  // the signature over it is checked, or a forged payload would be used to
  // decide whether the forged payload is acceptable.
  const envelope = input.signedTrustRoot === undefined ? loadSignedTrustRoot() : (input.signedTrustRoot ?? undefined)
  const signature = checkTrustRootSignature(envelope, input.dossierId, {
    registry: input.signingKeyRegistry,
    now: input.now,
  })
  if (!signature.authentic || !signature.authorityValid) {
    for (const failure of signature.failures) findings.push(`integrated-formal-proof-${failure}`)
    for (const failure of signature.authorityFailures) findings.push(`integrated-formal-proof-${failure}`)
    return [...new Set(findings)]
  }

  // Authorization next. A package that agrees with itself about the wrong thing
  // must not reach the Lean recheck and come back clean. The authorized facts
  // come from the signed payload, never from the package.
  let trustRoot: FormalProofTrustRoot
  try {
    trustRoot = input.trustRoot ?? trustRootFromEnvelope(envelope!)
  } catch (error) {
    findings.push(
      error instanceof TrustRootError && /Ambiguous/.test(error.message)
        ? 'integrated-formal-proof-trust-root-ambiguous'
        : error instanceof TrustRootError && /No trust root/.test(error.message)
          ? 'integrated-formal-proof-trust-root-missing'
          : 'integrated-formal-proof-trust-root-malformed',
    )
    return findings
  }
  findings.push(...checkBindingAuthority(trustRoot, input.bindingManifest, input.proofManifest, input.attachments, input.dossierId))
  if (findings.length) return [...new Set(findings)]

  // The manifests must be the ones the attachments were authorized against.
  const bindingDigest = bindingManifestDigest(input.bindingManifest)
  const proofDigest = manifestDigest(input.proofManifest)

  // Exact source set. Omissions and extras are both refusals.
  const rootModule = input.leanSources['Maha.lean']
  if (rootModule === undefined) {
    findings.push('integrated-formal-proof-source-omitted')
    return findings
  }
  const expected = expectedLeanSources(input.proofManifest, rootModule)
  const supplied = Object.keys(input.leanSources).sort()
  for (const path of supplied) {
    if (!safeSourcePath('/maha-verification-root', path)) findings.push('integrated-formal-proof-source-path-unsafe')
  }
  for (const path of expected) if (!supplied.includes(path)) findings.push('integrated-formal-proof-source-omitted')
  for (const path of supplied) if (!expected.includes(path)) findings.push('integrated-formal-proof-source-undeclared')
  if (findings.length) return [...new Set(findings)]

  // Every recorded source digest must match the bytes the package carries.
  for (const theorem of input.proofManifest.theorems) {
    const text = input.leanSources[theorem.sourceFile]
    const actual = `sha256:${createHash('sha256').update(normalizeSourceText(text), 'utf8').digest('hex')}`
    if (actual !== theorem.sourceSha256) findings.push('integrated-formal-proof-manifest-source-mismatch')
  }
  if (findings.length) return [...new Set(findings)]

  const root = materialize(input)
  try {
    // Reconstruct each attachment from the packaged manifests and compare
    // canonical bytes. This is what makes a fabricated attachment impossible:
    // it is not checked field by field, it is rebuilt and diffed whole.
    for (const submitted of input.attachments) {
      const binding = input.bindingManifest.bindings.find(
        (entry) => entry.bindingId === submitted.bindingId && entry.dossierId === submitted.dossierId,
      )
      if (!binding) { findings.push('integrated-formal-proof-binding-unknown'); continue }
      if (qualifiedName(submitted) !== binding.qualifiedTheorem) { findings.push('integrated-formal-proof-theorem-unknown'); continue }
      if (submitted.bindingManifestSha256 !== bindingDigest) { findings.push('integrated-formal-proof-binding-manifest-stale'); continue }
      if (submitted.proofManifestSha256 !== proofDigest) { findings.push('integrated-formal-proof-manifest-stale'); continue }
      if (submitted.dossierId !== input.dossierId) { findings.push('integrated-formal-proof-dossier-mismatch'); continue }
      if (submitted.bindingRevision !== binding.revision) { findings.push('integrated-formal-proof-binding-revision-stale'); continue }

      let rebuilt: FormalProofAttachment
      try {
        rebuilt = compileFromBinding(
          { theoremId: submitted.theoremId, bindingId: binding.bindingId },
          input.bindingManifest,
          input.proofManifest,
          root,
        )
      } catch { findings.push('integrated-formal-proof-not-reconstructible'); continue }

      // A verified attachment is the reconstruction plus exactly the two fields
      // verification is allowed to set. Everything else must already agree.
      const expectedVerified: FormalProofAttachment = {
        ...rebuilt,
        proofStatus: 'verified',
        assurance: { ...rebuilt.assurance, machineChecked: true },
      }
      if (leanCanonicalJson(submitted) !== leanCanonicalJson(expectedVerified)) {
        findings.push('integrated-formal-proof-reconstruction-mismatch')
      }
    }
    if (findings.length) return [...new Set(findings)]

    // Lean must actually run. Absent it, say so rather than reporting silence.
    const leanVersion = runners.resolveLeanVersion ? runners.resolveLeanVersion() : resolveActualLeanVersion(root)
    if (leanVersion === null) {
      findings.push('integrated-formal-proof-recheck-not-executed')
      return findings
    }

    // Submitted at baseline. A packaged attachment already carries
    // machineChecked: true, and verifyAttachments treats a caller asserting
    // that as fatal overreach — correctly, since that is exactly the forgery it
    // defends against. The recheck therefore asks the question afresh and then
    // compares its answer with what the package shipped.
    const resubmitted = input.attachments.map((attachment) => ({
      ...attachment,
      proofStatus: 'unverified' as const,
      assurance: {
        machineChecked: false,
        empiricallyValidated: false as const,
        independentlyReproduced: false as const,
        compilerEquivalenceProven: false as const,
        scientificModelCertified: false as const,
      },
    }))
    const outcome = verifyAttachments(resubmitted, {
      packageRoot: root,
      manifest: input.proofManifest,
      bindingManifest: input.bindingManifest,
      declaredClaimIds: input.declaredClaimIds,
      dossierId: input.dossierId,
      ...runners,
    })
    if (!outcome.leanExecuted) findings.push('integrated-formal-proof-recheck-not-executed')
    for (const failure of outcome.failures) findings.push(`integrated-formal-proof-recheck-failed:${failure.code}`)
    if (outcome.verified.length !== input.attachments.length) findings.push('integrated-formal-proof-recheck-incomplete')

    // The rechecked result must equal what the package ships, byte for byte.
    const rechecked = new Map(outcome.verified.map((item) => [item.theoremId, leanCanonicalJson(item)]))
    for (const submitted of input.attachments) {
      const match = rechecked.get(submitted.theoremId)
      if (match === undefined || match !== leanCanonicalJson(submitted)) {
        findings.push('integrated-formal-proof-recheck-mismatch')
      }
    }
    return [...new Set(findings)]
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
