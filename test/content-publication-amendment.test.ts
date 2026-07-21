import assert from 'node:assert/strict'
import test from 'node:test'

import { parseContentSourceAmendment } from '../lib/content-publication-amendment.ts'

const evidence = [
  { url: 'https://www.nist.gov/source', title: 'NIST source for AI claim review', sourceType: 'official', publishedOn: '2025-01-10', note: 'Defines the relevant evidence and provenance review boundary for AI-assisted material.' },
  { url: 'https://www.nature.com/source', title: 'Research on citation reliability', sourceType: 'primary', publishedOn: '2025-04-12', note: 'Provides research context for citation reliability and the limits of generated references.' },
  { url: 'https://data.example.org/source', title: 'Public editorial review data', sourceType: 'public_data', publishedOn: '2025-08-03', note: 'Documents a public evidence record relevant to editorial traceability and review practice.' },
]

test('source amendment requires an exact human confirmation and specific source metadata', () => {
  const parsed = parseContentSourceAmendment({ publicationId: 'contentpub_1234567890abcdef1234567890abcdef', slug: 'claim-verification-for-ai-content', confirmation: 'AMEND claim-verification-for-ai-content', evidence, note: 'Corrected source titles and source-specific notes.', idempotencyKey: 'source-amendment-001' })
  assert.equal(parsed.evidence.length, 3)
})

test('source amendment rejects placeholder source metadata', () => {
  assert.throws(() => parseContentSourceAmendment({ publicationId: 'contentpub_1234567890abcdef1234567890abcdef', slug: 'claim-verification-for-ai-content', confirmation: 'AMEND claim-verification-for-ai-content', evidence: [{ ...evidence[0], title: 'Source one' }, evidence[1], evidence[2]], note: 'Corrected source titles and source-specific notes.', idempotencyKey: 'source-amendment-002' }))
})
