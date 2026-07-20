import assert from 'node:assert/strict'
import test from 'node:test'

import { parseReceiptResponse, receiptCsv, validateReceiptText, ReceiptUtilityError } from '../lib/receipt-utility.ts'

test('validateReceiptText enforces bounds', () => {
  assert.throws(() => validateReceiptText(123), /Paste the text/)
  assert.throws(() => validateReceiptText('short'), /too short/)
  assert.throws(() => validateReceiptText('x'.repeat(9000)), ReceiptUtilityError)
  assert.equal(validateReceiptText('  Whole Foods total 8.10  '), 'Whole Foods total 8.10')
})

test('parseReceiptResponse handles clean JSON, clamps, and rounds', () => {
  const parsed = parseReceiptResponse(JSON.stringify({
    feasible: true, confidence: 1.7, note: 'ok', merchant: 'Cafe', purchasedAt: '2026-04-12', currency: 'USD',
    subtotal: 7.482, tax: 0.62, total: 8.101,
    lineItems: [{ description: 'Latte', quantity: 1, unitPrice: 4.5, amount: 4.5, category: 'food' }],
  }))
  assert.equal(parsed.feasible, true)
  assert.equal(parsed.confidence, 1) // clamped to [0,1]
  assert.equal(parsed.subtotal, 7.48) // rounded to cents
  assert.equal(parsed.total, 8.1)
  assert.equal(parsed.lineItems.length, 1)
})

test('parseReceiptResponse strips a code fence', () => {
  const parsed = parseReceiptResponse('```json\n{"feasible":true,"confidence":0.9,"lineItems":[{"description":"x","amount":1}]}\n```')
  assert.equal(parsed.feasible, true)
  assert.equal(parsed.lineItems[0].category, 'uncategorized') // defaulted
})

test('parseReceiptResponse treats no-line-items as not feasible, and rejects garbage', () => {
  const empty = parseReceiptResponse(JSON.stringify({ feasible: true, confidence: 0.9, lineItems: [] }))
  assert.equal(empty.feasible, false) // feasible requires ≥1 line item
  assert.throws(() => parseReceiptResponse('not json at all'), ReceiptUtilityError)
})

test('receiptCsv escapes commas, quotes, and newlines; emits header + totals row', () => {
  const csv = receiptCsv({
    feasible: true, confidence: 0.9, note: 'ok', merchant: 'A, B "Co"', purchasedAt: '2026-04-12', currency: 'USD',
    subtotal: 10, tax: 1, total: 11,
    lineItems: [
      { description: 'Item, with comma', quantity: 2, unitPrice: 2.5, amount: 5, category: 'food' },
      { description: 'Quote "x"\nline2', quantity: null, unitPrice: null, amount: 6, category: 'misc' },
    ],
  })
  const lines = csv.split('\r\n')
  assert.equal(lines[0], 'description,quantity,unit_price,amount,category,merchant,purchased_at,currency')
  assert.ok(lines[1].startsWith('"Item, with comma",2,2.5,5,food,"A, B ""Co"""'))
  assert.match(lines[2], /"Quote ""x""\nline2"/)
  assert.ok(lines[lines.length - 1].startsWith('TOTAL,,,11,'))
})
