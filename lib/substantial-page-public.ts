import publicationBatch from '../content/substantial-pages/publication-batch-1.json' with { type: 'json' }

import type { PublishedSubstantialPage } from './substantial-page-publication.ts'

/**
 * Route-safe projection of the generated batch. This module deliberately does
 * not import the source-alignment audit or compiler: request-time routes consume
 * the reviewed immutable output, while generation and verification stay in the
 * internal build path.
 */
export const SUBSTANTIAL_PUBLICATION_VERSION = 'maha-substantial-publication/1.0' as const
export const SUBSTANTIAL_PUBLICATION_DATE = '2026-08-26' as const
export const PUBLIC_SUBSTANTIAL_PAGES = publicationBatch.pages as unknown as readonly PublishedSubstantialPage[]

const pageByRecordId = new Map(PUBLIC_SUBSTANTIAL_PAGES.map((page) => [page.contract.recordId, page]))
export function getPublishedSubstantialPage(recordId: string): PublishedSubstantialPage | undefined {
  return pageByRecordId.get(recordId)
}
