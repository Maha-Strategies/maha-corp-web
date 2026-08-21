import { configuredEndpointBinding } from '../../../../../lib/carp/endpoint-binding.ts'

export const dynamic = 'force-dynamic'

export function GET() {
  const binding = configuredEndpointBinding()
  if (!binding) return Response.json({ error: 'CARP identity is not configured.' }, { status: 503 })
  return Response.json(binding, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
