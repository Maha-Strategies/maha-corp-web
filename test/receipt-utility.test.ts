import assert from 'node:assert/strict'
import test from 'node:test'

import { MAX_BATCH_RECEIPTS, parseReceiptResponse, receiptBatchCsv, receiptCsv, validateReceiptBatch, validateReceiptText, ReceiptUtilityError, type ParsedReceipt } from '../lib/receipt-utility.ts'

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

test('validateReceiptBatch enforces array bounds and per-item validation', () => {
  assert.throws(() => validateReceiptBatch([]), /at least one receipt/)
  assert.throws(() => validateReceiptBatch('not an array'), /at least one receipt/)
  assert.throws(() => validateReceiptBatch(Array(MAX_BATCH_RECEIPTS + 1).fill('Whole Foods total 8.10')), /at most/)
  assert.throws(() => validateReceiptBatch(['Whole Foods total 8.10', 'short']), /too short/)
  const ok = validateReceiptBatch(['  Cafe latte 4.50  ', 'Store total 9.99'])
  assert.deepEqual(ok, ['Cafe latte 4.50', 'Store total 9.99'])
})

test('receiptBatchCsv groups rows by receipt with per-receipt totals', () => {
  const receipts: ParsedReceipt[] = [
    { feasible: true, confidence: 0.9, note: 'ok', merchant: 'Cafe', purchasedAt: '2026-04-12', currency: 'USD', subtotal: 4.5, tax: 0, total: 4.5,
      lineItems: [{ description: 'Latte', quantity: 1, unitPrice: 4.5, amount: 4.5, category: 'food' }] },
    { feasible: true, confidence: 0.8, note: 'ok', merchant: 'Store', purchasedAt: '2026-04-13', currency: 'USD', subtotal: 10, tax: 1, total: 11,
      lineItems: [{ description: 'Widget', quantity: 2, unitPrice: 5, amount: 10, category: 'supplies' }] },
  ]
  const lines = receiptBatchCsv(receipts).split('\r\n')
  assert.equal(lines[0], 'receipt,description,quantity,unit_price,amount,category,merchant,purchased_at,currency')
  assert.ok(lines[1].startsWith('1,Latte,1,4.5,4.5,food,Cafe,'))
  assert.ok(lines[2].startsWith('1,TOTAL,,,4.5,'))
  assert.ok(lines[3].startsWith('2,Widget,2,5,10,supplies,Store,'))
  assert.ok(lines[4].startsWith('2,TOTAL,,,11,tax:1,Store,'))
  assert.equal(receiptBatchCsv([]), 'receipt,description,quantity,unit_price,amount,category,merchant,purchased_at,currency')
})
