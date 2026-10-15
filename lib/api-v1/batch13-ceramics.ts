import { id, digest, hash } from './batch5-core.ts'
import { scienceRecordSuite, measurementAudits, type SciencePolicy } from './batch11-science-core.ts'
import { materialBoundary } from './batch13-material-core.ts'

const units = ['ratio', 'percent', 'kg-per-m3', 'g-per-cm3', 'celsius', 'kelvin', 'pascal', 'megapascal', 'seconds'] as const
export const CERAMIC_POLICY: SciencePolicy = { category: 'ceramic-measurements', noun: 'ceramic lot/method-pinned measurement records', boundary: materialBoundary,
  pins: { datasetRef: id, ceramicRef: id, materialLotRef: id, methodDigest: digest, recordRevision: digest, measurementsDigest: digest, scopeRef: id },
  sample: { id: 'ceramic1', datasetRef: 'dataset1', ceramicRef: 'ceramic-synthetic1', materialLotRef: 'lot1', methodDigest: hash, recordRevision: hash, measurementsDigest: hash, scopeRef: 'public-metadata' },
  owner: 'datasetRef', subject: 'ceramicRef', revision: 'recordRevision', content: 'measurementsDigest', units, unitMeaning: 'ceramic measurement quantities' }
const numeric = measurementAudits({ category: CERAMIC_POLICY.category, noun: 'ceramic measurement metadata', quantities: ['porosity-fraction', 'density', 'temperature', 'stress', 'duration'], units,
  compatible: { 'porosity-fraction': ['ratio', 'percent'], density: ['kg-per-m3', 'g-per-cm3'], temperature: ['celsius', 'kelvin'], stress: ['pascal', 'megapascal'], duration: ['seconds'] }, sampleQuantity: 'density', sampleUnit: 'kg-per-m3' })
// Only four new ceramic recipes are built in this cohort.
export const CERAMIC_RECORD_AUDITS = scienceRecordSuite(CERAMIC_POLICY, numeric)
export const BATCH13_CERAMICS = CERAMIC_RECORD_AUDITS.slice(0, 4)
