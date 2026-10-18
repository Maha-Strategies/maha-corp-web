import { createHash } from 'node:crypto'
import { z } from 'zod'

export const BOOK_CHUNK_BYTES = 1024 * 1024
let chunkRequestsActive=0
const hash = (b: string | Uint8Array) => 'sha256:' + createHash('sha256').update(b).digest('hex')
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/)
export const releaseSchema = z.object({ id: z.string().regex(/^[a-z0-9-]+$/), version: z.string().regex(/^\d+\.\d+\.\d+$/),
  amount: z.enum(['10000000','30000000']), resource: z.string().url().refine(s => new URL(s).origin === 'https://www.mahastrategies.com'),
  termsHash: digest, artifacts: z.array(z.object({ format: z.enum(['epub','pdf']), filename: z.string().regex(/^[A-Za-z0-9_.-]+$/),
    bytes: z.number().int().positive().max(100_000_000), sha256: digest }).strict()).length(2)
    .refine(a => new Set(a.map(f => f.format)).size === 2),
}).strict().refine(r => r.amount === (r.id === 'beyond-the-biological' ? '30000000' : '10000000'), 'book_price_mismatch')
export type BookRelease = z.infer<typeof releaseSchema>
export const bookManifestHash = (release: BookRelease) => hash(JSON.stringify(releaseSchema.parse(release)))
export const bookRecoveryOrder = z.object({ clientRequestId: z.string().regex(/^[A-Za-z0-9_-]{8,120}$/),
  version: z.string(), manifestHash: digest, termsHash: digest,
  recoverySecret: z.string().regex(/^[a-f0-9]{64}$/).refine(s => new Set(s).size >= 8),
}).strict()
export type BookRecoveryOrder = z.infer<typeof bookRecoveryOrder>
export function bookAuthorizationNonce(release: BookRelease, order: BookRecoveryOrder) {
  const r = releaseSchema.parse(release), o = bookRecoveryOrder.parse(order)
  if (o.version !== r.version || o.manifestHash !== bookManifestHash(r) || o.termsHash !== r.termsHash) throw Error('edition_or_terms_mismatch')
  // Fixed array order binds the entire paid bundle and exact private recovery secret.
  return '0x' + hash(JSON.stringify(['maha-book-bundle/2', r.id, r.resource, r.amount, o.clientRequestId,
    o.version, o.manifestHash, o.termsHash, o.recoverySecret])).slice(7)
}
const proofSchema = z.object({ transaction: z.string().regex(/^0x[0-9a-fA-F]{64}$/), payer: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  order: bookRecoveryOrder, format: z.enum(['epub','pdf']), chunk: z.number().int().min(0).max(99) }).strict()
export type BookProofRequest = z.infer<typeof proofSchema>
export type BookReceiptExpectation = { transaction: string; payer: string; payee: string; amount: string; nonce: string }
export type BookDeliveryPorts = {
  /** Confirm the successful Base native-USDC receipt, matching AuthorizationUsed
   * and its associated Transfer. A Transfer/amount alone MUST NOT return true. */
  confirm: (expected: BookReceiptExpectation) => Promise<boolean>
  /** Server-selected asset from the private version archive; never a request path. */
  load: (release: BookRelease, format: 'epub'|'pdf') => Promise<Uint8Array>
  payee: string
}
export function validateBookReleaseFiles(release: BookRelease, buffers: ReadonlyMap<string, Uint8Array>) {
  const r = releaseSchema.parse(release)
  for (const pin of r.artifacts) {
    const b = buffers.get(pin.format)
    if (!b || b.length !== pin.bytes || hash(b) !== pin.sha256) throw Error('book_integrity_failure')
    const magic = Buffer.from(b.subarray(0,5))
    if (pin.format === 'pdf' ? magic.toString() !== '%PDF-' : magic.subarray(0,4).toString('hex') !== '504b0304') throw Error('book_format_failure')
  }
}
/** Read-only delivery/recovery, not a new payment collector. It has no verify/
 * settle/transfer operation and cannot charge a buyer. No production route is
 * mounted until a reviewed purchase adapter binds the SAME authorization nonce.
 */
