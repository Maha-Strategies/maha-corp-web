import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'

/**
 * Digest roles, kept apart by the type system.
 *
 * Every digest in this system is a lowercase `sha256:` string, so nothing in
 * the shape of the value stops one being passed where another is expected.
 * That is exactly what happened to the 33-record release package: it froze the
 * full-record digest and offered it where the release workspace expects the
 * review target, which is the same record hashed without its publication
 * envelope. Both are honest digests of real content; neither is a substitute
 * for the other.
 *
 * Branding makes the substitution a compile error, and the only way across a
 * role boundary is a conversion that recomputes the target from the source
 * object and records the schema it used.
 */

declare const roleTag: unique symbol

type Branded<Role extends string> = string & { readonly [roleTag]: Role }

/** sha256 over the complete record, publication envelope included. */
export type RecordRevisionDigest = Branded<'record-revision'>
/** sha256 over the record without its publication envelope. What the workspace lists. */
export type CandidateTargetDigest = Branded<'candidate-target'>
/** sha256 over an alignment audit. */
export type AuditDigest = Branded<'audit'>
/** sha256 over a bundle of scoped review decisions. */
export type ReviewBundleDigest = Branded<'review-bundle'>
/** sha256 a canonical release row binds to. Equals the candidate target it released. */
export type ReleaseTargetDigest = Branded<'release-target'>
/** sha256 over a rendered public projection. */
export type PublicationDigest = Branded<'publication'>

export type AnyDigest =
  | RecordRevisionDigest | CandidateTargetDigest | AuditDigest
  | ReviewBundleDigest | ReleaseTargetDigest | PublicationDigest

export const DIGEST_ROLES = [
  'record-revision', 'candidate-target', 'audit',
  'review-bundle', 'release-target', 'publication',
] as const
export type DigestRole = (typeof DIGEST_ROLES)[number]

const SHA256 = /^sha256:[0-9a-f]{64}$/

export class DigestRoleError extends Error {
  // A plain field, not a parameter property: the scripts run under
  // --experimental-strip-types, which cannot rewrite parameter properties.
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'DigestRoleError'
  }
}

const sha = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`

/**
 * The only way to obtain a branded digest from an untyped string.
 *
 * It is deliberately not a cast: it demands the object the digest is supposed
 * to describe, recomputes from that object, and refuses if the two disagree.
 * A caller holding only a string cannot get past this.
 */
export function attest<R extends DigestRole>(
  role: R, value: string, derive: () => string,
): Branded<R> {
  if (!SHA256.test(value)) throw new DigestRoleError('malformed-digest', `${role}: ${value.slice(0, 24)} is not a sha256 digest.`)
  const recomputed = derive()
  if (recomputed !== value) {
    throw new DigestRoleError('recomputation-mismatch',
      `${role}: recomputation does not match the supplied digest, so this value does not describe the object given.`)
  }
  return value as Branded<R>
}

/* ------------------------------------------------------------ producers ---- */

export function recordRevisionDigest(record: EpistemicRecord): RecordRevisionDigest {
  return sha(record) as RecordRevisionDigest
}

export function candidateTargetDigest(record: EpistemicRecord): CandidateTargetDigest {
  return epistemicReviewTargetHash(record) as CandidateTargetDigest
}

export function auditDigest(audit: unknown): AuditDigest {
  return sha(audit) as AuditDigest
}

export function reviewBundleDigest(bundle: unknown): ReviewBundleDigest {
  return sha(bundle) as ReviewBundleDigest
}

export function publicationDigest(projection: unknown): PublicationDigest {
  return sha(projection) as PublicationDigest
}

/* ---------------------------------------------------------- conversions ---- */

export interface Conversion<From extends DigestRole, To extends DigestRole> {
  from: From
  to: To
  schemaVersion: string
  derivedFrom: string
  result: string
}

/**
 * The one conversion this system permits, and it is not an equality.
 *
 * A record revision digest and a candidate target digest describe the same
 * record through different windows: the target omits the publication envelope,
 * which is mutable release bookkeeping rather than reviewed content. Given the
 * record, either can be recomputed. Given only the digest, neither yields the
 * other, which is why this takes the record and not a string.
 */
export function recordRevisionToCandidateTarget(
  record: EpistemicRecord, revision: RecordRevisionDigest,
): Conversion<'record-revision', 'candidate-target'> {
  const recomputed = recordRevisionDigest(record)
  if (recomputed !== revision) {
    throw new DigestRoleError('source-object-mismatch',
      'The record does not reproduce the revision digest, so it is not the object that digest describes.')
  }
  return {
    from: 'record-revision', to: 'candidate-target',
    schemaVersion: 'maha-digest-conversion/1.0',
    derivedFrom: 'the same EpistemicRecord, canonically serialized without its publication key',
    result: candidateTargetDigest(record),
  }
}

/** A release target is the candidate target that was released. Nothing is recomputed. */
export function candidateTargetAsReleaseTarget(target: CandidateTargetDigest): ReleaseTargetDigest {
  return target as unknown as ReleaseTargetDigest
}

/**
 * Whether two digests may ever legitimately be equal.
 *
 * Only one pair may: a release target is by construction the candidate target
 * it released. Every other equality is a coincidence or a bug, and reading it
 * as equivalence is how a review of one object comes to vouch for another.
 */
export function rolesMayBeEqual(left: DigestRole, right: DigestRole): boolean {
  if (left === right) return true
  const pair = [left, right].sort().join('|')
  return pair === 'candidate-target|release-target'
}

export function assertRolesDistinct(left: DigestRole, right: DigestRole, value: string): void {
  if (left !== right && !rolesMayBeEqual(left, right) && SHA256.test(value)) {
    throw new DigestRoleError('role-conflation',
      `${left} and ${right} are different quantities and must not be compared as strings.`)
  }
}
