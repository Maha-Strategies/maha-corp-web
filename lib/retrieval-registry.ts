import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'

/**
 * A record of what has already been tried, so effort is not spent twice.
 *
 * Across five batches the same 403s and dead links were re-encountered by
 * hand. This makes refusal mechanical: an identical route that already failed
 * is refused unless something about the attempt is genuinely different.
 *
 * Retrieval dates live in a bucket rather than a timestamp, and the bucket is
 * excluded from the evidentiary digest, so re-running on another day does not
 * change what the evidence package hashes to.
 */

export type ResponseClass =
  | 'ok' | 'not-found' | 'forbidden' | 'bot-challenge'
  | 'unresolvable-identifier' | 'identity-mismatch' | 'no-subject-match' | 'extraction-failed'

export interface RetrievalAttempt {
  sourceIdentity: string
  requestedVersion: string
  url: string
  retrievalMethod: 'direct-https' | 'repository-resolver' | 'doi-resolver' | 'pdf-read'
  outcome: 'obtained' | 'failed'
  responseClass: ResponseClass
  /** Coarse on purpose: a date bucket cannot make a digest drift day to day. */
  dateBucket: string
  contentFingerprint?: string | null
}

export type RefusalReason =
  | 'identical-route-already-failed'
  | 'identity-mismatch-recorded'

export interface RetrievalVerdict {
  permitted: boolean
  refusal: RefusalReason | null
  priorAttempts: number
  rationale: string
}

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`

const FAILED: ReadonlySet<ResponseClass> = new Set([
  'not-found', 'forbidden', 'bot-challenge', 'unresolvable-identifier', 'identity-mismatch', 'no-subject-match',
])

export interface RetrievalRequest {
  sourceIdentity: string
  requestedVersion: string
  url: string
  retrievalMethod: RetrievalAttempt['retrievalMethod']
  /** A different repository is a different attempt even at a similar address. */
  newRepository?: boolean
  availabilityMateriallyChanged?: boolean
  authorizedInstitutionalAccess?: boolean
}

/**
 * Whether a retrieval may proceed.
 *
 * The exemptions are deliberately narrow. Hoping a 403 has lifted is not a
 * material change; a different repository, a changed URL, or held institutional
 * access are.
 */
export function permitRetrieval(
  registry: readonly RetrievalAttempt[], request: RetrievalRequest,
): RetrievalVerdict {
  const sameRoute = registry.filter((entry) =>
    entry.url === request.url
    && entry.sourceIdentity === request.sourceIdentity
    && entry.requestedVersion === request.requestedVersion)

  const failedBefore = sameRoute.filter((entry) => FAILED.has(entry.responseClass))

  if (failedBefore.length > 0) {
    const exempt = request.newRepository === true
      || request.availabilityMateriallyChanged === true
      || request.authorizedInstitutionalAccess === true
    if (!exempt) {
      return {
        permitted: false,
        refusal: 'identical-route-already-failed',
        priorAttempts: sameRoute.length,
        rationale: `${request.url} already returned ${failedBefore[0].responseClass}. Retrying the same address is not a new attempt.`,
      }
    }
  }

  // An identifier that resolved to the wrong work stays refused for that
  // identity, whatever route is proposed: the mismatch is about the document.
  if (registry.some((entry) => entry.sourceIdentity === request.sourceIdentity && entry.responseClass === 'identity-mismatch')) {
    return {
      permitted: false,
      refusal: 'identity-mismatch-recorded',
      priorAttempts: sameRoute.length,
      rationale: `${request.sourceIdentity} previously resolved to a different work. A similar title is not the same source.`,
    }
  }

  return { permitted: true, refusal: null, priorAttempts: sameRoute.length, rationale: 'no identical prior failure' }
}

/** The digest deliberately omits date buckets so it is stable across days. */
export function registryDigest(registry: readonly RetrievalAttempt[]): string {
  return sha(registry.map(({ dateBucket: _dateBucket, ...rest }) => rest))
}

export function fingerprint(content: string): string {
  return sha(content).slice(7, 39)
}
