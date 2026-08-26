import publicationBatch from '../content/substantial-pages/publication-batch-1.json' with { type: 'json' }
import publicationBatchTwo from '../content/substantial-pages/publication-batch-2.json' with { type: 'json' }

import type { PublishedSubstantialPage } from './substantial-page-publication.ts'

/**
 * Route-safe projection of the generated batch. This module deliberately does
 * not import the source-alignment audit or compiler: request-time routes consume
 * the reviewed immutable output, while generation and verification stay in the
 * internal build path.
 */
export const SUBSTANTIAL_PUBLICATION_VERSION = 'maha-substantial-publication/1.0' as const
export const SUBSTANTIAL_PUBLICATION_DATE = '2026-08-26' as const

const batchOnePages = publicationBatch.pages as unknown as readonly PublishedSubstantialPage[]

/**
 * Batch two publishes only pages the generator recorded as currently eligible.
 * A blocked page keeps its existing governed canonical route and simply carries
 * no substantial reference material, so ineligibility removes the enrichment
 * rather than the page.
 */
const batchTwoPages = (publicationBatchTwo.pages as unknown as readonly PublishedSubstantialPage[]).filter(
  (page) => page.quality.eligible,
)

export const PUBLIC_SUBSTANTIAL_PAGES: readonly PublishedSubstantialPage[] = [...batchOnePages, ...batchTwoPages]

const pageByRecordId = new Map(PUBLIC_SUBSTANTIAL_PAGES.map((page) => [page.contract.recordId, page]))

if (pageByRecordId.size !== PUBLIC_SUBSTANTIAL_PAGES.length) {
  throw new Error('A record is published by more than one substantial batch.')
}
const publishedPaths = new Set(PUBLIC_SUBSTANTIAL_PAGES.map((page) => page.path))
if (publishedPaths.size !== PUBLIC_SUBSTANTIAL_PAGES.length) {
  throw new Error('Two substantial pages claim the same public route.')
}

export function getPublishedSubstantialPage(recordId: string): PublishedSubstantialPage | undefined {
  return pageByRecordId.get(recordId)
}
