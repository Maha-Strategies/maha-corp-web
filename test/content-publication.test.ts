import assert from 'node:assert/strict'
import test from 'node:test'

import { contentPublicationHash, contentPublicationId, contentPublicationPath, parseContentPublication } from '../lib/content-publication.ts'

const input = {
  handoffId: 'contenthandoff_1234567890abcdef1234567890abcdef',
  draftId: 'contentdraft_1234567890abcdef1234567890abcdef',
  candidateId: 'contentcand_1234567890abcdef1234567890abcdef',
  slug: 'audit-ai-writing-before-publishing',
  confirmation: 'PUBLISH audit-ai-writing-before-publishing',
  idempotencyKey: 'human-release-001',
}

test('a public release requires the exact human confirmation and stays under insights', () => {
  assert.deepEqual(parseContentPublication(input), { handoffId: input.handoffId, draftId: input.draftId, candidateId: input.candidateId, slug: input.slug, note: '', idempotencyKey: input.idempotencyKey })
  assert.equal(contentPublicationPath(input.slug), '/insights/audit-ai-writing-before-publishing')
  assert.match(contentPublicationId(), /^contentpub_[a-f0-9]{32}$/)
  assert.match(contentPublicationHash(input.idempotencyKey), /^sha256:[a-f0-9]{64}$/)
})

test('a release cannot accept a non-human confirmation or unsafe slug', () => {
  assert.throws(() => parseContentPublication({ ...input, confirmation: 'publish' }))
  assert.throws(() => parseContentPublication({ ...input, slug: '../admin', confirmation: 'PUBLISH ../admin' }))
})
