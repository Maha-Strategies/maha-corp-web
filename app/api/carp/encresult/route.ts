import { storeEncryptedAnswer } from '../../../../lib/carp/gateway.ts'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const requestId = await storeEncryptedAnswer(await request.json())
    return Response.json({ ack: true, requestId }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CARP encrypted result failed.'
    const status = /not approved/.test(message) ? 401 : 400
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
