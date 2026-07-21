import { timingSafeEqual } from 'node:crypto'

import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { runUploadCleanup } from '@/lib/receipt-upload-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Removes source images for drafts that are delivered, refunded, or expired
// (abandoned) and not yet cleaned. Delivered/refunded runs are also cleaned
// inline at run time; this is the backstop for abandoned uploads.
function authorized(request: Request): boolean {
  const token = process.env.CRON_SECRET
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (!token || !supplied) return false
  const expected = Buffer.from(token), actual = Buffer.from(supplied)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const removed = await runUploadCleanup(ledger, 500)
  return Response.json({ removed })
}
