import { configuredIdentity } from '../../../../../lib/carp/identity.ts'

export const dynamic = 'force-dynamic'

export function GET() {
  const identity = configuredIdentity()
  if (!identity) return Response.json({ error: 'CARP identity is not configured.' }, { status: 503 })
  return Response.json(identity.did, {
    headers: {
      'Content-Type': 'application/did+ld+json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
