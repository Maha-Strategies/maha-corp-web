import { id, digest, hash } from './batch5-core.ts'
import { CATALYST_RECORD_AUDITS } from './batch12-catalysts.ts'
import { measurementAudits, type SciencePolicy } from './batch11-science-core.ts'
import { materialBindingAudits, materialBoundary } from './batch13-material-core.ts'

const policy: SciencePolicy = { category: 'catalyst-measurements', noun: 'lot/method-pinned catalyst declarations', boundary: materialBoundary,
  pins: { datasetRef: id, catalystRef: id, materialLotRef: id, methodDigest: digest, recordRevision: digest, measurementsDigest: digest, scopeRef: id },
  sample: { id: 'catalyst1', datasetRef: 'dataset1', catalystRef: 'catalyst-synthetic1', materialLotRef: 'lot1', methodDigest: hash, recordRevision: hash, measurementsDigest: hash, scopeRef: 'public-metadata' },
  owner: 'datasetRef', subject: 'catalystRef', revision: 'recordRevision', content: 'measurementsDigest', units: ['ratio', 'percent'], unitMeaning: 'caller-declared metrics' }
const numeric = measurementAudits({ category: policy.category, noun: 'catalyst measurement exports', quantities: ['fraction', 'mass', 'amount', 'rate', 'duration'],
  units: ['ratio', 'percent', 'grams', 'milligrams', 'mol', 'mmol', 'per-second', 'per-hour', 'seconds'],
  compatible: { fraction: ['ratio', 'percent'], mass: ['grams', 'milligrams'], amount: ['mol', 'mmol'], rate: ['per-second', 'per-hour'], duration: ['seconds'] }, sampleQuantity: 'fraction', sampleUnit: 'ratio' })
// Schema closes all quantity labels; no unused external chemistry capability.
const overrides = new Map([...numeric, ...materialBindingAudits(policy, 'catalystRef')].map(s => [s.id, s]))
export const BATCH13_CATALYSTS = CATALYST_RECORD_AUDITS.slice(2).map(s => overrides.get(s.id) ?? s)
