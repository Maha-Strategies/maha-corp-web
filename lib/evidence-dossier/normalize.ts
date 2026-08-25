/**
 * Normalization and structural safety for operator-supplied JSON.
 *
 * Runs before validation so everything downstream sees canonical shapes, and
 * so a pathological document is rejected rather than walked.
 */

export const MAX_PAYLOAD_BYTES = 2_000_000
export const MAX_DEPTH = 24
export const MAX_NODES = 20_000
export const MAX_STRING_LENGTH = 20_000
export const MAX_ARRAY_LENGTH = 2_000

export class NormalizationError extends Error {
  path: string

  constructor(message: string, path: string) {
    super(message)
    this.name = 'NormalizationError'
    this.path = path
  }
}

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g
const UNSAFE_FILENAME = /[^A-Za-z0-9._-]/g

function normalizeInstant(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return `${parsed.toISOString().slice(0, 19)}Z`
}

/** Parse with a hard byte ceiling, before any structural walk. */
export function parseBoundedJson(raw: string): unknown {
  const bytes = new TextEncoder().encode(raw).length
  if (bytes > MAX_PAYLOAD_BYTES) {
    throw new NormalizationError(`Payload is ${bytes} bytes; the limit is ${MAX_PAYLOAD_BYTES}.`, '$')
  }
  try {
    return JSON.parse(raw) as unknown
  } catch (error) {
    throw new NormalizationError(`Invalid JSON: ${(error as Error).message}`, '$')
  }
}

/**
 * Normalize Unicode to NFC and instants to UTC seconds, and enforce depth,
 * node, string and array limits. Prototype-polluting keys are refused.
 */
export function normalizeValue(value: unknown, path = '$', depth = 0, counter = { nodes: 0 }): unknown {
  counter.nodes += 1
  if (counter.nodes > MAX_NODES) throw new NormalizationError(`Document exceeds ${MAX_NODES} nodes.`, path)
  if (depth > MAX_DEPTH) throw new NormalizationError(`Nesting exceeds depth ${MAX_DEPTH}.`, path)

  if (value === null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new NormalizationError('Non-finite number.', path)
    return value
  }
  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) {
      throw new NormalizationError(`String exceeds ${MAX_STRING_LENGTH} characters.`, path)
    }
    const nfc = value.normalize('NFC')
    return INSTANT.test(nfc) ? normalizeInstant(nfc) : nfc
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      throw new NormalizationError(`Array exceeds ${MAX_ARRAY_LENGTH} entries.`, path)
    }
    return value.map((entry, index) => normalizeValue(entry, `${path}[${index}]`, depth + 1, counter))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new NormalizationError(`Refusing prototype-polluting key "${key}".`, path)
      }
      if (entry === undefined) continue
      out[key] = normalizeValue(entry, `${path}.${key}`, depth + 1, counter)
    }
    return out
  }
  throw new NormalizationError(`Unsupported value of type ${typeof value}.`, path)
}

/** Report fields the schema does not declare, at the paths that matter. */
export function unknownFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): string[] {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${path}.${key}`)
}

/** Filenames derived from operator input must not escape a directory or inject. */
export function sanitizeExportFilename(candidate: string, fallback = 'dossier'): string {
  const base = candidate
    .normalize('NFC')
    .replace(CONTROL_CHARS, '')
    .replace(UNSAFE_FILENAME, '-')
    .replace(/^[.-]+/, '')
    .replace(/-+/g, '-')
    .slice(0, 96)
  return base.length >= 3 ? base : fallback
}
