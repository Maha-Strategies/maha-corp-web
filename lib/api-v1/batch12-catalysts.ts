import { id, digest, hash } from './batch5-core.ts'
import { scienceRecordSuite } from './batch11-science-core.ts'

// Only the first two recipes belong to Batch 12. Other catalyst recipes remain
// unimplemented proposals; no laboratory guidance or model inference is added.
const pins = { datasetRef: id, catalystRef: id, materialLotRef: id, methodDigest: digest, recordRevision: digest, measurementsDigest: digest, scopeRef: id }
const row = { id: 'catalyst1', datasetRef: 'dataset1', catalystRef: 'catalyst-synthetic1', materialLotRef: 'lot1', methodDigest: hash, recordRevision: hash, measurementsDigest: hash, scopeRef: 'public-metadata' }
export const CATALYST_RECORD_AUDITS = scienceRecordSuite({ category: 'catalyst-measurements', noun: 'public material-lot/method-pinned catalyst measurement metadata',
  boundary: 'Supplied metadata only; no catalyst selection, synthesis instructions, activity prediction, composition lookup, experimental protocol, material safety or performance certification. Digests are declarations, not verified source bytes.',
  pins, sample: row, owner: 'datasetRef', subject: 'catalystRef', revision: 'recordRevision', content: 'measurementsDigest', units: ['ratio', 'percent'], unitMeaning: 'caller-declared catalyst metrics' }, [])
export const BATCH12_CATALYSTS = CATALYST_RECORD_AUDITS.slice(0, 2)
