import { QUANTUM_SYSTEMS_GRAPH_RECORDS } from './quantum-systems-graph.ts'
import { SYNTHETIC_BIOLOGY_GRAPH_RECORDS } from './synthetic-biology-graph.ts'
import { epistemicRecordPath } from './epistemic-publication.ts'

const FACTORY_PILOT_RECORDS = [
  ...QUANTUM_SYSTEMS_GRAPH_RECORDS,
  ...SYNTHETIC_BIOLOGY_GRAPH_RECORDS,
] as const

export const EPISTEMIC_CANARY_RECORD_IDS = [
  'urn:maha:record:coherence-t1-t2-measurements',
  'urn:maha:record:cryogenic-superconducting-control-stack',
  'urn:maha:record:fault-tolerance-threshold-condition',
  'urn:maha:record:crispr-cas9-nuclease-editing',
  'urn:maha:record:cytosine-base-editing',
  'urn:maha:record:genome-editor-delivery-systems',
] as const

const canaryIds = new Set<string>(EPISTEMIC_CANARY_RECORD_IDS)

export const EPISTEMIC_CANARY_RECORDS = EPISTEMIC_CANARY_RECORD_IDS.map((recordId) => {
  const record = FACTORY_PILOT_RECORDS.find((candidate) => candidate.id === recordId)
  if (!record) throw new Error(`The epistemic canary record is missing from the factory corpus: ${recordId}`)
  return record
})

export const EPISTEMIC_CANARY_ROUTES = EPISTEMIC_CANARY_RECORDS.map(epistemicRecordPath)

export const EPISTEMIC_CANARY_CONTROL_RECORDS = FACTORY_PILOT_RECORDS.filter(
  (record) => !canaryIds.has(record.id),
)

export const EPISTEMIC_CANARY_CONTROL_ROUTES = EPISTEMIC_CANARY_CONTROL_RECORDS.map(epistemicRecordPath)

