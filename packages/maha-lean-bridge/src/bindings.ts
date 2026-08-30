import { createHash } from 'node:crypto'

import { canonicalJson } from './canonicalize.ts'

/**
 * Trusted theorem-to-claim bindings.
 *
 * The problem this solves: a verifier that only checks "does this claim exist?"
 * will happily attach a proved theorem about interval arithmetic to a claim
 * about resist chemistry. Both are real, the proof is genuine, and the result is
 * nonsense. Existence is not authorization.
 *
 * A binding is the authorization. It is declared once, reviewed as content, and
 * digested. The compiler builds attachments *from* bindings rather than from
 * caller-supplied associations, and the verifier compares every submitted field
 * against the binding and fails closed on any difference.
 *
 * Ordering is significant everywhere in this file. `assumptions` reads as a
 * numbered list in the rendered dossier, and `claimIds` and
 * `calculationOperationIds` are compared element-wise. None of these are sets,
 * so none of them is sorted before comparison: reordering is a change.
 */

export const BINDING_MANIFEST_VERSION = 'maha-formal-claim-binding/0.1' as const

export interface FormalClaimBinding {
  /** Stable identity of this binding. Unique within the manifest. */
  bindingId: string
  /** Incremented whenever any field below changes. */
  revision: number
  /** The dossier this theorem is authorized for. */
  dossierId: string
  /** Fully qualified Lean name, e.g. `Maha.Interval.add_valid`. */
  qualifiedTheorem: string
  /** The exact claims this theorem is authorized to be attached to. Ordered. */
  claimIds: readonly string[]
  /** The empirical premises the claim rests on. Ordered; renders as a list. */
  assumptions: readonly string[]
  /** What the proof does not establish. Required and non-empty. */
  informalBoundary: string
  /** Calculation operations this proof relates to. Ordered; may be empty. */
  calculationOperationIds: readonly string[]
}

export interface BindingManifest {
  schemaVersion: typeof BINDING_MANIFEST_VERSION
  bindings: readonly FormalClaimBinding[]
}

/** Identity of a binding for lookup: one theorem is authorized once per dossier. */
export function bindingKey(binding: Pick<FormalClaimBinding, 'dossierId' | 'qualifiedTheorem'>): string {
  return `${binding.dossierId}::${binding.qualifiedTheorem}`
}

/**
 * Digest over the whole manifest.
 *
 * Any change to any binding moves this, which invalidates every attachment
 * citing the old value. That refusal is the point: a binding is content, and
 * changing content must not be silent.
 */
export function bindingManifestDigest(manifest: BindingManifest): string {
  return `sha256:${createHash('sha256').update(canonicalJson(manifest), 'utf8').digest('hex')}`
}

export class BindingError extends Error {}

/**
 * Validates the manifest's internal consistency.
 *
 * A manifest that authorizes the same theorem twice for one dossier, or that
 * omits a boundary, cannot be used: the first makes authorization ambiguous and
 * the second would let an attachment ship without stating its limits.
 */
export function assertValidBindingManifest(manifest: BindingManifest): void {
  if (manifest.schemaVersion !== BINDING_MANIFEST_VERSION) {
    throw new BindingError(`Unknown binding manifest version ${manifest.schemaVersion}.`)
  }
  const seenIds = new Set<string>()
  const seenKeys = new Set<string>()
  for (const binding of manifest.bindings) {
    if (seenIds.has(binding.bindingId)) {
      throw new BindingError(`Duplicate bindingId ${binding.bindingId}.`)
    }
    seenIds.add(binding.bindingId)

    const key = bindingKey(binding)
    if (seenKeys.has(key)) {
      throw new BindingError(`${binding.qualifiedTheorem} is authorized twice for ${binding.dossierId}.`)
    }
    seenKeys.add(key)

    if (!Number.isInteger(binding.revision) || binding.revision < 1) {
      throw new BindingError(`${binding.bindingId} must carry an integer revision of at least 1.`)
    }
    if (binding.claimIds.length === 0) {
      throw new BindingError(`${binding.bindingId} must authorize at least one claim.`)
    }
    if (new Set(binding.claimIds).size !== binding.claimIds.length) {
      throw new BindingError(`${binding.bindingId} lists a claim more than once.`)
    }
    if (!binding.informalBoundary.trim()) {
      throw new BindingError(`${binding.bindingId} must state what the proof does not establish.`)
    }
  }
}

/** Finds the binding authorizing a theorem for a dossier, or undefined. */
export function findBinding(
  manifest: BindingManifest,
  dossierId: string,
  qualifiedTheorem: string,
): FormalClaimBinding | undefined {
  return manifest.bindings.find((binding) => bindingKey(binding) === bindingKey({ dossierId, qualifiedTheorem }))
}

/** Element-wise comparison. Deliberately order-sensitive; these are lists, not sets. */
export function sameOrderedList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}
