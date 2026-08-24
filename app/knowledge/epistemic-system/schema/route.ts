import { EPISTEMIC_SCHEMA_DESCRIPTOR } from '@/lib/epistemic-schema'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(EPISTEMIC_SCHEMA_DESCRIPTOR, {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=86400' },
  })
}
