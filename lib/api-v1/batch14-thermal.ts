import { id, digest, hash } from './batch5-core.ts'
import { scienceRecordSuite, measurementAudits, type SciencePolicy } from './batch11-science-core.ts'
import { materialBoundary } from './batch13-material-core.ts'

const units = ['kelvin', 'celsius', 'kelvin-difference', 'celsius-difference', 'watts', 'milliwatts', 'watts-per-metre-kelvin', 'seconds'] as const
const boundary = 'Supplied public or synthetic thermal export metadata only. Absolute temperature and temperature-difference labels are separate quantities, with no implicit conversion. No heater control, thermal-processing recipe, thermal-property prediction or engineering/safety certification. ' + materialBoundary
export const THERMAL_POLICY: SciencePolicy = { category: 'thermal-measurements', noun: 'thermal lot/method/revision-pinned export records', boundary,
  pins: { datasetRef: id, thermalRef: id, materialLotRef: id, methodDigest: digest, recordRevision: digest, measurementsDigest: digest, scopeRef: id },
  sample: { id: 'thermal1', datasetRef: 'dataset1', thermalRef: 'thermal-synthetic1', materialLotRef: 'lot1', methodDigest: hash, recordRevision: hash, measurementsDigest: hash, scopeRef: 'public-metadata' },
  owner: 'datasetRef', subject: 'thermalRef', revision: 'recordRevision', content: 'measurementsDigest', units, unitMeaning: 'absolute or difference thermal quantities' }
const numeric = measurementAudits({ category: THERMAL_POLICY.category, noun: 'thermal export metadata', quantities: ['absolute-temperature', 'temperature-difference', 'heat-flow', 'thermal-conductivity', 'duration'], units,
  compatible: { 'absolute-temperature': ['kelvin', 'celsius'], 'temperature-difference': ['kelvin-difference', 'celsius-difference'], 'heat-flow': ['watts', 'milliwatts'], 'thermal-conductivity': ['watts-per-metre-kelvin'], duration: ['seconds'] }, sampleQuantity: 'absolute-temperature', sampleUnit: 'kelvin' })
export const THERMAL_RECORD_AUDITS = scienceRecordSuite(THERMAL_POLICY, numeric)
export const BATCH14_THERMAL = THERMAL_RECORD_AUDITS.slice(0, 6)
