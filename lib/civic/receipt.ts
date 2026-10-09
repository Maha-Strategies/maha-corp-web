import { createHash } from 'node:crypto'
import canonicalize from 'canonicalize'
import { z } from 'zod'

export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const civicIdSchema = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/)
export const sourceUrlSchema = z.string().url().refine(value => new URL(value).protocol === 'https:', 'Use an HTTPS source URL.')

/** RFC 8785 JSON bytes. Digests establish integrity, never factual accuracy. */
export function canonicalJson(value: unknown): string {
  const encoded = canonicalize(value)
  if (encoded === undefined) throw new Error('Receipt is not JSON serializable.')
  return encoded
}

export function civicDigest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')
}

/** Freeze a detached JSON snapshot so callers cannot rewrite issued receipts. */
export function immutableSnapshot<T>(value: T): T {
  const snapshot: T = JSON.parse(canonicalJson(value))
  function freeze(item: unknown) {
    if (item !== null && typeof item === 'object') {
      for (const child of Object.values(item)) freeze(child)
      Object.freeze(item)
    }
  }
  freeze(snapshot)
  return snapshot
}
