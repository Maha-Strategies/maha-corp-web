// Pure helpers for receipt-IMAGE ingestion: format/size validation, opaque id +
// object-path generation and binding, draft expiry, cleanup eligibility, and the
// mixed text/image batch limit. No I/O, no SDK — every function here is a pure
// function of its inputs so validation, binding, cleanup, and batch rules can be
// unit-tested exactly. Storage/DB effects live in receipt-upload-store.ts.

import { randomUUID } from 'node:crypto'

import { MAX_BATCH_RECEIPTS, ReceiptUtilityError } from './receipt-utility.ts'

export const RECEIPT_UPLOAD_BUCKET = 'receipt-uploads'

// JPG/PNG/WebP only for this first unit. HEIC and PDF are intentionally rejected.
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number]

export const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024 // 10 MB, original file (client-side gate)
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // 8 MB, post-compression object (server + bucket cap)
export const MIN_UPLOAD_BYTES = 64
export const UPLOAD_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours
// Combined text + image inputs per paid run share the existing batch cap.
export const MAX_BATCH_ITEMS = MAX_BATCH_RECEIPTS

export type DraftStatus = 'open' | 'delivered' | 'refunded'

export function isSupportedImageType(value: unknown): value is SupportedImageType {
  return typeof value === 'string' && (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(value)
}

export function imageExtensionFor(type: SupportedImageType): 'jpg' | 'png' | 'webp' {
  return type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp'
}

// Validate a claimed upload descriptor (content type + byte size of the object
// the client is about to PUT). Throws ReceiptUtilityError with an HTTP status.
export function validateUploadDescriptor(input: { contentType: unknown; byteSize: unknown }): {
  contentType: SupportedImageType
  byteSize: number
  ext: 'jpg' | 'png' | 'webp'
} {
  if (!isSupportedImageType(input.contentType)) {
    throw new ReceiptUtilityError('Only JPG, PNG, or WebP images are supported (HEIC and PDF are not).', 415)
  }
  if (typeof input.byteSize !== 'number' || !Number.isInteger(input.byteSize)) {
    throw new ReceiptUtilityError('A numeric image size is required.', 400)
  }
  if (input.byteSize < MIN_UPLOAD_BYTES) throw new ReceiptUtilityError('That image is too small to be a receipt photo.', 400)
  if (input.byteSize > MAX_UPLOAD_BYTES) throw new ReceiptUtilityError('Image exceeds the 8 MB upload limit.', 413)
  return { contentType: input.contentType, byteSize: input.byteSize, ext: imageExtensionFor(input.contentType) }
}

export function createDraftId(): string {
  return `updraft_${randomUUID().replaceAll('-', '')}`
}
export function validDraftId(value: unknown): value is string {
  return typeof value === 'string' && /^updraft_[a-f0-9]{32}$/.test(value)
}
export function createUploadObjectId(): string {
  return `upobj_${randomUUID().replaceAll('-', '')}`
}
export function validUploadObjectId(value: unknown): value is string {
  return typeof value === 'string' && /^upobj_[a-f0-9]{32}$/.test(value)
}

// Server-generated storage path: `<draftId>/<objectId>.<ext>`. The client never
// supplies a path; the draft prefix binds every object to exactly one draft.
export function uploadObjectPath(draftId: string, objectId: string, ext: 'jpg' | 'png' | 'webp'): string {
  return `${draftId}/${objectId}.${ext}`
}

// Authorization check: does this object path belong to the given draft? Used to
// reject any path that is not under the draft the paid checkout was bound to.
export function objectPathBelongsToDraft(objectPath: string, draftId: string): boolean {
  if (!validDraftId(draftId)) return false
  const slash = objectPath.indexOf('/')
  return slash > 0 && objectPath.slice(0, slash) === draftId
}

export function draftExpiresAt(createdAtIso: string): string {
  return new Date(new Date(createdAtIso).getTime() + UPLOAD_EXPIRY_MS).toISOString()
}

// A draft's uploads are eligible for deletion once the draft reached a terminal
// state (delivered/refunded) or expired — and only if not already cleaned.
export function uploadCleanupEligible(
  draft: { status: DraftStatus; expiresAt: string; cleanedAt?: string | null },
  nowIso: string,
): boolean {
  if (draft.cleanedAt) return false
  if (draft.status === 'delivered' || draft.status === 'refunded') return true
  return new Date(nowIso).getTime() >= new Date(draft.expiresAt).getTime()
}

export function partitionCleanupEligible(
  drafts: { publicId: string; status: DraftStatus; expiresAt: string; cleanedAt?: string | null }[],
  nowIso: string,
): string[] {
  return drafts.filter((draft) => uploadCleanupEligible(draft, nowIso)).map((draft) => draft.publicId)
}

export function mixedBatchSize(input: { imageCount: number; textCount: number }): number {
  return input.imageCount + input.textCount
}

// Enforce the combined text + image limit for one paid run.
export function assertMixedBatchWithinLimit(input: { imageCount: number; textCount: number }): number {
  const total = mixedBatchSize(input)
  if (total < 1) throw new ReceiptUtilityError('Add at least one receipt (image or text).', 400)
  if (total > MAX_BATCH_ITEMS) throw new ReceiptUtilityError(`A single run accepts at most ${MAX_BATCH_ITEMS} receipts across images and text.`, 400)
  return total
}
