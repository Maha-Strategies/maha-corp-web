import { UpstashApprovalStore } from '@/lib/workflows/approvals'
import { authorizeWorkflowControl, readBoundedJson, workflowTenantId, WorkflowControlInputError, WORKFLOW_CONTROL_RESPONSE_HEADERS } from '@/lib/workflows/control'
import { OPERATOR_TRANSITION_EVENTS, WorkflowOrchestrator, type OperatorTransitionEvent } from '@/lib/workflows/orchestration'
import { UpstashRecoveryStore } from '@/lib/workflows/recovery'
import { UpstashWorkflowTaskStore } from '@/lib/workflows/task-state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TASK_ID = /^workflow-task-[a-f0-9]{32}$/
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/
const SHA256 = /^sha256:[a-f0-9]{64}$/

function orchestrator() { return new WorkflowOrchestrator(new UpstashWorkflowTaskStore(), new UpstashApprovalStore(), new UpstashRecoveryStore()) }

function target(request: Request, taskId: string): string | Response {
  const auth = authorizeWorkflowControl(request)
  if (!auth.ok) return Response.json({ error: auth.status === 503 ? 'Workflow control is unavailable.' : 'Unauthorized.' }, { status: auth.status, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  const tenantId = workflowTenantId(request, auth)
  if (!tenantId || !TASK_ID.test(taskId)) return Response.json({ error: 'Invalid workflow target.' }, { status: 400, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  return tenantId
}

export async function GET(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params
  const tenantId = target(request, taskId)
  if (tenantId instanceof Response) return tenantId
  try {
    const snapshot = await orchestrator().snapshot(tenantId, taskId)
    if (!snapshot) return Response.json({ error: 'Workflow task not found.' }, { status: 404, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
    return Response.json(snapshot, { headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  } catch (error) {
    console.error('[ORCHESTRATION_SNAPSHOT_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return Response.json({ error: 'Workflow task could not be read.' }, { status: 503, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  }
}

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params
  const tenantId = target(request, taskId)
  if (tenantId instanceof Response) return tenantId
  try {
    const value = await readBoundedJson(request)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new WorkflowControlInputError(400, 'Invalid workflow transition.')
    const body = value as Record<string, unknown>
    if (Object.keys(body).some((key) => !['event', 'transitionId', 'evidenceSha256'].includes(key)) ||
      typeof body.event !== 'string' || !OPERATOR_TRANSITION_EVENTS.includes(body.event as OperatorTransitionEvent) ||
      typeof body.transitionId !== 'string' || !IDENTIFIER.test(body.transitionId) ||
      typeof body.evidenceSha256 !== 'string' || !SHA256.test(body.evidenceSha256)) throw new WorkflowControlInputError(400, 'Invalid workflow transition.')
    const result = await orchestrator().transition({ tenantId, taskId, event: body.event as OperatorTransitionEvent, transitionId: body.transitionId, evidenceSha256: body.evidenceSha256 })
    if (!result.accepted) return Response.json({ error: 'Transition is not allowed from the current state.', state: result.state }, { status: 409, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
    return Response.json({ state: result.state, idempotent: result.idempotent, contentRetained: false }, { headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  } catch (error) {
    if (error instanceof WorkflowControlInputError) return Response.json({ error: error.message }, { status: error.status, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
    console.error('[ORCHESTRATION_TRANSITION_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return Response.json({ error: 'Workflow transition could not be committed.' }, { status: 503, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  }
}
