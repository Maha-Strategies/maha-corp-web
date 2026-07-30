import claimsData from '@/lib/atlas/generated-claims.json'
import type { MpsClaim } from '@/scripts/expand-graph'
export const runtime = 'nodejs'
const claims = claimsData as MpsClaim[]
export async function GET(_request: Request, { params }: { params: Promise<{ claimId: string }> }) { const { claimId } = await params; const claim = claims.find((item) => item.claim_id === claimId); if (!claim) return Response.json({ error: { code: 'claim_not_found', message: 'No active generated claim matches this ID.' } }, { status: 404 }); return Response.json({ ...claim, canonical_url: `https://research.mahastrategies.com/claims/${claim.claim_id}` }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600' } }) }
