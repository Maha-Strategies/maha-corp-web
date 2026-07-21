import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_BATCH_ITEMS, MAX_UPLOAD_BYTES, assertMixedBatchWithinLimit, createDraftId, createUploadObjectId,
  draftExpiresAt, imageExtensionFor, isSupportedImageType, objectPathBelongsToDraft, partitionCleanupEligible,
  uploadCleanupEligible, uploadObjectPath, validDraftId, validUploadObjectId, validateUploadDescriptor,
} from '../lib/receipt-uploads.ts'
import { ReceiptUtilityError, feasibleReceipts, type ParsedReceipt } from '../lib/receipt-utility.ts'

// ---- Format / size validation (incl. rejecting HEIC and PDF) ----
test('validateUploadDescriptor accepts JPG/PNG/WebP and rejects everything else', () => {
  assert.deepEqual(validateUploadDescriptor({ contentType: 'image/jpeg', byteSize: 50_000 }), { contentType: 'image/jpeg', byteSize: 50_000, ext: 'jpg' })
  assert.equal(validateUploadDescriptor({ contentType: 'image/png', byteSize: 50_000 }).ext, 'png')
  assert.equal(validateUploadDescriptor({ contentType: 'image/webp', byteSize: 50_000 }).ext, 'webp')

  assert.equal(isSupportedImageType('image/heic'), false)
  assert.equal(isSupportedImageType('application/pdf'), false)
})

test('validateUploadDescriptor enforces type and size with correct HTTP statuses', () => {
  const status = (input: { contentType: unknown; byteSize: unknown }) => {
    try { validateUploadDescriptor(input); return 200 }
    catch (error) { return error instanceof ReceiptUtilityError ? error.status : -1 }
  }
  assert.equal(status({ contentType: 'image/heic', byteSize: 1000 }), 415) // HEIC rejected
  assert.equal(status({ contentType: 'application/pdf', byteSize: 1000 }), 415) // PDF rejected
  assert.equal(status({ contentType: 'image/jpeg', byteSize: MAX_UPLOAD_BYTES + 1 }), 413) // too big
  assert.equal(status({ contentType: 'image/jpeg', byteSize: 10 }), 400) // too small
  assert.equal(status({ contentType: 'image/jpeg', byteSize: 1.5 }), 400) // non-integer
  assert.equal(imageExtensionFor('image/webp'), 'webp')
})

// ---- Opaque ids + path binding (authorization) ----
test('draft/object ids round-trip their validators', () => {
  const draftId = createDraftId()
  const objectId = createUploadObjectId()
  assert.match(draftId, /^updraft_[a-f0-9]{32}$/)
  assert.match(objectId, /^upobj_[a-f0-9]{32}$/)
  assert.equal(validDraftId(draftId), true)
  assert.equal(validUploadObjectId(objectId), true)
  assert.equal(validDraftId('updraft_short'), false)
  assert.equal(validDraftId('upobj_' + '0'.repeat(32)), false)
})

test('object paths are bound to their draft; foreign or malformed paths are rejected', () => {
  const draftId = createDraftId()
  const other = createDraftId()
  const path = uploadObjectPath(draftId, createUploadObjectId(), 'jpg')
  assert.equal(path.startsWith(`${draftId}/`), true)
  assert.equal(objectPathBelongsToDraft(path, draftId), true) // its own draft
  assert.equal(objectPathBelongsToDraft(path, other), false) // a different draft cannot claim it
  assert.equal(objectPathBelongsToDraft('nested/evil/path.jpg', draftId), false)
  assert.equal(objectPathBelongsToDraft('no-slash', draftId), false)
  assert.equal(objectPathBelongsToDraft(path, 'not-a-draft-id'), false)
})

// ---- Cleanup eligibility ----
test('uploadCleanupEligible: delivered/refunded/expired eligible; open+unexpired or cleaned not', () => {
  const now = '2026-07-21T12:00:00.000Z'
  const future = '2026-07-21T18:00:00.000Z'
  const past = '2026-07-21T06:00:00.000Z'
  assert.equal(uploadCleanupEligible({ status: 'delivered', expiresAt: future }, now), true)
  assert.equal(uploadCleanupEligible({ status: 'refunded', expiresAt: future }, now), true)
  assert.equal(uploadCleanupEligible({ status: 'open', expiresAt: past }, now), true) // expired
  assert.equal(uploadCleanupEligible({ status: 'open', expiresAt: future }, now), false) // still active
  assert.equal(uploadCleanupEligible({ status: 'refunded', expiresAt: past, cleanedAt: now }, now), false) // already cleaned

  const eligible = partitionCleanupEligible([
    { publicId: createDraftId(), status: 'open', expiresAt: future },
    { publicId: createDraftId(), status: 'delivered', expiresAt: future },
    { publicId: createDraftId(), status: 'open', expiresAt: past },
  ], now)
  assert.equal(eligible.length, 2)
})

test('draftExpiresAt is 24 hours after creation', () => {
  assert.equal(draftExpiresAt('2026-07-21T00:00:00.000Z'), '2026-07-22T00:00:00.000Z')
})

// ---- Mixed text/image batch limit ----
test('assertMixedBatchWithinLimit enforces 1..20 combined', () => {
  assert.equal(assertMixedBatchWithinLimit({ imageCount: 10, textCount: 10 }), 20)
  assert.equal(assertMixedBatchWithinLimit({ imageCount: MAX_BATCH_ITEMS, textCount: 0 }), 20)
  assert.equal(assertMixedBatchWithinLimit({ imageCount: 0, textCount: 3 }), 3)
  assert.throws(() => assertMixedBatchWithinLimit({ imageCount: 0, textCount: 0 }), /at least one/)
  assert.throws(() => assertMixedBatchWithinLimit({ imageCount: 11, textCount: 10 }), /at most 20/)
})

// ---- Refund decision (deliverable subset) ----
test('feasibleReceipts drives refund: none feasible → nothing deliverable → refund', () => {
  const feasible: ParsedReceipt = { feasible: true, confidence: 0.9, note: 'ok', merchant: 'A', purchasedAt: null, currency: 'USD', subtotal: null, tax: null, total: 5, lineItems: [{ description: 'x', quantity: 1, unitPrice: 5, amount: 5, category: 'food' }] }
  const infeasible: ParsedReceipt = { feasible: false, confidence: 0.1, note: 'no', merchant: null, purchasedAt: null, currency: null, subtotal: null, tax: null, total: null, lineItems: [] }

  assert.equal(feasibleReceipts([infeasible, null, infeasible]).length, 0) // → auto-refund
  assert.equal(feasibleReceipts([infeasible, feasible, null]).length, 1) // → charge, deliver the one
  assert.equal(feasibleReceipts([]).length, 0) // empty batch → refund
})