export async function recoverBookChunk(release: BookRelease, input: unknown, ports: BookDeliveryPorts) {
  const r = releaseSchema.parse(release), p = proofSchema.parse(input)
  if (!/^0x[0-9a-fA-F]{40}$/.test(ports.payee) || /^0x0{40}$/.test(ports.payee)) throw Error('payee_unavailable')
  const nonce = bookAuthorizationNonce(r, p.order), pin = r.artifacts.find(f => f.format === p.format)!
  const chunks = Math.ceil(pin.bytes/BOOK_CHUNK_BYTES)
  if (p.chunk >= chunks) throw Error('chunk_out_of_range')
  const confirmed = await ports.confirm({ transaction: p.transaction, payer: p.payer.toLowerCase(),
    payee: ports.payee.toLowerCase(), amount: r.amount, nonce })
  if (!confirmed) throw Error('settlement_not_established_do_not_repay')
  const bytes = await ports.load(r, p.format)
  if (bytes.length !== pin.bytes || hash(bytes) !== pin.sha256) throw Error('book_integrity_failure_do_not_repay')
  const magic = Buffer.from(bytes.subarray(0,5))
  if (pin.format === 'pdf' ? magic.toString() !== '%PDF-' : magic.subarray(0,4).toString('hex') !== '504b0304') throw Error('book_format_failure_do_not_repay')
  const start = p.chunk * BOOK_CHUNK_BYTES, end = Math.min(start+BOOK_CHUNK_BYTES,bytes.length)
  const chunk = bytes.subarray(start,end)
  return { version: 'maha-book-chunk/2', bookId: r.id, edition: r.version, manifestHash: bookManifestHash(r),
    transaction: p.transaction, format: pin.format, filename: pin.filename,
    fileBytes: pin.bytes, fileSha256: pin.sha256, chunk: p.chunk, chunks, start, endExclusive: end,
    chunkSha256: hash(chunk), encoding: 'base64', data: Buffer.from(chunk).toString('base64'),
    paymentRequired: false, automaticRepayment: false, deliveryAcceptance: 'buyer_file_verification_required' }
}

/** HTTP body bounds, no URL secrets, caches, telemetry or public asset links. */
export function bookChunkHandler(release: BookRelease, ports: BookDeliveryPorts) {
  const headers = { 'Cache-Control': 'no-store, max-age=0', 'Content-Type': 'application/json; charset=utf-8',
    'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff' }
  const json = (v: unknown, status: number) => Response.json(v,{status,headers})
  const handle = async (request: Request) => {
    if (request.method !== 'POST') return json({error:'post_required',automaticRepayment:false},405)
    if (new URL(request.url).search || ['payment-signature','x-payment-signature','x-payment','authorization','cookie'].some(h => request.headers.has(h))) return json({error:'recovery_credentials_invalid'},400)
    if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')??'') || request.headers.has('content-encoding')) return json({error:'json_utf8_required'},415)
    const reader = request.body?.getReader()
    if (!reader) return json({error:'body_required'},400)
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const limit = new Promise<never>((_,reject) => { timer=setTimeout(()=>reject(Error('body_timeout')),3000) })
      const parts: Uint8Array[] = []; let size=0
      for (;;) {
        const {value,done}=await Promise.race([reader.read(),limit]); if(done)break
        size+=value.byteLength; if(size>4096) return json({error:'request_too_large'},413); parts.push(value)
      }
      const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)))
      const out=await recoverBookChunk(release,value,ports)
      return json(out,200)
    } catch { return json({error:'recovery_unavailable_check_order_or_contact_seller_do_not_repay',automaticRepayment:false},409) }
    finally { clearTimeout(timer); void reader.cancel().catch(()=>{}) }
  }
  return async(request:Request)=>{
    if(chunkRequestsActive>=4)return json({error:'book_recovery_capacity',automaticRepayment:false},429)
    chunkRequestsActive++
    try{return await handle(request)}finally{chunkRequestsActive--}
  }
}
