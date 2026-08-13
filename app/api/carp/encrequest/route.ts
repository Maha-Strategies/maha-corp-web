import { after } from 'next/server'

import { deliverSellerReply, prepareSellerReply } from '../../../../lib/carp/gateway.ts'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const prepared = await prepareSellerReply(await request.json())
    after(async () => {
      try {
        await deliverSellerReply(prepared)
      } catch (error) {
        console.error('CARP seller result delivery failed', error instanceof Error ? error.message : 'unknown error')
      }
    })
    return Response.json({ ack: true, requestId: prepared.request.id }, {
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CARP encrypted request failed.'
    const status = /not approved/.test(message) ? 401 : 400
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
