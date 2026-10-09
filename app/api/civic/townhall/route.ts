import { timingSafeEqual } from 'node:crypto'
import { civicInputError, civicResponse, readCivicJson } from '../../../../lib/civic/http.ts'
import { answerTownhall, townhallInputSchema } from '../../../../lib/civic/townhall-agent.ts'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  let input
  try { input = townhallInputSchema.parse(await readCivicJson(request, 8192)) }
  catch (error) { return civicInputError(error) }
  let interpret
  // Explicit model requests require operator configuration and authentication.
  if (request.headers.get('x-civic-ai') === 'true') {
    const key = process.env.CIVIC_TOWNHALL_ACCESS_TOKEN
    if (process.env.CIVIC_TOWNHALL_AI_ENABLED !== 'true' || !key || !process.env.ANTHROPIC_API_KEY || !process.env.CIVIC_TOWNHALL_MODEL) {
      return civicResponse({ error: 'AI classification is unconfigured. Source retrieval is available.' }, 503)
    }
    const supplied = Buffer.from(request.headers.get('authorization') ?? ''), expected = Buffer.from(`Bearer ${key}`)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return civicResponse({ error: 'AI classification requires operator authorization.' }, 401)
    const { interpretTownhallQuestion } = await import('../../../../lib/civic/townhall-model.ts')
    interpret = interpretTownhallQuestion
  }
  try { return civicResponse(await answerTownhall(input, { interpret })) }
  catch (error) { return civicInputError(error) }
}
