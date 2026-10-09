import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { EBOOK_AMOUNT, EBOOK_IDS, EBOOKS, EBOOK_VERSION, ebookArtifacts, ebookBundleHash, ebookFormatLabel, ebookHash, ebookOfferId, ebookTermsHash, parseEbookOrder } from '../lib/x402/ebook-contract.ts'
import { EBOOK_OFFERS } from '../lib/x402/ebook-offers.ts'
import { ebookDelivery, loadEbook, validateEbookPayload } from '../lib/x402/ebook-delivery.ts'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { buildLedger } from '../lib/x402/settlement-ledger.ts'
import { bytesDigest, checkBuyerDelivery, createBuyerCapture } from '../lib/x402/buyer-delivery-check.ts'

const order = (id: typeof EBOOK_IDS[number]) => parseEbookOrder(id, {
  clientRequestId: 'private-bundle-test', version: EBOOK_VERSION,
  artifactHash: ebookBundleHash(id), termsHash: ebookTermsHash(id),
  recoverySecret: '0123456789abcdef'.repeat(4),
})

test('both books retain the approved ten-USDC bundle price', () => {
  assert.equal(EBOOK_AMOUNT, '10000000')
  assert.equal(EBOOK_OFFERS.length, 2)
  for (const offer of EBOOK_OFFERS) assert.equal(offer.amount, EBOOK_AMOUNT)
})

test('both bundles now declare EPUB plus PDF, with distinct commitments', () => {
  for (const id of EBOOK_IDS) {
    assert.equal(ebookFormatLabel(id), 'EPUB + print PDF')
    const artifacts = ebookArtifacts(id)
    assert.deepEqual(artifacts.map(file => file.mediaType), ['application/epub+zip', 'application/pdf'])
    assert.equal(new Set(artifacts.map(file => file.sha256)).size, 2)
    assert.notEqual(ebookBundleHash(id), artifacts[0].sha256)
  }
  assert.match(EBOOKS['the-orbital-mind'].pdf.editionNote, /aligned to the author-selected EPUB/)
  assert.match(EBOOKS['the-orbital-mind'].pdf.editionNote, /appendices A-F, including A Guide to the Sources/)
  assert.match(EBOOKS['the-maha-principle'].pdf.editionNote, /appendices A-J, and Notes and References/)
})

test('the artwork release changes only The Maha Principle PDF from the 1.1.0 bundles', () => {
  const changed: string[] = []
  for(const id of EBOOK_IDS) {
    const before=ebookArtifacts(id,'1.1.0'), current=ebookArtifacts(id)
    assert.equal(current.length,before.length)
    for(let i=0;i<current.length;i++) {
      assert.equal(current[i].filename,before[i].filename)
      assert.equal(current[i].mediaType,before[i].mediaType)
      if(JSON.stringify(current[i])!==JSON.stringify(before[i])) changed.push(id+':'+current[i].filename)
    }
  }
  assert.deepEqual(changed,['the-maha-principle:The-Maha-Principle-print.pdf'])
  const pdf=EBOOKS['the-maha-principle'].pdf
  assert.equal(pdf.bytes,1355839)
  assert.equal(pdf.sha256,'sha256:703e19222acd9e160efecf73b860184c7283ea8a952830269b08d43409c2645d')
  assert.equal(ebookBundleHash('the-orbital-mind'),ebookBundleHash('the-orbital-mind','1.1.0'))
  assert.notEqual(ebookBundleHash('the-maha-principle'),ebookBundleHash('the-maha-principle','1.1.0'))
})

test('discovery describes the same two-file bundle, not a free web edition', () => {
  for (const id of EBOOK_IDS) {
    const offer = EBOOK_OFFERS.find(offer => offer.id === ebookOfferId(id))!
    assert.match(offer.description, /EPUB \+ print PDF/)
    assert.doesNotMatch(JSON.stringify(offer), /\/books\/the-orbital-mind(?!\/epub)|\/books\/the-maha-principle(?!\/epub)/)
    assert.deepEqual(offer.discovery.output.artifacts, ebookArtifacts(id).map(file => ({ ...file, base64: '' })))
  }
})

