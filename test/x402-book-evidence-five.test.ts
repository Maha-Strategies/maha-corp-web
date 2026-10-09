import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { buildMicroProduct, verifyMicroProduct } from '../lib/x402/micro-products.ts'
import { EVIDENCE_CHECK_IDS, EVIDENCE_CHECK_SAMPLES } from '../lib/x402/evidence-check-contracts.ts'
import { LICENSED_SECTION_BOOKS, LICENSED_SECTION_OFFERS, buildLicensedSection, licensedSectionMetadata, licensedSectionPath } from '../lib/x402/licensed-book-sections.ts'
import { licensedSectionHandlers } from '../lib/x402/licensed-book-section-route.ts'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { x402Config } from '../lib/x402/config.ts'
import { assertUniqueCohortPrices } from '../lib/x402/micro-price-policy.ts'
import { apiProxyGate } from '../lib/api-proxy-policy.ts'
import { releasesSlot } from '../lib/x402/slot.ts'
import { microHandlers } from '../lib/x402/micro-route.ts'
import { discoveryExtensionsFor } from '../lib/x402/discovery.ts'
import { validateDiscoveryExtension } from '@x402/extensions/bazaar'
import { validate } from './helpers/json-schema.ts'
import type { X402Outcome } from '../lib/x402/gateway.ts'
const sample = (id: typeof EVIDENCE_CHECK_IDS[number]) => structuredClone(EVIDENCE_CHECK_SAMPLES[id])
const h = (c: string) => 'sha256:' + c.repeat(64)
const paid: X402Outcome = { kind: 'paid', transaction: '0x' + '1'.repeat(64), payer: '0x' + '2'.repeat(40), amountPaid: '31000', header: 'synthetic-response', slot: { resource: 'synthetic', token: 'synthetic' } }
const challenge: X402Outcome = { kind: 'challenge', status: 402, header: 'synthetic-challenge', body: { x402Version: 2 } }

test('five prices are unique against current, superseded and observed ledger amounts', () => {
  const ids = [...LICENSED_SECTION_OFFERS.map(o => o.id), ...EVIDENCE_CHECK_IDS]
  assert.deepEqual(ids.map(id => X402_OFFERS.find(o => o.id === id)!.amount), ['31000', '33000', '41000', '63000', '87000'])
  const ledger = JSON.parse(readFileSync(new URL('../content/x402/settlement-ledger.json', import.meta.url), 'utf8'))
  const history = ledger.entries.map((e: { product: { id: string } | null; amountBaseUnits: string }) => ({ id: e.product?.id ?? 'unknown-history', amount: e.amountBaseUnits }))
  assert.doesNotThrow(() => assertUniqueCohortPrices(X402_OFFERS, ids, history))
})

test('five routes require separate additive deployment opt-in, not just catalogue inclusion', () => {
  const env = { X402_ENABLED: 'true', X402_FACILITATOR_URL: 'https://synthetic.example', X402_PAY_TO: '0x' + '1'.repeat(40), X402_ASSET: '0x' + '2'.repeat(40), X402_RESOURCES: JSON.stringify([{ method: 'POST', path: '/api/v1/compress' }]) }
  const before = x402Config(env)!, after = x402Config({ ...env, X402_BOOK_EVIDENCE_FIVE_ENABLED: 'true' })!
  assert.equal(before.resources.length, 1); assert.equal(after.resources.length, 6)
  assert.deepEqual(after.resources[0], before.resources[0])
  assert.deepEqual(after.catalogContradictions, [])
  for (const o of after.resources.slice(1)) {
    assert.equal(apiProxyGate(o.path, 'POST', false), 'self_managed')
    assert.equal(releasesSlot('POST', o.path), true)
  }
})

