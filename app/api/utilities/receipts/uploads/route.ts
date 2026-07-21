import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { RECEIPT_UTILITY, ReceiptUtilityError } from '@/lib/receipt-utility'
import {
  RECEIPT_UPLOAD_BUCKET, createDraftId, createUploadObjectId, draftExpiresAt,
  uploadObjectPath, validateUploadDescriptor, validDraftId,
} from '@/lib/receipt-uploads'
import { utilityCatalogConfig } from '@/lib/utility-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 2_048

function response(body: object, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

// Issue a short-lived signed upload URL for ONE image, bound to a server-owned
// draft. The client uploads the bytes directly to the private bucket; no image
// data is ever accepted, stored, or logged by this endpoint.
export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return response({ error: 'Content-Type must be application/json.' }, 415)
  }
  let body: { draftId?: unknown; contentType?: unknown; byteSize?: unknown }
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return response({ error: 'Request too large.' }, 413)
    body = JSON.parse(raw)
  } catch { return response({ error: 'Invalid request.' }, 400) }

  let descriptor: ReturnType<typeof validateUploadDescriptor>
  try { descriptor = validateUploadDescriptor({ contentType: body.contentType, byteSize: body.byteSize }) }
  catch (error) {
    const status = error instanceof ReceiptUtilityError ? error.status : 400
    return response({ error: error instanceof Error ? error.message : 'Invalid image.' }, status)
  }

  // Uploads are only offered when the paid flow is configured.
  let config
  try { config = utilityCatalogConfig() }
  catch { return response({ error: 'Uploads are temporarily unavailable.' }, 503) }
  if (!config) return response({ error: 'Receipt uploads are not currently available.' }, 503)

  const ledger = createAgentInquiryLedger()
  if (!ledger) return response({ error: 'Uploads are temporarily unavailable.' }, 503)

  // Reuse the caller's draft, or open a new one. A client-supplied draft id must
  // be well-formed; register_utility_upload_object rejects an unknown one.
  let draftId: string
  if (body.draftId !== undefined) {
    if (!validDraftId(body.draftId)) return response({ error: 'Invalid draft id.' }, 400)
    draftId = body.draftId
  } else {
    draftId = createDraftId()
    const { error } = await ledger.from('utility_upload_drafts').insert({
      public_id: draftId, utility: RECEIPT_UTILITY, expires_at: draftExpiresAt(new Date().toISOString()),
    })
    if (error) { console.error('Upload draft insert failed:', error.code); return response({ error: 'Uploads are temporarily unavailable.' }, 503) }
  }

  const objectId = createUploadObjectId()
  const objectPath = uploadObjectPath(draftId, objectId, descriptor.ext)
  const { data: registered, error: registerError } = await ledger.rpc('register_utility_upload_object', {
    p_object_id: objectId, p_draft_id: draftId, p_object_path: objectPath,
    p_content_type: descriptor.contentType, p_byte_size: descriptor.byteSize, p_now: new Date().toISOString(),
  })
  if (registerError) { console.error('Upload registration failed:', registerError.code); return response({ error: 'Uploads are temporarily unavailable.' }, 503) }
  switch (registered) {
    case 'registered': break
    case 'draft_not_found': return response({ error: 'No such upload draft.' }, 404)
    case 'expired': return response({ error: 'This upload session has expired. Start over.' }, 410)
    case 'limit_reached': return response({ error: 'A single run accepts at most 20 receipts.' }, 409)
    case 'closed': return response({ error: 'This upload session is closed.' }, 409)
    default: return response({ error: 'Uploads are temporarily unavailable.' }, 503)
  }

  const { data: signed, error: signError } = await ledger.storage.from(RECEIPT_UPLOAD_BUCKET).createSignedUploadUrl(objectPath)
  if (signError || !signed?.signedUrl) {
    console.error('Signed upload URL failed.')
    return response({ error: 'Uploads are temporarily unavailable.' }, 503)
  }

  return response({ draftId, objectId, uploadUrl: signed.signedUrl, contentType: descriptor.contentType }, 201)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
