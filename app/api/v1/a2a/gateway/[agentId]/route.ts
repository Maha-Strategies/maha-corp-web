import crypto from 'node:crypto'
import { A2AProxyEngine } from '@/lib/a2a/proxy'
import { A2ARegistry } from '@/lib/a2a/registry'
import { evaluateA2ATaskPolicy, parseA2ARequest } from '@/lib/a2a/validation'
import { PAYMENT_SIGNATURE_HEADER } from '@/lib/x402/protocol'
import { resolveTaskAttribution } from '@/lib/agent-task-attribution'
import { workflowTaskIdForExternal } from '@/lib/workflows/task-state'
import { workflowActionIdForExternal } from '@/lib/workflows/recovery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const MAX_BODY_BYTES = 65_536

function rpcError(id: string | number | null, code: number, message: string, status: number) {
  return Response.json({ jsonrpc: '2.0', id, error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request, context: { params: Promise<{ agentId: string }> }) {
  const tenantId = request.headers.get('x-maha-tenant-id')
  if (!tenantId) return rpcError(null, -32001, 'Unauthorized.', 401)
  const { agentId } = await context.params
  if (!/^a2a_agt_[a-f0-9]{16}$/.test(agentId)) return rpcError(null, -32600, 'Invalid A2A agent ID.', 400)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return rpcError(null, -32600, 'Content-Type must be application/json.', 415)
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return rpcError(null, -32600, 'A2A request exceeds 64 KB.', 413)
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return rpcError(null, -32600, 'A2A request exceeds 64 KB.', 413)
  let rpc
  try { rpc = parseA2ARequest(JSON.parse(text)) } catch (error) { return rpcError(null, -32600, error instanceof Error ? error.message : 'Invalid A2A request.', 400) }
  try {
    const agent = await A2ARegistry.getAgent(tenantId, agentId)
    if (!agent) return rpcError(rpc.id, -32601, 'Target A2A agent is not registered for this tenant.', 404)
    const taskClass = request.headers.get('x-maha-task-class')
    const decision = evaluateA2ATaskPolicy(rpc, taskClass, agent.taskPolicy)
    if (!decision.allowed) return rpcError(rpc.id, decision.code, decision.message, 403)
    const attribution = resolveTaskAttribution(request.headers)
    const traceId = `trc_${crypto.randomBytes(8).toString('hex')}`
    const externalActionId = request.headers.get('x-maha-action-id')
    if (externalActionId && !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(externalActionId)) return rpcError(rpc.id, -32600, 'Invalid X-Maha-Action-ID.', 400)
    const result = await A2AProxyEngine.dispatch(agent, rpc, {
      tenantId,
      traceId,
      taskClass: decision.taskClass,
      inputBytes: decision.textBytes,
      paymentSignature: request.headers.get(PAYMENT_SIGNATURE_HEADER),
      a2aVersion: request.headers.get('a2a-version'),
      ...(attribution.taskId ? { workflowTaskId: workflowTaskIdForExternal(attribution.taskId) } : {}),
      actionId: workflowActionIdForExternal(externalActionId ?? traceId),
      approvalId: request.headers.get('x-maha-approval-id') ?? undefined,
    })
    const headers: Record<string, string> = { 'Cache-Control': 'no-store', ...(result.headers ?? {}) }
    if (result.retryAfterSeconds) headers['Retry-After'] = String(result.retryAfterSeconds)
    return Response.json(result.body, { status: result.status, headers })
  } catch (error) {
    console.error('[A2A_GATEWAY_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return rpcError(rpc.id, -32603, 'Internal A2A gateway processing failure.', 500)
  }
}
