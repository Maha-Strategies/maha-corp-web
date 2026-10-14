import { FOURTH_BATCH_AUDITS } from './batch4-audits.ts'
import { BOOK_PACK_SAMPLES } from './batch4-book-packs.ts'
import { FOURTH_BATCH_LEGACY_PORTS } from './batch4-ports.ts'
import { MICRO_SAMPLE_INPUTS } from '../x402/micro-samples.ts'
export const FOURTH_BATCH_SAMPLES: Record<string, Record<string, unknown>> = {
  ...Object.fromEntries(FOURTH_BATCH_LEGACY_PORTS.map(([id]) => [id, MICRO_SAMPLE_INPUTS[id]])),
  ...BOOK_PACK_SAMPLES, ...Object.fromEntries(FOURTH_BATCH_AUDITS.map(s => [s.id, s.sample])),
}
