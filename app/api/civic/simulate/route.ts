import { civicInputError, civicResponse, readCivicJson } from '../../../../lib/civic/http.ts'
import { simulatePolicy, simulationInputSchema } from '../../../../lib/civic/policy-graph.ts'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  try { return civicResponse(simulatePolicy(simulationInputSchema.parse(await readCivicJson(request, 8192)))) }
  catch (error) { return civicInputError(error) }
}
