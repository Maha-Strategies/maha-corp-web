import assert from 'node:assert/strict'
import test from 'node:test'

import { validateDiscoveryExtension, validateDiscoveryExtensionSpec } from '@x402/extensions/bazaar'

import { CONTEXT_COMPILER_DESCRIPTION, discoveryExtensionsFor, resourceInfoFor } from '../lib/x402/discovery.ts'

import { CONTEXT_COMPRESSION_OFFER, DEEP_CONTEXT_EVALUATION_OFFER } from '../lib/x402/offers.ts'
import { resetDiscoveryCache } from '../lib/x402/discovery.ts'
import type { PaymentRequirement } from '../lib/x402/protocol.ts'

const requirement = (amount: string): PaymentRequirement => ({
  scheme: 'exact', network: 'eip155:8453', amount, payTo: '0xSettlement',
  maxTimeoutSeconds: 60, asset: '0xUSDC', extra: { name: 'USD Coin', version: '2' },
})

const priced = (offer: { id: string; method: 'POST'; path: string; amount: string; description: string; concurrencyCap: number }) => ({
  offerId: offer.id, method: offer.method, path: offer.path,
  amount: offer.amount, description: offer.description, concurrencyCap: offer.concurrencyCap,
})

const compression = priced(CONTEXT_COMPRESSION_OFFER)
const COMPRESSION_URL = 'https://www.mahastrategies.com/api/v1/compress'
const EVALUATE_URL = 'https://www.mahastrategies.com/api/v1/compress/evaluate'

test('the Context Compiler publishes valid, callable Bazaar metadata', async () => {
  const extensions = await discoveryExtensionsFor(compression, COMPRESSION_URL, requirement('1000'))
  assert.ok(extensions?.bazaar)
  assert.deepEqual(validateDiscoveryExtensionSpec(extensions!.bazaar as never), { valid: true })
  assert.deepEqual(validateDiscoveryExtension(extensions!.bazaar as never), { valid: true })

  const bazaar = extensions!.bazaar as { info: { input: { method: string; body: { tokenBudget: number; documents: unknown[] } }; output: { example: { includedPassages: unknown[]; sources: unknown[]; warningCodes: string[] } } } }
  assert.equal(bazaar.info.input.method, 'POST')
  assert.equal(bazaar.info.input.body.tokenBudget, 128)
  // The input example is published verbatim, because a crawler replays it.
  assert.equal(bazaar.info.input.body.documents.length, 2)

  // The response example is compacted so a conforming client's echo fits the
  // 16 KB payment header. Shape is preserved -- the arrays are still arrays of
  // the right objects -- but they are truncated, and the complete example is
  // served at declarationUrl.
  assert.equal(bazaar.info.output.example.includedPassages.length, 1)
  assert.equal(bazaar.info.output.example.sources.length, 1)
  assert.ok(bazaar.info.output.example.warningCodes.includes('extractive_selection_not_verification'))
})

test('the catalog metadata identifies the service for semantic search', () => {
  const resource = resourceInfoFor(compression, COMPRESSION_URL)
  assert.equal(resource.serviceName, 'Maha Context Compiler')
  assert.equal(resource.description, CONTEXT_COMPILER_DESCRIPTION)
  assert.ok(resource.tags?.includes('context-compression'))
  assert.equal(resource.iconUrl, 'https://www.mahastrategies.com/icon.png')
})

test('an offer with no catalog entry is not advertised with an invented schema', async () => {
  assert.equal(await discoveryExtensionsFor({ ...compression, offerId: 'not-an-offer' }, COMPRESSION_URL, requirement('1000')), undefined)
})

test('the validated declaration is reused on the warm unpaid path', async () => {
  // Rebuilding and re-validating the full schema on every unpaid probe adds
  // work to the exact 402 path catalogs measure.
  assert.equal(
    await discoveryExtensionsFor(compression, COMPRESSION_URL, requirement('1000')),
    await discoveryExtensionsFor(compression, COMPRESSION_URL, requirement('1000')),
  )
})

test('an incomplete declaration is never cached in place of a complete one', async () => {
  // Without a requirement there is no accepts array, so no honest digest can
  // be taken. Caching that partial object would serve a digest-less
  // declaration to every later caller for the life of the instance -- and a
  // payer cannot bind to a declaration that carries no digest.
  resetDiscoveryCache()
  const partial = await discoveryExtensionsFor(compression, COMPRESSION_URL)
  assert.equal(partial?.['declaration-integrity'], undefined)

  const complete = await discoveryExtensionsFor(compression, COMPRESSION_URL, requirement('1000'))
  assert.ok(complete?.['declaration-integrity'], 'the cache must not have been poisoned by the partial build')
})

test('each offer gets its own declaration rather than the first one probed', async () => {
  // The single module-level cache this replaced was correct for one offer and
  // silently wrong for more: whichever offer was probed first would have
  // populated it, and every other offer's 402 would then have advertised the
  // first one's schema and example. The challenge still looks well-formed, so
  // the failure surfaces only as agents paying for one resource and calling
  // another.
  resetDiscoveryCache()
  const deep = await discoveryExtensionsFor(priced(DEEP_CONTEXT_EVALUATION_OFFER), EVALUATE_URL, requirement('10000'))
  const entry = await discoveryExtensionsFor(compression, COMPRESSION_URL, requirement('1000'))

  const deepBazaar = deep!.bazaar as { info: { input: { body: Record<string, unknown> } } }
  const entryBazaar = entry!.bazaar as { info: { input: { body: Record<string, unknown> } } }

  assert.ok(deepBazaar.info.input.body.requiredEvidence, 'the deep offer must publish its evidence contract')
  assert.equal(entryBazaar.info.input.body.requiredEvidence, undefined, 'the entry offer must not inherit it')

  const deepOffer = deep!['maha-offer'] as { offerId: string; amount: string }
  const entryOffer = entry!['maha-offer'] as { offerId: string; amount: string }
  assert.equal(deepOffer.offerId, 'deep-context-evaluation')
  assert.equal(deepOffer.amount, '10000')
  assert.equal(entryOffer.offerId, 'context-compression')
  assert.equal(entryOffer.amount, '1000')
})

test('the offer extension names the chain the requirement actually uses', async () => {
  // Preview settles on Base Sepolia and Production on Base Mainnet. An
  // extension that hard-coded mainnet would tell a Preview buyer to prepare a
  // payment on a chain the accepts array beside it does not accept, and the
  // buyer would build a correct payload for the wrong network.
  resetDiscoveryCache()
  const sepolia = { ...requirement('1000'), network: 'eip155:84532' as const }
  const extensions = await discoveryExtensionsFor(compression, COMPRESSION_URL, sepolia)
  assert.equal((extensions!['maha-offer'] as { network: string }).network, 'eip155:84532')

  resetDiscoveryCache()
  const mainnet = await discoveryExtensionsFor(compression, COMPRESSION_URL, requirement('1000'))
  assert.equal((mainnet!['maha-offer'] as { network: string }).network, 'eip155:8453')
})
