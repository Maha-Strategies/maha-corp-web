import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { createEvidencePreflightHandlers, evidencePreflightOptionsResponse } from '@/lib/evidence-preflight-api'
import {
  evidencePreflightPayloadHmac,
  evidencePreflightRequestHash,
} from '@/lib/evidence-preflight-server'
import { publicAuditVisitorHash } from '@/lib/public-mps-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const productionDependencies = {
  ledger: () => createAgentInquiryLedger(),
  visitorHash: publicAuditVisitorHash,
  requestHash: evidencePreflightRequestHash,
  payloadHmac: evidencePreflightPayloadHmac,
}

const handlers = createEvidencePreflightHandlers(productionDependencies)

export async function POST(request: Request) {
  return handlers.post(request)
}

export function OPTIONS() {
  return evidencePreflightOptionsResponse()
}
