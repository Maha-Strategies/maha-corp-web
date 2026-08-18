// A small JSON Schema checker for the subset the offer catalog actually uses.
//
// Deliberately hand-written rather than pulled from the Bazaar library. The
// library's validator is what discovery.ts already calls, so asserting with it
// would be checking a function against itself: a bug in that validator would
// pass both the runtime check and the test. This is an independent reading of
// the same schema, which is the only way "the example validates" means
// anything.
//
// Supports: type, const, enum, required, properties, additionalProperties:false,
// items, minItems/maxItems, minLength/maxLength, minimum/maximum, pattern,
// oneOf.
// Anything else in a schema is ignored rather than silently treated as passing
// -- see `unsupportedKeywords`, which fails loudly if the catalog starts using
// a keyword this cannot check.

const SUPPORTED = new Set([
  'type', 'const', 'enum', 'required', 'properties', 'additionalProperties',
  'items', 'minItems', 'maxItems', 'minLength', 'maxLength', 'minimum',
  'maximum', 'pattern', 'description', 'default', 'title',
  'oneOf',
])

type Schema = Record<string, unknown>

function typeOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (Number.isInteger(value)) return 'integer'
  return typeof value
}

function matchesType(value: unknown, expected: string): boolean {
  const actual = typeOf(value)
  if (expected === 'number') return actual === 'number' || actual === 'integer'
  if (expected === 'object') return actual === 'object'
  return actual === expected
}

/** Returns a list of human-readable problems; empty means valid. */
export function validate(value: unknown, schema: Schema, path = '$'): string[] {
  const problems: string[] = []

  for (const keyword of Object.keys(schema)) {
    if (!SUPPORTED.has(keyword)) problems.push(`${path}: schema uses unsupported keyword "${keyword}"`)
  }

  if (Array.isArray(schema.oneOf)) {
    const matching = schema.oneOf.filter((candidate) => candidate && typeof candidate === 'object' && validate(value, candidate as Schema, path).length === 0)
    if (matching.length !== 1) problems.push(`${path}: expected exactly one oneOf branch to match, got ${matching.length}`)
  }

  if ('const' in schema && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    problems.push(`${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`)
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((allowed) => JSON.stringify(allowed) === JSON.stringify(value))) {
    problems.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`)
  }

  if (typeof schema.type === 'string' && !matchesType(value, schema.type)) {
    problems.push(`${path}: expected ${schema.type}, got ${typeOf(value)}`)
    // Further checks would only produce noise once the type is wrong.
    return problems
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      problems.push(`${path}: shorter than minLength ${schema.minLength}`)
    }
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      problems.push(`${path}: longer than maxLength ${schema.maxLength}`)
    }
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) {
      problems.push(`${path}: ${JSON.stringify(value)} does not match ${schema.pattern}`)
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) problems.push(`${path}: below minimum ${schema.minimum}`)
    if (typeof schema.maximum === 'number' && value > schema.maximum) problems.push(`${path}: above maximum ${schema.maximum}`)
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) problems.push(`${path}: fewer than minItems ${schema.minItems}`)
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) problems.push(`${path}: more than maxItems ${schema.maxItems}`)
    if (schema.items && typeof schema.items === 'object') {
      value.forEach((item, index) => problems.push(...validate(item, schema.items as Schema, `${path}[${index}]`)))
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    const properties = (schema.properties ?? {}) as Record<string, Schema>

    for (const key of (schema.required as string[] | undefined) ?? []) {
      if (!(key in record)) problems.push(`${path}: missing required property "${key}"`)
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) {
        if (!(key in properties)) problems.push(`${path}: unexpected property "${key}"`)
      }
    }

    for (const [key, subSchema] of Object.entries(properties)) {
      if (key in record) problems.push(...validate(record[key], subSchema, `${path}.${key}`))
    }

    // `additionalProperties` as a schema (rather than `false`) constrains the
    // values of keys with no declared property. Used by the MPS claim counts.
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const [key, entry] of Object.entries(record)) {
        if (!(key in properties)) {
          problems.push(...validate(entry, schema.additionalProperties as Schema, `${path}.${key}`))
        }
      }
    }
  }

  return problems
}
