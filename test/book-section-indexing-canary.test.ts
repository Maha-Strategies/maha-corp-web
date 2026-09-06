import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { BOOK_INDEXING_TARGETS, isTargetIndexed } from '../scripts/run-book-section-indexing-canaries.ts'
import { BASE_NETWORK, BASE_USDC, MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'

test('indexing targets are exactly the two five-mill section routes in order', () => {
  assert.deepEqual(BOOK_INDEXING_TARGETS.map(({ bookId, resource, offerId }) => ({ bookId, resource, offerId })), [
    {
      bookId: 'the-imagined-life',
      resource: 'https://www.mahastrategies.com/api/v1/books/the-imagined-life/section',
      offerId: 'book-section-the-imagined-life',
    },
    {
      bookId: 'the-volcanic-engine',
      resource: 'https://www.mahastrategies.com/api/v1/books/the-volcanic-engine/section',
      offerId: 'book-section-the-volcanic-engine',
    },
  ])
})

test('Bazaar acceptance requires the exact route, terms, and extension', () => {
  const target = BOOK_INDEXING_TARGETS[0]
  const resource = {
    resource: target.resource,
    accepts: [{ scheme: 'exact', network: BASE_NETWORK, amount: '5000', payTo: MAHA_PAYEE, asset: BASE_USDC, maxTimeoutSeconds: 60 }],
    extensions: { bazaar: { info: {} } },
  }
  assert.equal(isTargetIndexed([resource], target), true)
  assert.equal(isTargetIndexed([{ ...resource, extensions: {} }], target), false)
  assert.equal(isTargetIndexed([{ ...resource, accepts: [{ ...resource.accepts[0], amount: '2990000' }] }], target), false)
})

test('workflow keeps the key scoped to the payment step and uploads evidence on failure', async () => {
  const workflow = await readFile(new URL('../.github/workflows/production-x402-canary.yml', import.meta.url), 'utf8')
  assert.match(workflow, /environment:\s*\n\s*name: production-x402-canary/)
  assert.match(workflow, /if: \$\{\{ inputs\.book_section_indexing \}\}/)
  assert.match(workflow, /BOOK_INDEXING_CANARY_CONFIRMATION: \$\{\{ inputs\.book_section_confirmation \}\}/)
  assert.match(workflow, /X402_BUYER_PRIVATE_KEY: \$\{\{ secrets\.X402_BUYER_PRIVATE_KEY \}\}/)
  assert.match(workflow, /if: always\(\)/)
  const bookJob = workflow.split('  index-book-sections:')[1]
  assert.ok(bookJob)
  assert.doesNotMatch(bookJob.split('- name: Purchase and verify sections sequentially')[0], /X402_BUYER_PRIVATE_KEY/)
})

test('script classifies publisher-funded calls and refuses a blind second purchase', async () => {
  const script = await readFile(new URL('../scripts/run-book-section-indexing-canaries.ts', import.meta.url), 'utf8')
  assert.match(script, /publisher-funded discovery seeding; not customers, revenue traction, or organic demand/)
  assert.match(script, /if \(!step\.bazaarIndexed\) throw/)
  assert.match(script, /Refused a second signature/)
  assert.match(script, /MAX_TOTAL_AMOUNT = BigInt\(10_000\)/)
})
