import assert from 'node:assert/strict'
import test from 'node:test'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { PRODUCT_SUMMARIES, productSummary } from '../lib/x402/product-summaries.ts'

test('every catalogue product has a concise, dedicated plain-language summary', () => {
  for (const offer of X402_OFFERS) {
    const summary = PRODUCT_SUMMARIES[offer.id]
    assert.ok(summary, `Missing summary for ${offer.id}`)
    assert.equal(productSummary(offer), summary)
    assert.ok(summary.length <= 190, `Summary too long for ${offer.id}`)
    assert.ok(summary.split(/\s+/u).length <= 32, `Summary too wordy for ${offer.id}`)
    assert.equal(summary.split('\n').length, 1)
    assert.ok(summary.endsWith('.'))
    assert.doesNotMatch(summary, /https?:\/\/|\b(?:guarantees?|certifies?|prevents hallucinations)\b/iu)
  }
})

test('summaries keep material safety boundaries and distinguish paid book formats', () => {
  assert.match(PRODUCT_SUMMARIES['inspection-coverage-plan'], /Simulates.*2D/)
  assert.match(PRODUCT_SUMMARIES['public-spending-review'], /not fraud/)
  assert.match(PRODUCT_SUMMARIES['campaign-record-reconcile'], /excluding individual-contributor/)
  assert.match(PRODUCT_SUMMARIES['neural-experiment-metrics'], /not raw EEG/)
  assert.match(PRODUCT_SUMMARIES['book-epub-the-maha-principle'], /EPUB and print PDF/)
  assert.match(PRODUCT_SUMMARIES['book-epub-the-orbital-mind'], /metaphor/)
})

test('an unrecognized future product retains its authored contract description', () => {
  assert.equal(productSummary({ id: 'future-product', description: 'Explicit future contract.' }), 'Explicit future contract.')
})
