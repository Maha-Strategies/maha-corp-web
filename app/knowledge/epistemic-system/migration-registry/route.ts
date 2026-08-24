import { EPISTEMIC_MIGRATION_INVENTORY } from '@/lib/epistemic-adapters'
import { EPISTEMIC_OPERATIONAL_EVIDENCE } from '@/lib/epistemic-operational-evidence'

export const dynamic = 'force-static'

export function GET() {
  return Response.json({
    ...EPISTEMIC_MIGRATION_INVENTORY,
    operationalEvidence: EPISTEMIC_OPERATIONAL_EVIDENCE,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
      'Content-Disposition': 'inline; filename="maha-epistemic-migration-registry.json"',
    },
  })
}
