import { createHash, timingSafeEqual } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'

/**
 * What a protected dispatch must carry before it may run.
 *
 * A session authorization for three runs was used for six. Nothing mutating
 * executed, but nothing structural stopped it either: the approval lived in
 * conversation and the gate could not tell one purpose from another.
 *
 * An authorization here names a purpose, a commit and a count. Anything not
 * named is a new request rather than a smaller version of one already granted,
 * and an exhausted grant refuses rather than degrading to a warning.
 */

export type RunPurpose = 'readiness' | 'diagnosis' | 'canary' | 'remainder' | 'preview-rehearsal'

export const MUTATING_PURPOSES: ReadonlySet<RunPurpose> = new Set(['canary', 'remainder'])

export interface DispatchAuthorization {
  authorizationId: string
  operation: string
  /** The exact commit the authorizer reviewed. Not a branch, which moves. */
  reviewedCommit: string
  allowedPurposes: readonly RunPurpose[]
  expiresAt: string
  maxInvocations: number
  invocationsUsed: number
  /** Whether this grant may hand the run a mutation-capable credential. */
  grantsReleaseAuthority: boolean
}

export interface DispatchRequest {
  authorizationId: string
  operation: string
  commit: string
  purpose: RunPurpose
  at: string
  requestsReleaseAuthority: boolean
}

export type DispatchRefusal =
  | 'unknown-authorization' | 'operation-mismatch' | 'commit-mismatch'
  | 'purpose-not-authorized' | 'authorization-expired' | 'invocations-exhausted'
  | 'release-authority-not-granted' | 'malformed-commit'

export interface DispatchVerdict {
  permitted: boolean
  refusals: readonly DispatchRefusal[]
  remainingInvocations: number
  requestDigest: string
}

const COMMIT = /^[0-9a-f]{40}$/

/** Constant-time so an identifier cannot be probed character by character. */
function idMatches(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8')
  const b = Buffer.from(right, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function authorizeDispatch(
  authorization: DispatchAuthorization | null,
  request: DispatchRequest,
): DispatchVerdict {
  const refusals: DispatchRefusal[] = []
  const requestDigest = `sha256:${createHash('sha256').update(canonicalJson(request), 'utf8').digest('hex')}`

  if (!authorization || !idMatches(authorization.authorizationId, request.authorizationId)) {
    // Fail closed and say nothing more: without a grant there is nothing to compare.
    return { permitted: false, refusals: ['unknown-authorization'], remainingInvocations: 0, requestDigest }
  }
  if (authorization.operation !== request.operation) refusals.push('operation-mismatch')
  if (!COMMIT.test(request.commit)) refusals.push('malformed-commit')
  // The reviewed commit is the unit of authorization. A later commit was not reviewed.
  else if (authorization.reviewedCommit !== request.commit) refusals.push('commit-mismatch')
  if (!authorization.allowedPurposes.includes(request.purpose)) refusals.push('purpose-not-authorized')

  const expiry = Date.parse(authorization.expiresAt)
  const at = Date.parse(request.at)
  if (!Number.isFinite(expiry) || !Number.isFinite(at) || at > expiry) refusals.push('authorization-expired')

  const remaining = authorization.maxInvocations - authorization.invocationsUsed
  if (remaining <= 0) refusals.push('invocations-exhausted')

  // A read-only purpose must not receive release authority just because the
  // grant happens to allow a mutating purpose too.
  if (request.requestsReleaseAuthority && !authorization.grantsReleaseAuthority) {
    refusals.push('release-authority-not-granted')
  }
  if (request.requestsReleaseAuthority && !MUTATING_PURPOSES.has(request.purpose)) {
    refusals.push('release-authority-not-granted')
  }

  return {
    permitted: refusals.length === 0,
    refusals,
    remainingInvocations: Math.max(0, remaining),
    requestDigest,
  }
}

/** Consuming an invocation is explicit, so a replay cannot be silent. */
export function consume(authorization: DispatchAuthorization): DispatchAuthorization {
  if (authorization.invocationsUsed >= authorization.maxInvocations) {
    throw new Error(`${authorization.authorizationId} is exhausted.`)
  }
  return { ...authorization, invocationsUsed: authorization.invocationsUsed + 1 }
}
