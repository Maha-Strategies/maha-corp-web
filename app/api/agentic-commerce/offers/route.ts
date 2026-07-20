import { agenticCommerceDiscovery } from '@/lib/agentic-commerce'

// A static discovery document is safe to cache: it contains no account,
// checkout, credential, or payment state and cannot create a transaction.
export const dynamic = 'force-static'

export function GET() {
  return Response.json(agenticCommerceDiscovery, {
    headers: {
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
