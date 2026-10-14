import { SCIENCE_IDS } from '../x402/science/contracts.ts'
import type { MicroProductId } from '../x402/micro-contracts.ts'
import type { Domain } from './types.ts'

// The first batch already ports these three algorithms; never recount them.
const completed = new Set(['biology-dna-rna-composition', 'chemistry-dilution-calculator', 'materials-thermal-stack-resistance'])
export const SECOND_BATCH_PORTS: readonly (readonly [MicroProductId, Domain, string, string])[] = [
  ...SCIENCE_IDS.filter(id => !completed.has(id)).map(id => {
    const category = id.slice(0, id.indexOf('-')), action = id.slice(id.indexOf('-') + 1)
    return [id, 'compute', category, action] as const
  }),
  ['weighted-calibration-fit', 'compute', 'calibration', 'weighted-fit'],
  ['sampling-aliasing-check', 'compute', 'signals', 'aliasing-check'],
  ['assembly-critical-path', 'compute', 'manufacturing', 'critical-path'],
]
if (SECOND_BATCH_PORTS.length !== 50 || new Set(SECOND_BATCH_PORTS.map(p => p[0])).size !== 50) throw Error('invalid_second_batch_ports')
export const SECOND_BATCH_IDS = SECOND_BATCH_PORTS.map(p => p[0])