test('all three evidence examples are schema-valid, reproducible and reject private/extra inputs before settlement', async () => {
  for (const id of EVIDENCE_CHECK_IDS) {
    const offer = X402_OFFERS.find(o => o.id === id)!, input = sample(id)
    const result = await buildMicroProduct(id, input)
    assert.deepEqual(validate(result, offer.discovery.outputSchema), [])
    assert.deepEqual(validate(offer.discovery.output, offer.discovery.outputSchema), [])
    assert.equal(await verifyMicroProduct(id, input, result), true)
    for (const bad of [{ ...input, dataClass: 'private' }, { ...input, rawPrompt: 'not allowed' }, {}]) {
      await assert.rejects(buildMicroProduct(id, bad))
      let settlementCalls = 0
      const route = microHandlers(id, { environment: 'test', resolve: async () => { settlementCalls++; return paid }, record: async () => {}, release: async () => {} })
      assert.equal((await route.POST(new Request('https://www.mahastrategies.com' + offer.path, { method: 'POST', headers: { 'content-type': 'application/json', 'PAYMENT-SIGNATURE': 'synthetic' }, body: JSON.stringify(bad) }))).status, 400)
      assert.equal(settlementCalls, 0)
    }
  }
})

test('scope distinguishes omitted amendments, wrong tenants, unknown scope and contradictions', async () => {
  const input = sample('evidence-scope-check')
  const run = async () => (await buildMicroProduct('evidence-scope-check', input)).result as Record<string, unknown>
  assert.deepEqual((await run()).missingDocumentIds, ['amendment'])
  input.observedDocuments = [{ documentId: 'agreement', tenantId: 'tenant-b' }, { documentId: 'amendment', tenantId: 'tenant-a' }]
  assert.deepEqual((await run()).crossTenantDocumentIds, ['agreement'])
  input.observedDocuments = structuredClone(input.expectedDocuments); input.scopeComplete = false
  assert.equal((await run()).state, 'undetermined')
  input.expectedDocuments = [{ documentId: 'agreement', tenantId: 'tenant-b' }]
  await assert.rejects(run())
  input.expectedDocuments = [{ documentId: 'same', tenantId: 'tenant-a' }, { documentId: 'same', tenantId: 'tenant-a' }]
  await assert.rejects(run())
})

test('version checks use half-open intervals and preserve ambiguous or incomplete metadata', async () => {
  const input = sample('evidence-version-selection-check')
  const versions = input.versions as Record<string, unknown>[]
  const run = async () => (await buildMicroProduct('evidence-version-selection-check', input)).result as { state: string; checks: { issues: string[] }[] }
  assert.equal((await run()).state, 'consistent-declarations')
  versions[0].effectiveTo = input.assessedAt
  assert.ok((await run()).checks[0].issues.includes('inactive-selection'))
  versions.push({ ...versions[0], versionId: 'v2', versionHash: h('2'), effectiveFrom: input.assessedAt, effectiveTo: null })
  input.selections = [{ documentId: 'document-1', versionId: 'v2', versionHash: h('2') }]
  assert.equal((await run()).state, 'consistent-declarations')
  versions[0].effectiveTo = null
  assert.equal((await run()).state, 'undetermined')
  assert.ok((await run()).checks[0].issues.includes('ambiguous-active-versions'))
  versions.pop(); input.selections = [{ documentId: 'document-1', versionId: 'v1', versionHash: h('1') }]; input.metadataComplete = false
  assert.equal((await run()).state, 'undetermined')
  input.metadataComplete = true; (input.selections as Record<string, unknown>[])[0].versionHash = h('9')
  assert.ok((await run()).checks[0].issues.includes('version-hash-mismatch'))
  versions[0].effectiveFrom = '2026-02-30T00:00:00.000Z'
  await assert.rejects(run())
})

test('manifest detects substitutions, repeats, omissions and ordering gaps without inspecting a prompt', async () => {
  const input = sample('context-manifest-check')
  const run = async () => (await buildMicroProduct('context-manifest-check', input)).result as Record<string, unknown>
  assert.equal((await run()).state, 'consistent-declarations')
  const retained = input.retained as Record<string, unknown>[]
  retained[0].versionHash = h('9'); retained[0].ordinal = 1
  assert.deepEqual((await run()).substitutedPassageIds, ['passage-1'])
  assert.deepEqual((await run()).orderingGaps, [0])
  retained.push({ ...retained[0], ordinal: 2 })
  assert.deepEqual((await run()).repeatedPassageIds, ['passage-1'])
  input.retained = []
  assert.deepEqual((await run()).missingPassageIds, ['passage-1'])
  assert.equal((await run()).promptInspected, false)
})

