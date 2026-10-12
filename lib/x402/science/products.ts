import { SCIENCE_VERSION, SCIENCE_BOUNDARIES, SCIENCE_INPUT_SCHEMAS, type ScienceId } from './contracts.ts'
import { schemaAccepts } from '../micro-schema.ts'
import { quantumProduct } from './quantum.ts'
import { biologyProduct } from './biology.ts'
import { materialsProduct } from './materials.ts'

function numericWire(value: unknown): unknown {
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('nonfinite_science_result'); return Number(value.toPrecision(12)) + 0 }
  if (Array.isArray(value)) return value.map(numericWire)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, numericWire(v)]))
  return value
}

/** No remote calls, keys, inference services or payment operations. */
export async function buildScienceProduct(id: ScienceId, input: Record<string, unknown>) {
  if (!schemaAccepts(SCIENCE_INPUT_SCHEMAS[id], input)) throw new Error('unsupported_science_input')
  const findings = id.startsWith('quantum-') ? quantumProduct(id, input)
    : id.startsWith('biology-') ? biologyProduct(id, input)
    : id.startsWith('materials-') ? materialsProduct(id, input)
    : await (await import('./chemistry.ts')).chemistryProduct(id, input)
  return { methodVersion: SCIENCE_VERSION, numericPrecision: 'IEEE754-double; finite outputs rounded to 12 significant digits', findings: numericWire(findings), limitations: [...SCIENCE_BOUNDARIES] }
}