test('the updated Orbital edition invalidates older file-only order commitments', () => {
  const id = 'the-orbital-mind'
  assert.throws(() => parseEbookOrder(id, { ...order(id), artifactHash: 'sha256:1db3f70b7ca7f251f20485269d921ac4538116d6bcd47a6870b432a1ef98d8d0' }), /edition_or_terms_changed/)
  assert.throws(() => parseEbookOrder('the-maha-principle', order(id)), /edition_or_terms_changed/)
})

test('a ten-USDC transfer never guesses which ebook title sold', () => {
  assert.equal(X402_OFFERS.filter(offer => offer.amount === EBOOK_AMOUNT && offer.availability.payableInProduction).length, 2)
  const ledger = buildLedger({
    settlements: [{ payer: '0x' + '2'.repeat(40), amountBaseUnits: BigInt(EBOOK_AMOUNT), blockNumber: BigInt(1), transactionHash: '0x' + '3'.repeat(64) }],
    operatorWallets: [], offers: EBOOK_OFFERS.map(offer => ({ id: offer.id, title: offer.serviceName, amountBaseUnits: BigInt(offer.amount) })),
    observedAt: '2026-10-09T00:00:00.000Z', fromBlock: BigInt(1), toBlock: BigInt(1),
  })
  assert.equal(ledger.entries[0].product, null)
  assert.equal(ledger.summary.externalSettlements, 1)
  assert.ok(ledger.summary.byProduct.every(offer => offer.attributionAmbiguous))
})

const assetsPresent = EBOOK_IDS.every(id => ebookArtifacts(id).every(file => existsSync('content/paid-ebooks/' + file.filename)))
test('private files match every pinned byte count and digest', { skip: !assetsPresent && 'Private manuscripts are intentionally not checked into Git.' }, async () => {
  for (const id of EBOOK_IDS) {
    const files = await loadEbook(id)
    assert.equal(files.length, 2)
    assert.throws(() => validateEbookPayload(id, files.slice(0, 1)), /ebook_integrity_failure/)
    const corrupted = files.map(file => Buffer.from(file)); corrupted[1][20] ^= 1
    assert.throws(() => validateEbookPayload(id, corrupted), /ebook_integrity_failure/)
  }
})

test('full delivery decodes losslessly and remains below the response-size ceiling', { skip: !assetsPresent && 'Requires private manuscript files.' }, async () => {
  for (const id of EBOOK_IDS) {
    const delivered = ebookDelivery(id, order(id), await loadEbook(id), '0x' + '1'.repeat(64), false)
    assert.equal(delivered.artifacts.length, 2)
    for (const file of delivered.artifacts) {
      const bytes = Buffer.from(file.base64, 'base64')
      assert.equal(bytes.length, file.bytes)
      assert.equal(ebookHash(bytes), file.sha256)
    }
    assert.ok(Buffer.byteLength(JSON.stringify(delivered)) < 4_500_000, 'Inline bundle must fit the deployment response-size ceiling.')
    const offer = EBOOK_OFFERS.find(offer => offer.id === ebookOfferId(id))!
    const requestBytes = Buffer.from(JSON.stringify(order(id)))
    const responseBytes = Buffer.from(JSON.stringify(delivered))
    const captureBytes = Buffer.from(JSON.stringify(createBuyerCapture({ provenance: 'synthetic', offerId: offer.id,
      method: offer.method, resourcePath: offer.path, httpStatus: 200 }, requestBytes, responseBytes)))
    const checked = checkBuyerDelivery({ requestBytes, responseBytes, captureBytes, expectedCaptureSha256: bytesDigest(captureBytes) })
    assert.equal(checked.state, 'payload_verified', checked.problems.join(', '))
  }
})
