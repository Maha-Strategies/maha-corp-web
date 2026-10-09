import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'
import { EBOOKS, EBOOK_AMOUNT, EBOOK_VERSION, ebookArtifacts, ebookBundleHash, ebookHash, ebookOfferId, ebookOrderHash, ebookResource, type EbookId, type EbookOrder } from './ebook-contract.ts'

export function validateEbookBytes(id: EbookId, bytes: Uint8Array): Buffer {
  const buffer = Buffer.from(bytes)
  if (buffer.length !== EBOOKS[id].bytes || ebookHash(buffer) !== EBOOKS[id].sha256 || buffer.subarray(0, 4).toString('hex') !== '504b0304') throw new Error('ebook_integrity_failure')
  return buffer
}

// Paid assets never belong in public/ or the public Git repository. Next traces
// only these pinned files into the server functions that deliver the books.
export type EbookPayload = Buffer[]
export const EBOOK_STORAGE_BUCKET = 'cabezon-ebooks-private'
export const ebookStoragePath = (file: ReturnType<typeof ebookArtifacts>[number]) => `${file.sha256.slice(7)}/${file.filename}`
async function downloadPrivateEbook(file: ReturnType<typeof ebookArtifacts>[number]): Promise<Buffer> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (process.env.X402_EBOOK_STORAGE !== 'private' || !url || !key) throw new Error('ebook_private_storage_unconfigured')
  const response = await fetch(`${url.replace(/\/$/, '')}/storage/v1/object/authenticated/${EBOOK_STORAGE_BUCKET}/${ebookStoragePath(file)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok || !response.body) throw new Error('ebook_private_storage_unavailable')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > file.bytes) throw new Error('ebook_integrity_failure')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  return Buffer.concat(chunks)
}
export function validateEbookPayload(id: EbookId, files: readonly Uint8Array[]): EbookPayload {
  const manifest = ebookArtifacts(id)
  if (files.length !== manifest.length) throw new Error('ebook_integrity_failure')
  return manifest.map((file, i) => {
    const buffer = Buffer.from(files[i])
    if (buffer.length !== file.bytes || ebookHash(buffer) !== file.sha256) throw new Error('ebook_integrity_failure')
    if (file.mediaType === 'application/pdf' ? !buffer.subarray(0, 5).equals(Buffer.from('%PDF-')) : buffer.subarray(0, 4).toString('hex') !== '504b0304') throw new Error('ebook_integrity_failure')
    return buffer
  })
}
export async function loadEbook(id: EbookId): Promise<EbookPayload> {
  if (process.env.X402_EBOOK_STORAGE === 'private') {
    return validateEbookPayload(id, await Promise.all(ebookArtifacts(id).map(downloadPrivateEbook)))
  }
  const files = await Promise.all(ebookArtifacts(id).map(async file => {
    try { return await readFile(resolve(process.cwd(), 'content', 'paid-ebooks', file.filename)) }
    catch (error) {
      // An invalid local file fails integrity checks; only a missing packaged
      // asset may use the pinned private store. Never return a public URL.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      return downloadPrivateEbook(file)
    }
  }))
  return validateEbookPayload(id, files)
}

export type PaidEbookRecord = { state: string; payment_transaction: string | null; input_hash: string; resource: string; amount: string | number }
export async function findPaidEbook(id: EbookId, payer: string, orderId: string): Promise<PaidEbookRecord | null> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(payer)) throw new Error('invalid_payer')
  const ledger = createAgentInquiryLedger()
  if (!ledger) throw new Error('ledger_unavailable')
  const { data, error } = await ledger.from('x402_offer_admissions').select('state,payment_transaction,input_hash,resource,amount')
    .eq('offer_id', ebookOfferId(id)).ilike('payer', payer).eq('idempotency_key', orderId).maybeSingle()
  if (error) throw new Error('ledger_unavailable')
  return data as PaidEbookRecord | null
}

export function authorizeEbookRecovery(id: EbookId, order: EbookOrder, row: PaidEbookRecord | null): string {
  if (!row || row.state !== 'settled' || !/^0x[0-9a-fA-F]{64}$/.test(row.payment_transaction ?? '') || row.input_hash !== ebookOrderHash(id, order)
    || row.resource !== ebookResource(id) || String(row.amount) !== EBOOK_AMOUNT) throw new Error('paid_order_not_found')
  return row.payment_transaction!
}

export function ebookDelivery(id: EbookId, order: EbookOrder, files: readonly Uint8Array[], transaction: string, recovered: boolean) {
  const buffers = validateEbookPayload(id, files)
  if (order.artifactHash !== ebookBundleHash(id)) throw new Error('ebook_version_unavailable')
  return { productId: ebookOfferId(id), version: EBOOK_VERSION, orderId: order.clientRequestId, transaction, recovered,
    delivery: 'inline_base64_ebook_bundle', acceptance: 'buyer_review_required', exampleOnly: false,
    manifestSha256: ebookBundleHash(id), artifacts: ebookArtifacts(id).map((file, i) => ({ ...file, base64: buffers[i].toString('base64') })) }
}
