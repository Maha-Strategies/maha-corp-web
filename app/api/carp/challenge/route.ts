import { issueChallenge } from '../../../../lib/carp/gateway.ts'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return Response.json({ jsonrpc: '2.0', result: { challenge: await issueChallenge() }, id: 0 }, {
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch {
    return Response.json({ error: 'CARP identity service is unavailable.' }, { status: 503 })
  }
}
