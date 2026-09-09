import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { X402_OFFERS, offerById } from '../lib/x402/offers.ts'
import { bytesDigest, checkBuyerDelivery, createBuyerCapture } from '../lib/x402/buyer-delivery-check.ts'
import { captureResponseBody } from '../lib/x402/canary-response-capture.ts'
import { buildBookEditionReceipt } from '../lib/x402/book-edition-product.ts'
import { buildBookSectionReceipt } from '../lib/x402/book-section-product.ts'

function fixture(id = 'context-compression', status = 200) {
  const offer = offerById(id)!
  let output = offer.discovery.output
  if (id.startsWith('book-edition-')) output = buildBookEditionReceipt(id.endsWith('the-imagined-life') ? 'the-imagined-life' : 'the-volcanic-engine', {})
  if (id.startsWith('book-section-')) output = buildBookSectionReceipt(id.endsWith('the-imagined-life') ? 'the-imagined-life' : 'the-volcanic-engine', offer.discovery.input)
  const requestBytes = Buffer.from(JSON.stringify(offer.discovery.input))
  const responseBytes = Buffer.from(JSON.stringify(output))
  const capture = createBuyerCapture({ provenance: 'synthetic', offerId: id, method: offer.method, resourcePath: offer.path, httpStatus: status }, requestBytes, responseBytes)
  const captureBytes = Buffer.from(JSON.stringify(capture))
  return { captureBytes, requestBytes, responseBytes, expectedCaptureSha256: bytesDigest(captureBytes) }
}

function recapture(value: ReturnType<typeof fixture>) {
  const capture = JSON.parse(value.captureBytes.toString())
  capture.requestSha256 = bytesDigest(value.requestBytes)
  capture.responseSha256 = bytesDigest(value.responseBytes)
  value.captureBytes = Buffer.from(JSON.stringify(capture))
  value.expectedCaptureSha256 = bytesDigest(value.captureBytes)
  return value
}

test('all declared products have repeatable offline payload checks, not live delivery claims', () => {
  // Fourteen existing offers plus twenty-two explicitly withheld microproducts.
  assert.equal(X402_OFFERS.length, 36)
  for (const offer of X402_OFFERS) {
    const value = fixture(offer.id)
    const first = checkBuyerDelivery(value)
    assert.equal(first.state, 'payload_verified', `${offer.id}: ${first.problems.join(', ')}`)
    assert.equal(first.provenance, 'synthetic')
    assert.equal(first.settlement, 'not_checked')
    assert.deepEqual(checkBuyerDelivery(value), first)
    assert.equal('retrievalToken' in first, false)
  }
})

test('raw byte mutation, formatting changes and swapped requests reject under a pinned capture', () => {
  for (const key of ['requestBytes', 'responseBytes'] as const) {
    const value = fixture()
    value[key] = Buffer.concat([value[key], Buffer.from('\n')])
    assert.equal(checkBuyerDelivery(value).state, 'rejected')
  }
  const value = fixture()
  value.captureBytes = Buffer.from('{}')
  assert.deepEqual(checkBuyerDelivery(value).problems, ['capture_commitment_mismatch'])
})

test('HTTP challenges, errors and malformed JSON are never delivery', () => {
  for (const status of [0, 199, 301, 402, 429, 500, 600]) assert.equal(checkBuyerDelivery(fixture(undefined, status)).state, 'rejected')
  for (const text of ['', 'null', '[]', '{']) {
    const value = fixture(); value.responseBytes = Buffer.from(text)
    assert.equal(checkBuyerDelivery(recapture(value)).state, 'rejected')
  }
  const value = fixture(); value.responseBytes = Buffer.from([0xff])
  assert.equal(checkBuyerDelivery(recapture(value)).state, 'rejected')
})

test('route identity, required fields and request identity are checked even with freshly pinned bytes', () => {
  const wrongRoute = fixture()
  const capture = JSON.parse(wrongRoute.captureBytes.toString()); capture.resourcePath += '/other'
  wrongRoute.captureBytes = Buffer.from(JSON.stringify(capture)); wrongRoute.expectedCaptureSha256 = bytesDigest(wrongRoute.captureBytes)
  assert.deepEqual(checkBuyerDelivery(wrongRoute).problems, ['offer_route_mismatch'])
  for (const mutate of [(b: Record<string, unknown>) => { b.clientRequestId = 'another-request' }, (b: Record<string, unknown>) => { delete b.context }]) {
    const value = fixture(); const body = JSON.parse(value.responseBytes.toString()); mutate(body)
    value.responseBytes = Buffer.from(JSON.stringify(body))
    assert.equal(checkBuyerDelivery(recapture(value)).state, 'rejected')
  }
})

test('pending and failed jobs cannot be mistaken for completed payloads', () => {
  for (const id of ['mps-autonomous-audit', 'research-intake-evidence-pack']) {
    for (const status of ['processing', 'failed', 'completed']) {
      const value = fixture(id)
      const body = JSON.parse(value.responseBytes.toString()); body.status = status
      delete body.audit; delete body.pack
      value.responseBytes = Buffer.from(JSON.stringify(body))
      assert.equal(checkBuyerDelivery(recapture(value)).state, status === 'processing' ? 'pending' : 'rejected')
    }
    assert.equal(checkBuyerDelivery(fixture(id, 202)).state, 'pending')
  }
  const value = fixture('research-intake-evidence-pack')
  const body = JSON.parse(value.responseBytes.toString()); body.progress.sectionsCompleted = 0
  value.responseBytes = Buffer.from(JSON.stringify(body))
  assert.equal(checkBuyerDelivery(recapture(value)).state, 'rejected')
})

test('selected book sections and compact edition advertising examples are not interchangeable', () => {
  const value = fixture('book-section-the-imagined-life')
  const body = JSON.parse(value.responseBytes.toString()); body.section.id = 'another-section'
  value.responseBytes = Buffer.from(JSON.stringify(body))
  assert.ok(checkBuyerDelivery(recapture(value)).problems.includes('section_selection_mismatch'))
  const edition = fixture('book-edition-the-imagined-life')
  edition.responseBytes = Buffer.from(JSON.stringify(offerById('book-edition-the-imagined-life')!.discovery.output))
  assert.ok(checkBuyerDelivery(recapture(edition)).problems.includes('discovery_example_not_deliverable'))
})

test('existing buyer capture helper preserves raw bytes that the offline verifier can replay', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'maha-buyer-check-'))
  try {
    const value = fixture()
    const capture = await captureResponseBody(new Response(value.responseBytes, { status: 200 }), join(dir, 'response.json'))
    assert.equal(`sha256:${capture.sha256}`, bytesDigest(value.responseBytes))
    assert.deepEqual(await readFile(capture.path), value.responseBytes)
    assert.equal(checkBuyerDelivery({ ...value, responseBytes: capture.bytes }).state, 'payload_verified')
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('saved-file CLI refuses incomplete arguments without making a request', () => {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/check-x402-buyer-delivery.ts'], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /no payment was attempted/)
})
