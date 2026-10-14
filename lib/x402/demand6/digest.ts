import { createHash } from 'node:crypto'
import canonicalizeModule from 'canonicalize'
// canonicalize 2.x is CommonJS with an ESM-shaped declaration; its runtime default is callable.
const canonicalize = canonicalizeModule as unknown as (input: unknown) => string | undefined

/** RFC-8785 canonical bytes, identical to the seller digest. No source registry, models or network. */
export function demandDigest(value: unknown): string {
  const text = canonicalize(value)
  if (text === undefined) throw new Error('non_json_result')
  return 'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex')
}
