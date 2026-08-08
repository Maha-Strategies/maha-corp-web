import { compileContextPack, parseContextPackRequest } from '@/lib/context-compiler'
import documents from '@/content/recipes/context-compiler-playground-workload.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_TASK = 'Compare how these works describe cognition, adaptation, imagination, agency, and the construction of a self.'

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export async function POST(request: Request) {
  try {
    const supplied = object(await request.json().catch(() => ({}))) ?? {}
    const input = parseContextPackRequest({
      clientRequestId: `playground_${crypto.randomUUID()}`,
      task: supplied.task ?? DEFAULT_TASK,
      tokenBudget: supplied.tokenBudget ?? 8_000,
      documents,
      provenance: 'compact',
      scoring: 'bm25',
      budgetMode: 'guaranteed',
    })
    const result = compileContextPack(input)

    return Response.json({
      workload: {
        name: 'Four-chapter cognition and agency comparison',
        description: 'Four complete, published Maha Strategies chapters—not generated filler—compiled for one comparative-analysis task.',
        documents,
      },
      request: input,
      result: { ...result, sourceTextStored: false, compiledContextStored: false },
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({
      error: { code: 'invalid_playground_request', message: error instanceof Error ? error.message : 'The sample could not be compiled.' },
    }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
