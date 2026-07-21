// Server-only storage effects for receipt-image ingestion. Uses the service-role
// ledger to read/delete PRIVATE storage objects. Nothing here is exposed to the
// browser; images reach the model only through fetchDraftImages at run time and
// are removed by cleanupDraftUploads / runUploadCleanup afterward.

import type { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { RECEIPT_UPLOAD_BUCKET, type SupportedImageType, isSupportedImageType, objectPathBelongsToDraft } from '@/lib/receipt-uploads'

type Ledger = NonNullable<ReturnType<typeof createAgentInquiryLedger>>

export type DraftImage = { objectId: string; contentType: SupportedImageType; dataBase64: string }

// Fetch and base64-encode every image bound to a draft. Only the draft's own
// objects are read (path prefix is re-checked); unreadable objects are skipped.
export async function fetchDraftImages(ledger: Ledger, draftId: string): Promise<DraftImage[]> {
  const { data: rows, error } = await ledger
    .from('utility_upload_objects')
    .select('public_id, object_path, content_type')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: true })
  if (error || !rows?.length) return []

  const images: DraftImage[] = []
  for (const row of rows) {
    if (!objectPathBelongsToDraft(row.object_path, draftId) || !isSupportedImageType(row.content_type)) continue
    const { data: blob, error: downloadError } = await ledger.storage.from(RECEIPT_UPLOAD_BUCKET).download(row.object_path)
    if (downloadError || !blob) {
      console.error('Receipt image download failed for a draft object.')
      continue
    }
    const dataBase64 = Buffer.from(await blob.arrayBuffer()).toString('base64')
    images.push({ objectId: row.public_id, contentType: row.content_type, dataBase64 })
  }
  return images
}

// Remove a draft's storage objects and drop their rows. Idempotent and
// best-effort: a partial failure is logged, never thrown, so it cannot break the
// paid run's response. `status` records why (delivered vs refunded).
export async function cleanupDraftUploads(ledger: Ledger, draftId: string, status: 'delivered' | 'refunded'): Promise<void> {
  try {
    await ledger.rpc('set_utility_upload_draft_status', { p_draft_id: draftId, p_status: status })
    const { data: rows } = await ledger.from('utility_upload_objects').select('object_path').eq('draft_id', draftId)
    const paths = (rows ?? []).map((row) => row.object_path).filter((path): path is string => typeof path === 'string' && objectPathBelongsToDraft(path, draftId))
    if (paths.length) {
      const { error } = await ledger.storage.from(RECEIPT_UPLOAD_BUCKET).remove(paths)
      if (error) { console.error('Receipt image cleanup: storage removal failed.'); return }
    }
    await ledger.rpc('finalize_utility_upload_cleanup', { p_draft_id: draftId, p_now: new Date().toISOString() })
  } catch (error) {
    console.error('Receipt image cleanup error:', error instanceof Error ? error.message : 'unknown_error')
  }
}

// Batch cleanup for abandoned/expired/delivered/refunded drafts (cron path).
// Returns the number of objects removed.
export async function runUploadCleanup(ledger: Ledger, limit = 500): Promise<number> {
  const { data: rows, error } = await ledger.rpc('list_utility_upload_cleanup', { p_now: new Date().toISOString(), p_limit: limit })
  if (error || !Array.isArray(rows) || rows.length === 0) return 0

  const byDraft = new Map<string, string[]>()
  for (const row of rows as { draft_id: string; object_path: string }[]) {
    if (!objectPathBelongsToDraft(row.object_path, row.draft_id)) continue
    const list = byDraft.get(row.draft_id) ?? []
    list.push(row.object_path)
    byDraft.set(row.draft_id, list)
  }

  let removed = 0
  for (const [draftId, paths] of byDraft) {
    const { error: removeError } = await ledger.storage.from(RECEIPT_UPLOAD_BUCKET).remove(paths)
    if (removeError) { console.error('Upload cleanup: storage removal failed for a draft.'); continue }
    await ledger.rpc('finalize_utility_upload_cleanup', { p_draft_id: draftId, p_now: new Date().toISOString() })
    removed += paths.length
  }
  return removed
}
