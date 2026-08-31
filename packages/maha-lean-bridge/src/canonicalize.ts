/**
 * Deterministic serialization for formal-proof artifacts.
 *
 * Every digest in this package is taken over the output of `canonicalJson`, so
 * the same content always produces the same bytes regardless of key insertion
 * order, host locale, or platform line endings.
 *
 * Three specific hazards are handled explicitly because each of them has
 * silently broken determinism in real pipelines:
 *
 *   * key order — object keys are sorted by Unicode code point, never by
 *     `localeCompare`, which is locale-sensitive and would order differently
 *     under a different `LANG`;
 *   * line endings — a Lean source checked out on Windows would otherwise hash
 *     differently from the same source on Linux;
 *   * absolute paths — no artifact may embed a machine-specific path, so paths
 *     are normalized to repository-relative form before they are recorded.
 */

/** Sorts by Unicode code point. Deliberately not `localeCompare`. */
function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function canonicalize(value: unknown): unknown {
  if (value === null) return null
  if (typeof value === 'string') return value.normalize('NFC')
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite number cannot be canonicalized.')
    return value
  }
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort(byCodePoint)) {
      const entry = source[key]
      if (entry === undefined) continue
      out[key] = canonicalize(entry)
    }
    return out
  }
  throw new Error(`Unsupported value of type ${typeof value} in canonicalization.`)
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

/**
 * Normalizes source text before hashing.
 *
 * CRLF and lone CR become LF so the digest is a property of the source, not of
 * the checkout that produced it.
 */
export function normalizeSourceText(text: string): string {
  return text.replace(/\r\n?/g, '\n').normalize('NFC')
}

/**
 * Rejects absolute paths and parent traversal.
 *
 * An artifact that embeds `/Users/someone/...` is not portable and leaks the
 * layout of the machine that built it.
 */
export function assertRepositoryRelative(path: string, field: string): void {
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) {
    throw new Error(`${field} must be repository-relative, got an absolute path.`)
  }
  if (path.split(/[\\/]/).includes('..')) {
    throw new Error(`${field} must not traverse outside the package.`)
  }
}
