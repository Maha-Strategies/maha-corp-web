/** JSON-only, bounded schema subset. No product or corpus imports. */
export type MicroSchema = {
  type?: 'object' | 'array' | 'string' | 'integer' | 'boolean' | 'null'
  properties?: Record<string, MicroSchema>; required?: string[]; additionalProperties?: false
  items?: MicroSchema; minItems?: number; maxItems?: number
  minLength?: number; maxLength?: number; pattern?: string
  minimum?: number; maximum?: number; enum?: readonly (string | boolean)[]; oneOf?: MicroSchema[]
}
export const objectSchema = (properties: Record<string, MicroSchema>): MicroSchema => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
export const arraySchema = (items: MicroSchema, minItems: number, maxItems: number): MicroSchema => ({ type: 'array', items, minItems, maxItems })
export const textSchema = (maxLength = 160): MicroSchema => ({ type: 'string', minLength: 1, maxLength, pattern: '^[^\\u0000-\\u001f\\u007f]+$' })
export const enumSchema = (...values: string[]): MicroSchema => ({ type: 'string', enum: values })
export const ID_SCHEMA: MicroSchema = { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$', maxLength: 80 }
export const HASH_SCHEMA: MicroSchema = { type: 'string', pattern: '^sha256:[a-f0-9]{64}$', maxLength: 71 }
export const INTEGER_SCHEMA: MicroSchema = { type: 'string', pattern: '^(0|-?[1-9][0-9]{0,17})$', maxLength: 19 }
export const UTC_SCHEMA: MicroSchema = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$', maxLength: 24 }
export function schemaAccepts(schema: MicroSchema, value: unknown, depth = 0): boolean {
  if (depth > 16) return false
  if (schema.oneOf) return schema.oneOf.filter(s => schemaAccepts(s, value, depth + 1)).length === 1
  if (schema.enum && !schema.enum.includes(value as string)) return false
  switch (schema.type) {
    case 'null': return value === null
    case 'boolean': return typeof value === 'boolean'
    case 'string': return typeof value === 'string' && Array.from(value).length >= (schema.minLength ?? 0) && Array.from(value).length <= (schema.maxLength ?? 100000) && (!schema.pattern || new RegExp(schema.pattern, 'u').test(value))
    case 'integer': return typeof value === 'number' && Number.isSafeInteger(value) && value >= (schema.minimum ?? Number.MIN_SAFE_INTEGER) && value <= (schema.maximum ?? Number.MAX_SAFE_INTEGER)
    case 'array': return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? 1000) && value.every(v => schemaAccepts(schema.items!, v, depth + 1))
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false
      const v = value as Record<string, unknown>, properties = schema.properties ?? {}
      return Object.keys(v).every(k => Object.hasOwn(properties, k)) && (schema.required ?? []).every(k => Object.hasOwn(v, k)) && Object.entries(v).every(([k, x]) => schemaAccepts(properties[k], x, depth + 1))
    }
    default: return false
  }
}
