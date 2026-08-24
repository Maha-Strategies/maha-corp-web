import {
  EPISTEMIC_PHASE4_PILOT_BOUNDARY,
  EPISTEMIC_PHASE4_PILOT_MANIFEST,
} from '@/lib/epistemic-pilot-corpus'

export const dynamic = 'force-static'

export function GET() {
  return Response.json({
    ...EPISTEMIC_PHASE4_PILOT_MANIFEST,
    boundary: EPISTEMIC_PHASE4_PILOT_BOUNDARY,
    reviewerCredentialsIncluded: false,
    reviewerIdentitiesIncluded: false,
    decisionStatusIncluded: false,
  }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600' } })
}
