import { CIVIC_MODEL_CARDS, evaluateCostEvidence } from '../../../../lib/civic/model-evidence.ts'
import { civicInputError, civicResponse, readCivicJson } from '../../../../lib/civic/http.ts'
export const runtime = 'nodejs'
export const GET = () => civicResponse({ models: CIVIC_MODEL_CARDS })
export async function POST(request: Request) {
  try { return civicResponse(evaluateCostEvidence(await readCivicJson(request, 200000))) }
  catch (error) { return civicInputError(error) }
}
