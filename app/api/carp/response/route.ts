import { acceptChallengeResponse } from '../../../../lib/carp/gateway.ts'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { rsp?: unknown; chall?: unknown }
    if (typeof body.rsp !== 'string' || typeof body.chall !== 'string') {
      return Response.json({ error: 'Body must contain string rsp and chall fields.' }, { status: 400 })
    }
    const publicKey = await acceptChallengeResponse({ response: body.rsp, challenge: body.chall })
    return Response.json({ ack: publicKey }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CARP identity response failed.'
    const status = /not an approved/.test(message) ? 401 : 400
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
