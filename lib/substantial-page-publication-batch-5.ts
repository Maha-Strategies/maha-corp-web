import { createHash } from 'node:crypto'

import publicationBatchOne from '../content/substantial-pages/publication-batch-1.json' with { type: 'json' }
import publicationBatchTwo from '../content/substantial-pages/publication-batch-2.json' with { type: 'json' }
import publicationBatchThree from '../content/substantial-pages/publication-batch-3.json' with { type: 'json' }

import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from './repaired-revision-canary-targets.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'
import { substantialPageContractDigest, type CompiledSubstantialPage } from './substantial-page-compiler.ts'
import { evaluateSubstantialPageGate, type SourceBoundExplanation } from './substantial-page.ts'
import { evaluateBatch2Quality, publishBatch2Record, type PublishedBatch2Page } from './substantial-page-publication-batch-2.ts'
import type { PublishedSubstantialPage } from './substantial-page-publication.ts'
import {
  FROZEN_ACTIVE_RELEASES,
  SUBSTANTIAL_BATCH_5_SELECTED_RECORD_IDS,
  SUBSTANTIAL_PUBLICATION_QUEUE,
  type FrozenActiveRelease,
} from './substantial-publication-queue.ts'

export const SUBSTANTIAL_PUBLICATION_BATCH_5_VERSION = 'maha-substantial-publication/1.4' as const
export const SUBSTANTIAL_PUBLICATION_BATCH_5_DATE = '2026-08-30' as const

export interface PublishedBatch5Page extends Omit<PublishedBatch2Page, 'publicationVersion' | 'publicationDate' | 'publicationDigest'> {
  publicationVersion: typeof SUBSTANTIAL_PUBLICATION_BATCH_5_VERSION
  publicationDate: typeof SUBSTANTIAL_PUBLICATION_BATCH_5_DATE
  replacesPublicationVersion: string
  releaseEvidence: FrozenActiveRelease
  depthUpgrade: {
    priorInformationCharacters: number
    currentInformationCharacters: number
    characterDelta: number
    priorExplanationSections: number
    currentExplanationSections: number
    sectionDelta: number
  }
  publicationDigest: string
}

const graph: readonly EpistemicRecord[] = [...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS]
const recordById = new Map(graph.map((record) => [record.id, record]))
const batchOnePages = publicationBatchOne.pages as unknown as readonly PublishedSubstantialPage[]
const batchTwoPages = (publicationBatchTwo.pages as unknown as readonly PublishedSubstantialPage[]).filter((page) => page.quality.eligible)
const batchThreePages = (publicationBatchThree.pages as unknown as readonly PublishedSubstantialPage[]).filter((page) => page.quality.eligible)
const batchThreeRecordIds = new Set(batchThreePages.map((page) => page.contract.recordId))
const priorPageById = new Map([
  ...batchOnePages,
  ...batchTwoPages.filter((page) => !batchThreeRecordIds.has(page.contract.recordId)),
  ...batchThreePages,
].map((page) => [page.contract.recordId, page]))
const releaseById = new Map(FROZEN_ACTIVE_RELEASES.map((release) => [release.recordId, release]))

