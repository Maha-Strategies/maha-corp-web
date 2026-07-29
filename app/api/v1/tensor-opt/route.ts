import { createHash } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TensorOptMockRequest = { clientRequestId?: unknown; problem?: { formulation?: unknown; variableCount?: unknown; spinCount?: unknown }; solver?: { bondDimensionMax?: unknown; maxSweeps?: unknown; seed?: unknown }; target?: { kind?: unknown } }

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Maha-API-Mode': 'mock' } }) }

/** Integration-only contract stub. It accepts no matrix terms, queues no work, and never represents a result as measured performance. */
export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let payload: TensorOptMockRequest
  try { payload = await request.json() as TensorOptMockRequest } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  const clientRequestId = typeof payload.clientRequestId === 'string' ? payload.clientRequestId : ''
  const formulation = payload.problem?.formulation
  const variableCount = formulation === 'qubo' ? payload.problem?.variableCount : payload.problem?.spinCount
  if (clientRequestId.length < 8 || clientRequestId.length > 120) return json({ error: { code: 'invalid_client_request_id', message: 'clientRequestId must be 8–120 characters.' } }, 400)
  if (formulation !== 'qubo' && formulation !== 'ising') return json({ error: { code: 'invalid_problem', message: 'problem.formulation must be "qubo" or "ising".' } }, 400)
  if (!Number.isInteger(variableCount) || (variableCount as number) < 1 || (variableCount as number) > 1_000_000) return json({ error: { code: 'invalid_problem_size', message: 'The QUBO variable count or Ising spin count must be an integer from 1 to 1,000,000.' } }, 400)
  const inputHash = createHash('sha256').update(JSON.stringify({ clientRequestId, formulation, variableCount })).digest('hex')
  return json({ mock: true, message: 'Integration stub only: no optimization was run and no performance claim is implied.', jobId: `topt_${inputHash.slice(0, 32)}`, status: 'queued', clientRequestId, inputHash, acceptedConfiguration: { formulation, problemSize: variableCount, target: payload.target?.kind === 'tpu' ? 'tpu' : 'gpu', bondDimensionMax: typeof payload.solver?.bondDimensionMax === 'number' ? payload.solver.bondDimensionMax : null, maxSweeps: typeof payload.solver?.maxSweeps === 'number' ? payload.solver.maxSweeps : null, seed: typeof payload.solver?.seed === 'number' ? payload.solver.seed : null }, citations: [{ claimId: 'tn-014', url: 'https://research.mahastrategies.com/atlas/tensor-networks/claims/tn-014', role: 'method-basis', verificationBoundary: 'research-node' }], sourceTextStored: false }, 202)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
