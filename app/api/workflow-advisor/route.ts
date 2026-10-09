import { timingSafeEqual } from 'node:crypto'

import { buildAdvisorPlan, parseAdvisorInput } from '../../../lib/workflow-advisor.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 8_192) return Response.json({ error: 'Request too large.' }, { status: 413 })
  let input
  try {
    const body = await request.text()
    if (Buffer.byteLength(body, 'utf8') > 8_192) return Response.json({ error: 'Request too large.' }, { status: 413 })
    input = parseAdvisorInput(JSON.parse(body))
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid JSON.' }, { status: 400 })
  }

  let interpretation: { objective: typeof input.objective; interpretation: string; openQuestions: string[] } | undefined
  if (input.objective === 'auto') {
    // Model-backed interpretation is private until an operator deliberately
    // enables it with both a server API key and a separate access token.
    if (process.env.WORKFLOW_ADVISOR_AI_ENABLED !== 'true' || !process.env.OPENAI_API_KEY || !process.env.WORKFLOW_ADVISOR_ACCESS_TOKEN) {
      return Response.json({ error: 'AI interpretation is not enabled. Choose an objective explicitly to use the deterministic advisor.' }, { status: 503 })
    }
    const suppliedToken = request.headers.get('x-maha-workflow-advisor-token') ?? ''
    const expectedToken = process.env.WORKFLOW_ADVISOR_ACCESS_TOKEN
    const supplied = Buffer.from(suppliedToken)
    const expected = Buffer.from(expectedToken)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return Response.json({ error: 'AI interpretation requires a valid access token.' }, { status: 401 })
    }
    try {
      const { interpretWorkflow } = await import('../../../lib/workflow-advisor-agent.ts')
      interpretation = await interpretWorkflow(input)
    } catch {
      return Response.json({ error: 'AI interpretation is temporarily unavailable. Choose an objective explicitly.' }, { status: 502 })
    }
  }

  const objective = interpretation?.objective ?? input.objective
  if (objective === 'auto') return Response.json({ error: 'Choose an objective.' }, { status: 400 })
  return Response.json({
    mode: interpretation ? 'agent-interpreted' : 'deterministic',
    interpretation,
    plan: buildAdvisorPlan(input, objective),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