function sentence(value: string): string {
  const trimmed = value.trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function sourceIdentitySections(record: EpistemicRecord): SourceBoundExplanation[] {
  return record.sources.flatMap((source) => {
    const claimIds = record.claims.filter((claim) => claim.sourceIds.includes(source.id)).map((claim) => claim.id)
    if (!claimIds.length) return []
    const authors = source.authors.length ? source.authors.join(', ') : 'Authorship is not declared in this record'
    const identifiers = source.identifiers.length
      ? source.identifiers.map((identifier) => `${identifier.scheme}:${identifier.value}`).join(', ')
      : source.url
    const rights = source.rights?.basis ?? 'no reusable-rights basis declared'
    return [{
      heading: `Source identity, locator, and reuse boundary${record.sources.length > 1 ? ` — ${source.title}` : ''}`,
      paragraphs: [
        `The bound source is “${source.title}” by ${authors}, published by ${source.publisher} on ${source.publishedAt}; its declared stable identity is ${sentence(identifiers)}`,
        `The inspected-content locator is ${sentence(source.exactLocator)} Reuse is limited to ${sentence(rights)} ${sentence(source.rights?.note ?? source.boundary)} This metadata establishes source identity and inspection scope, not the truth of claims outside the cited locator.`,
      ],
      claimIds,
      sourceIds: [source.id],
    }]
  })
}

function publishDepthUpgrade(recordId: string): PublishedBatch5Page {
  const queue = SUBSTANTIAL_PUBLICATION_QUEUE.find((entry) => entry.recordId === recordId)
  const record = recordById.get(recordId)
  const release = releaseById.get(recordId)
  const prior = priorPageById.get(recordId)
  if (!queue?.eligibleForBatch5 || !record || !release || !prior) throw new Error(`${recordId}: Batch 5 prerequisites are incomplete.`)
  if (epistemicReviewTargetHash(record) !== release.targetSha256) throw new Error(`${recordId}: frozen release target is stale.`)

  const compiled = publishBatch2Record(record)
  const identitySections = sourceIdentitySections(record)
  const contract = {
    ...compiled.contract,
    explanations: [...compiled.contract.explanations, ...identitySections],
  }
  const decision = evaluateSubstantialPageGate(record, contract, graph, [])
  const upgraded: CompiledSubstantialPage = {
    ...compiled,
    contract,
    decision,
    contractDigest: substantialPageContractDigest(contract),
  }
  const quality = evaluateBatch2Quality(record, upgraded)
  if (!decision.pageEligible || !quality.eligible) {
    throw new Error(`${recordId}: depth upgrade failed: ${[...decision.reasons, ...quality.reasons].join(', ')}`)
  }
  const priorInformationCharacters = prior.depth.after.informationCharacters
  const identityCharacters = identitySections
    .flatMap((section) => section.paragraphs)
    .reduce((total, paragraph) => total + paragraph.trim().length, 0)
  const currentInformationCharacters = compiled.depth.after.informationCharacters + identityCharacters
  const priorExplanationSections = prior.contract.explanations.length
  const currentExplanationSections = contract.explanations.length
  if (currentInformationCharacters <= priorInformationCharacters || currentExplanationSections <= priorExplanationSections) {
    throw new Error(`${recordId}: Batch 5 did not produce a measurable depth increase.`)
  }
  const withoutDigest = {
    ...upgraded,
    publicationVersion: SUBSTANTIAL_PUBLICATION_BATCH_5_VERSION,
    publicationDate: SUBSTANTIAL_PUBLICATION_BATCH_5_DATE,
    path: release.canonicalPath,
    domainSlug: record.domainSlug,
    qualificationReason: `The frozen active release ${release.releaseId} matches exact revision ${release.targetSha256}; source alignment is clear, all four review scopes are present, and the fresh substantial quality gate passes.`,
    mathematicalBridges: compiled.mathematicalBridges,
    quality,
    depth: compiled.depth,
    replacesPublicationVersion: prior.publicationVersion,
    releaseEvidence: release,
    depthUpgrade: {
      priorInformationCharacters,
      currentInformationCharacters,
      characterDelta: currentInformationCharacters - priorInformationCharacters,
      priorExplanationSections,
      currentExplanationSections,
      sectionDelta: currentExplanationSections - priorExplanationSections,
    },
  }
  return {
    ...withoutDigest,
    publicationDigest: `sha256:${createHash('sha256').update(JSON.stringify(withoutDigest)).digest('hex')}`,
  }
}

export const SUBSTANTIAL_BATCH_5_PAGES: readonly PublishedBatch5Page[] = SUBSTANTIAL_BATCH_5_SELECTED_RECORD_IDS.map(publishDepthUpgrade)

if (SUBSTANTIAL_BATCH_5_PAGES.length !== 34
  || new Set(SUBSTANTIAL_BATCH_5_PAGES.map((page) => page.path)).size !== 34
  || SUBSTANTIAL_BATCH_5_PAGES.some((page) => !page.quality.eligible || page.depthUpgrade.characterDelta <= 0)) {
  throw new Error('Batch 5 publication or depth invariants drifted.')
}
