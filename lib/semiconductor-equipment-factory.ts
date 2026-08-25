import { ADAPTED_EPISTEMIC_CANDIDATES, type LegacyAdapterCandidate } from './epistemic-adapters.ts'
import { SEMICONDUCTOR_EQUIPMENT_ARTICLES } from './semiconductor-equipment.ts'

export const SEMICONDUCTOR_EQUIPMENT_FACTORY_BATCH_VERSION = 'maha-semiconductor-equipment-batch/1.0' as const

const equipmentSourceIds = new Set(SEMICONDUCTOR_EQUIPMENT_ARTICLES.map((article) => article.id))

/**
 * The governed equipment cohort is derived from the same 25 records that feed
 * the public /knowledge/equipment surface. This prevents a second hand-written
 * inventory from drifting away from the pages visitors can inspect.
 */
export const SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES: readonly LegacyAdapterCandidate[] =
  ADAPTED_EPISTEMIC_CANDIDATES
    .filter((candidate) => candidate.adapterId === 'semiconductor' && equipmentSourceIds.has(candidate.sourceRecordId))
    .sort((left, right) => left.record.title.localeCompare(right.record.title))

if (SEMICONDUCTOR_EQUIPMENT_ARTICLES.length !== 25 || SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES.length !== 25) {
  throw new Error('The semiconductor equipment factory cohort must contain exactly 25 public source records and 25 adapted candidates.')
}

const adaptedSourceIds = new Set(SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES.map((candidate) => candidate.sourceRecordId))
for (const sourceId of equipmentSourceIds) {
  if (!adaptedSourceIds.has(sourceId)) throw new Error(`The equipment factory cohort is missing ${sourceId}.`)
}

export const SEMICONDUCTOR_EQUIPMENT_FACTORY_BOUNDARY =
  'The batch migrates public equipment-class explainers into immutable noncanonical review targets. Manufacturer sources establish product categories and intended uses; they do not independently prove performance, supplier ranking, process qualification, yield, availability, or ownership economics.'

