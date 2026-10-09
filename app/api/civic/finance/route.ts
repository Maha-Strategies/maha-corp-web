import { CIVIC_FINANCE_DISABLED_MESSAGE, CIVIC_FINANCE_POLICY } from '../../../../lib/civic/finance-policy.ts'
import { civicResponse } from '../../../../lib/civic/http.ts'

export const runtime = 'nodejs'

export async function GET() {
  return civicResponse({ ...CIVIC_FINANCE_POLICY,
    limitation: 'This reports software capabilities, not legal compliance or donor eligibility.' })
}

/** No payment provider, wallet, ledger write or donor-data intake is invoked. */
export async function POST(request: Request) {
  // Reject before consuming a body that might contain private donor information.
  void request
  return civicResponse({ status: 'disabled', error: CIVIC_FINANCE_DISABLED_MESSAGE }, 403)
}
