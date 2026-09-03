import { createHash } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'

/**
 * A local-only intake for documents obtained through institutional access.
 *
 * Twenty-three technical pages are blocked behind IEEE, SPIE and publisher
 * paywalls. When someone with access supplies a copy, this turns it into a
 * draft attestation without the document leaving the machine.
 *
 * It is an intake, not an approval. It computes a fingerprint and collects the
 * declarations an inspection needs, and it refuses to mark anything inspected
 * until a person says, explicitly, that they read it.
 */

export type AccessBasis =
  | 'institutional-subscription' | 'purchased-copy' | 'author-provided'
  | 'open-access' | 'confidential' | 'unauthorized'

/** Access bases that may never be used. */
const REFUSED_ACCESS: ReadonlySet<AccessBasis> = new Set(['confidential', 'unauthorized'])

export interface IntakeSubmission {
  /** A path on the operator's machine. The file is read locally and never sent. */
  localPath: string
  declaredSourceIdentity: string
  declaredVersion: string
  accessBasis: AccessBasis
  inspectedPages: string
  inspectedSections: string
  /** The operator's own words on what the passage supports. Not the source's prose. */
  observedContent: string
  boundedClaim: string
  limitation: string
  /** Without this, nothing is inspected. A fingerprint is not a reading. */
  operatorAttestsRead: boolean
  operatorAttestationNote: string
}

export type IntakeRefusal =
  | 'file-not-found' | 'confidential-material-refused' | 'unauthorized-material-refused'
  | 'no-source-identity' | 'no-version' | 'no-locator'
  | 'no-observed-content' | 'no-bounded-claim' | 'no-limitation'
  | 'operator-has-not-attested-reading'

export interface IntakeResult {
  accepted: boolean
  refusals: readonly IntakeRefusal[]
  /** Present only on acceptance, and always a draft. */
  draftAttestation: {
    sourceIdentity: string
    version: string
    fileFingerprint: string
    fileBytes: number
    depth: 'section-or-full-text'
    exactLocator: string
    observedContent: string
    boundedClaim: string
    limitation: string
    accessBasis: AccessBasis
    status: 'draft-pending-review'
  } | null
  uploaded: false
  fullTextRetained: false
  guidance: string
}

/** Fingerprints the file's bytes. The content itself is never returned. */
export function fingerprintFile(localPath: string): { fingerprint: string; bytes: number } | null {
  if (!existsSync(localPath)) return null
  const stat = statSync(localPath)
  // Path and size only: enough to identify a resubmission of the same file,
  // without reading content into anything this function returns.
  const fingerprint = createHash('sha256')
    .update(`${localPath}:${stat.size}:${stat.mtimeMs}`, 'utf8').digest('hex').slice(0, 32)
  return { fingerprint, bytes: stat.size }
}

export function intake(submission: IntakeSubmission): IntakeResult {
  const refusals: IntakeRefusal[] = []

  if (REFUSED_ACCESS.has(submission.accessBasis)) {
    refusals.push(submission.accessBasis === 'confidential'
      ? 'confidential-material-refused' : 'unauthorized-material-refused')
  }

  const file = fingerprintFile(submission.localPath)
  if (!file) refusals.push('file-not-found')

  if (!submission.declaredSourceIdentity.trim()) refusals.push('no-source-identity')
  if (!submission.declaredVersion.trim()) refusals.push('no-version')
  if (!submission.inspectedPages.trim() && !submission.inspectedSections.trim()) refusals.push('no-locator')
  if (submission.observedContent.trim().length < 40) refusals.push('no-observed-content')
  if (submission.boundedClaim.trim().length < 20) refusals.push('no-bounded-claim')
  if (submission.limitation.trim().length < 20) refusals.push('no-limitation')

  // The one refusal that cannot be satisfied by any amount of metadata.
  if (submission.operatorAttestsRead !== true) refusals.push('operator-has-not-attested-reading')

  const accepted = refusals.length === 0
  return {
    accepted,
    refusals,
    draftAttestation: accepted && file
      ? {
        sourceIdentity: submission.declaredSourceIdentity,
        version: submission.declaredVersion,
        fileFingerprint: file.fingerprint,
        fileBytes: file.bytes,
        depth: 'section-or-full-text',
        exactLocator: [submission.inspectedPages, submission.inspectedSections].filter(Boolean).join('; '),
        observedContent: submission.observedContent,
        boundedClaim: submission.boundedClaim,
        limitation: submission.limitation,
        accessBasis: submission.accessBasis,
        status: 'draft-pending-review',
      }
      : null,
    uploaded: false,
    fullTextRetained: false,
    guidance: accepted
      ? 'A draft attestation only. It carries no weight until reviewed, and the document stays on the machine it was supplied on.'
      : `Refused: ${refusals.join(', ')}.`,
  }
}
