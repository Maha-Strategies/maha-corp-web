import { compileContextPack, MAX_CONTEXT_PACK_BYTES, parseContextPackRequest } from '@/lib/context-compiler'
import { withSlotRelease } from '@/lib/x402/slot'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const handler = async (request: Request) => { if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return Response.json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, { status: 415 }); const raw = await request.text(); if (Buffer.byteLength(raw, 'utf8') > MAX_CONTEXT_PACK_BYTES) return Response.json({ error: { code: 'payload_too_large', message: 'Context input exceeds 128 KB.' } }, { status: 413 }); try { const result = compileContextPack(parseContextPackRequest(JSON.parse(raw))); return Response.json({ ...result, sourceTextStored: false, compiledContextStored: false }, { status: 201, headers: { 'Cache-Control': 'no-store' } }) } catch (error) { return Response.json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid compression request.' } }, { status: 400 }) } }

// A paid caller holds a concurrency slot from the moment proxy.ts admits it.
// The work is done by the time this returns, so the slot is freed here rather
// than left to lapse on its TTL and refuse the next caller for no reason.
export const POST = withSlotRelease(handler)
