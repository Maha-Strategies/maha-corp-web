import { auditSpending, spendingAuditInputSchema } from '../../../../lib/civic/spending-audit.ts'
import { civicInputError, civicResponse, readCivicJson } from '../../../../lib/civic/http.ts'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  try { return civicResponse(auditSpending(spendingAuditInputSchema.parse(await readCivicJson(request, 256_000)))) }
  catch (error) { return civicInputError(error) }
}
