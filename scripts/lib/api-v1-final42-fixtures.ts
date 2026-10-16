// Public synthetic examples only. Never import local editorial drafts here.
import { compileRelease, retrievalInput } from '../../lib/agent-publishing/contracts.ts'
import { PUBLICATION_PRODUCTS, type PublicationProductId } from '../../lib/api-v1/publishing/products.ts'
import { BOOK_PACK_IDS, BOOK_PACK_SAMPLES } from '../../lib/api-v1/batch4-book-packs.ts'
import { bookMetadata } from '../../lib/api-v1/book-catalogue.ts'
import { batch20PortSpec, batch20Port } from '../../lib/api-v1/batch20-ports.ts'
import { isLegacyPort } from '../../lib/api-v1/legacy-adapters.ts'
import { MICRO_SAMPLE_INPUTS } from '../../lib/x402/micro-samples.ts'
import { fixtureDependencies } from '../../lib/x402/demand6/fixtures.ts'
import { buildWorkflowProduct } from '../../lib/x402/workflow/products.ts'
import { handlerFor } from '../../lib/api-v1/handlers.ts'
import { RESEARCH_INPUTS, type ResearchId } from '../../lib/x402/workflow/research-contracts.ts'
import type { Endpoint } from '../../lib/api-v1/types.ts'

export const SYNTHETIC_PUBLICATION = {
  publicationId: 'synthetic-review', releaseId: '1.0.0', collectionId: 'agent-infrastructure-evidence',
  title: 'Synthetic example', summary: 'Synthetic fixture, not research.',
  releasedOn: '2026-10-15', author: 'Codex — AI drafting and source review',
  editorial: { humanApproval: 'pending', scope: 'local-development-only', sourceReview: 'Synthetic fixture only.' },
  sources: [{ id: 'source1', title: 'Example', url: 'https://example.org', locator: '1', inspectedOn: '2026-10-15' }],
  findings: [{ id: 'finding1', statement: 'Synthetic finding, not evidence.', sourceIds: ['source1'] }],
  markdown: 'SYNTHETIC fixture; no facts have been established. '.repeat(11),
  limitations: ['Synthetic fixture, no evidence.'],
}
export const publicationSamples = () => {
  const artifact = compileRelease(SYNTHETIC_PUBLICATION), pin = retrievalInput(artifact)
  return {
    'publication-pinned-brief': { dataClass: 'synthetic', pin, artifact },
    'publication-release-comparison': { dataClass: 'synthetic', before: artifact,
      after: compileRelease({ ...SYNTHETIC_PUBLICATION, releaseId: '1.0.1', title: 'Revised synthetic example' }) },
    'publication-citation-coverage': { dataClass: 'synthetic', claims: [{ id: 'claim1', text: 'Synthetic claim', sourceIds: ['source1'] }], sources: [{ id: 'source1', url: 'https://example.org/source', locator: 'Paragraph 1' }] },
    'publication-correction-impact': { dataClass: 'synthetic', references: [{ referenceId: 'reference1', ...pin }], events: [{ sequence: 1, ...pin, kind: 'released' }] },
    'publication-package-preflight': SYNTHETIC_PUBLICATION,
  }
}
const RESEARCH_DOI = '10.1038/nphys1170'
export function final42Input(e: Endpoint): unknown {
  if (bookMetadata(e.id)) {
    const m = bookMetadata(e.id)!
    return { editionDigest: m.editionDigest, sectionId: m.sections.find(s => s.utf8Bytes > 500 && s.utf8Bytes < 8000)!.id }
  }
  if (BOOK_PACK_IDS.some(id => id === e.id)) return BOOK_PACK_SAMPLES[e.id as typeof BOOK_PACK_IDS[number]]
  if (PUBLICATION_PRODUCTS.some(p => p.id === e.id)) return publicationSamples()[e.id as PublicationProductId]
  const port = batch20PortSpec(e.id)
  if (port) return port.sample
  if (isLegacyPort(e.id)) return MICRO_SAMPLE_INPUTS[e.id]
  if (e.id in RESEARCH_INPUTS) return e.id === 'research-trial-status-snapshot' ? { dataClass: 'public', nctId: 'NCT00000102' }
    : e.id === 'research-bibliography-resolution' ? { dataClass: 'public', dois: [RESEARCH_DOI] } : { dataClass: 'public', doi: RESEARCH_DOI }
  throw Error('final42_fixture_missing:' + e.id)
}
export function final42OfflineHandler(e: Endpoint) {
  if (batch20PortSpec(e.id)) return batch20Port(e.id, e.amount, { demand: fixtureDependencies })!
  const h = handlerFor(e.id, e.amount)!
  if (e.id in RESEARCH_INPUTS) return { ...h, execute: async (input: unknown) => buildWorkflowProduct(e.id as ResearchId, input, {
    now: () => Date.parse('2026-10-15T00:00:00Z'), read: async url => ({ status: 200, durationMs: 1,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(url.includes('clinicaltrials.gov')
        ? { protocolSection: { identificationModule: { nctId: 'NCT00000102' }, statusModule: { overallStatus: 'COMPLETED', lastUpdatePostDateStruct: { date: '2026-10-14' } } } }
        : url.includes('?') ? { status: 'ok', message: { 'total-results': 0, items: [] } }
          : { status: 'ok', 'message-type': 'work', message: { DOI: RESEARCH_DOI, title: ['Synthetic metadata example'], type: 'journal-article', publisher: 'Synthetic publisher' } }) }) }) }
  return h
}
