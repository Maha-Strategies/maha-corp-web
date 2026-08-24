import { EPISTEMIC_MIGRATION_INVENTORY } from '@/lib/epistemic-adapters'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(EPISTEMIC_MIGRATION_INVENTORY, {
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
      'Content-Disposition': 'inline; filename="maha-epistemic-migration-registry.json"',
    },
  })
}
