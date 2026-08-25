/**
 * Pure canonicalization. No Node built-ins, so this module is safe in the
 * browser bundle as well as on the server.
 */

export const CANONICALIZATION_VERSION = 'maha-dossier-canonical/1.0' as const

/** The SHA-256 of the empty input. A dossier carrying this is unsigned. */
export const EMPTY_PAYLOAD_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

const DIGEST_FIELDS = new Set(['provenanceDigest', 'dossierDigest'])

/**
 * Canonical JSON: keys sorted, digest fields dropped, undefined dropped, dates
 * normalized to UTC ISO-8601 with second precision, strings NFC-normalized.
 */
export function canonicalize(value: unknown): unknown {
  if (value === null) return null
  if (typeof value === 'string') return normalizeScalarString(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite number cannot be canonicalized.')
    return value
  }
  if (typeof value === 'boolean') return value
  if (value instanceof Date) return normalizeInstant(value.toISOString())
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) {
      if (DIGEST_FIELDS.has(key)) continue
      const entry = source[key]
      if (entry === undefined) continue
      out[key] = canonicalize(entry)
    }
    return out
  }
  throw new Error(`Unsupported value of type ${typeof value} in canonicalization.`)
}

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

function normalizeScalarString(value: string): string {
  const nfc = value.normalize('NFC')
  return INSTANT.test(nfc) ? normalizeInstant(nfc) : nfc
}

/** All instants become UTC with second precision, so 2026-08-25T18:00+00:00 === ...T18:00:00Z. */
function normalizeInstant(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value.normalize('NFC')
  return `${parsed.toISOString().slice(0, 19)}Z`
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}


export function isPlaceholderDigest(digest: string): boolean {
  return digest.replace(/^sha256:/, '') === EMPTY_PAYLOAD_SHA256
}
