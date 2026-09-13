import { CELESTIAL_RULE_SET, EVIDENCE_RULE_SET } from '@/lib/x402/compatibility-products'
import { microDigest } from '@/lib/x402/micro-products'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export function GET() {
  return Response.json({ status: 'draft-review-and-price-approval-pending', paymentEnabled: false,
    celestial: { ...CELESTIAL_RULE_SET, digest: microDigest(CELESTIAL_RULE_SET) },
    evidence: { ...EVIDENCE_RULE_SET, digest: microDigest(EVIDENCE_RULE_SET) },
    boundary: 'Checks on caller declarations, not source truth, calculation correctness or expert review.' },
  { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}
