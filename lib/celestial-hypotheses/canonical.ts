/**
 * Canonical JSON and digests for the hypothesis registry.
 *
 * The algorithm is deliberately identical to `canonicalCelestialFactBundle` in
 * `lib/celestial-facts.ts` — recursive key sort, `JSON.stringify` — so a digest
 * taken here means the same thing as a digest taken over a fact bundle. A test
 * asserts the two agree on the same input rather than leaving that as a claim
 * in a comment.
 */

import { createHash } from 'node:crypto'

export function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)]),
    )
  }
  return value
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value))
}

export function sha256Hex(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

export function digestOf(value: unknown): string {
  return sha256Hex(canonicalJson(value))
}

/** True for an instant that is explicitly UTC — a trailing `Z`, not an offset. */
export function isExplicitUtcInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{1,3})?Z$/.test(value)) return false
  return Number.isFinite(new Date(value).getTime())
}