for (const book of LICENSED_SECTION_BOOKS) {
  test(`${book}: every section is nonempty, pinned, schema-valid and hash-verifiable`, () => {
    const metadata = licensedSectionMetadata(book), offer = LICENSED_SECTION_OFFERS.find(o => o.path === licensedSectionPath(book))!
    assert.deepEqual(validate(offer.discovery.output, offer.discovery.outputSchema), [])
    for (const s of metadata.sections) {
      const value = buildLicensedSection(book, { sectionId: s.id, editionDigest: metadata.editionDigest })
      assert.deepEqual(validate(value, offer.discovery.outputSchema), [])
      assert.ok(value.section.utf8Bytes > 0 && Buffer.byteLength(JSON.stringify(value)) < 262144)
      assert.equal(value.section.contentSha256, 'sha256:' + createHash('sha256').update(value.section.content).digest('hex'))
    }
    assert.throws(() => buildLicensedSection(book, { sectionId: 'unknown', editionDigest: metadata.editionDigest }))
    assert.throws(() => buildLicensedSection(book, { sectionId: metadata.sections[0].id, editionDigest: h('9') }))
    assert.throws(() => buildLicensedSection(book, { sectionId: metadata.sections[0].id, editionDigest: metadata.editionDigest, extra: true }))
  })

  test(`${book}: discovery contains no prose or free-reader links; invalid signed input never reaches payment`, async () => {
    let calls = 0, builds = 0
    const route = licensedSectionHandlers(book, { resolve: async () => { calls++; return challenge }, record: async () => {}, release: async () => {}, build: (...args) => { builds++; return buildLicensedSection(...args) } })
    const path = 'https://www.mahastrategies.com' + licensedSectionPath(book)
    const response = await route.GET(new Request(path)), metadata = await response.json()
    assert.equal(response.status, 200)
    assert.doesNotMatch(JSON.stringify(metadata), /publicEditionUrl|\/books\/(?:the-maha-principle|the-orbital-mind)\/read|public web edition remains free/i)
    assert.equal(metadata.offer.discovery.output.exampleOnly, true)
    assert.equal((await route.POST(new Request(path, { method: 'POST' }))).status, 402)
    assert.equal(calls, 1); assert.equal(builds, 0)
    const input = { sectionId: 'unknown', editionDigest: metadata.catalogue.editionDigest }
    assert.equal((await route.POST(new Request(path, { method: 'POST', headers: { 'content-type': 'application/json', 'PAYMENT-SIGNATURE': 'synthetic' }, body: JSON.stringify(input) }))).status, 400)
    assert.equal(calls, 1)
  })

  test(`${book}: paid delivery and slot release survive telemetry failures`, async () => {
    const metadata = licensedSectionMetadata(book), path = 'https://www.mahastrategies.com' + licensedSectionPath(book)
    let releases = 0
    const route = licensedSectionHandlers(book, { resolve: async () => paid, record: async () => { throw new Error('synthetic') }, release: async () => { releases++; throw new Error('synthetic') } })
    const response = await route.POST(new Request(path, { method: 'POST', headers: { 'content-type': 'application/json', 'PAYMENT-SIGNATURE': 'synthetic' }, body: JSON.stringify({ sectionId: metadata.sections[0].id, editionDigest: metadata.editionDigest }) }))
    assert.equal(response.status, 200); assert.equal((await response.json()).exampleOnly, false); assert.equal(releases, 1)
  })
}

test('all five offer declarations produce valid compact Bazaar metadata', async () => {
  for (const id of [...EVIDENCE_CHECK_IDS, ...LICENSED_SECTION_OFFERS.map(o => o.id)]) {
    const offer = X402_OFFERS.find(o => o.id === id)!
    const extensions = await discoveryExtensionsFor({ offerId: offer.id, method: offer.method, path: offer.path, amount: offer.amount, description: offer.description, concurrencyCap: offer.concurrencyCap }, 'https://www.mahastrategies.com' + offer.path)
    assert.equal(validateDiscoveryExtension(extensions!.bazaar as never).valid, true, id)
    assert.ok(Buffer.byteLength(JSON.stringify(extensions)) < 16000, id)
  }
})
