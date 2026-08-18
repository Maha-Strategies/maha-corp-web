import { UpstashApprovalStore } from '@/lib/workflows/approvals'
import { authorizeWorkflowControl, readBoundedJson, workflowTenantId, WorkflowControlInputError, WORKFLOW_CONTROL_RESPONSE_HEADERS } from '@/lib/workflows/control'
import { WorkflowOrchestrator } from '@/lib/workflows/orchestration'
import { UpstashRecoveryStore } from '@/lib/workflows/recovery'
import { UpstashWorkflowTaskStore } from '@/lib/workflows/task-state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TASK_ID = /^workflow-task-[a-f0-9]{32}$/
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/
const SHA256 = /^sha256:[a-f0-9]{64}$/

function orchestrator() { return new WorkflowOrchestrator(new UpstashWorkflowTaskStore(), new UpstashApprovalStore(), new UpstashRecoveryStore()) }

function authorize(request: Request) {
  const auth = authorizeWorkflowControl(request)
  if (!auth.ok) return Response.json({ error: auth.status === 503 ? 'Workflow control is unavailable.' : 'Unauthorized.' }, { status: auth.status, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  const tenantId = workflowTenantId(request, auth)
  if (!tenantId) return Response.json({ error: 'Invalid or missing X-Maha-Tenant-Id.' }, { status: 400, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  return tenantId
}

export async function GET(request: Request) {
  const tenantId = authorize(request)
  if (tenantId instanceof Response) return tenantId
  const rawLimit = new URL(request.url).searchParams.get('limit')
  const limit = rawLimit === null ? 50 : Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return Response.json({ error: 'limit must be an integer between 1 and 100.' }, { status: 400, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  try {
    const tasks = await orchestrator().list(tenantId, limit)
    return Response.json({ tenantId, tasks, contentRetained: false }, { headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  } catch (error) {
    console.error('[ORCHESTRATION_LIST_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return Response.json({ error: 'Workflow tasks could not be read.' }, { status: 503, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  }
}

export async function POST(request: Request) {
  const tenantId = authorize(request)
  if (tenantId instanceof Response) return tenantId
  try {
    const value = await readBoundedJson(request)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new WorkflowControlInputError(400, 'Invalid workflow task request.')
    const body = value as Record<string, unknown>
    if (Object.keys(body).some((key) => !['taskId', 'transitionId', 'evidenceSha256'].includes(key)) ||
      (body.taskId !== undefined && (typeof body.taskId !== 'string' || !TASK_ID.test(body.taskId))) ||
      typeof body.transitionId !== 'string' || !IDENTIFIER.test(body.transitionId) ||
      typeof body.evidenceSha256 !== 'string' || !SHA256.test(body.evidenceSha256)) throw new WorkflowControlInputError(400, 'Invalid workflow task request.')
    const result = await orchestrator().create({ tenantId, taskId: body.taskId as string | undefined, transitionId: body.transitionId, evidenceSha256: body.evidenceSha256 })
    if (!result.accepted) return Response.json({ error: 'Workflow task already exists.', taskId: result.taskId, state: result.state }, { status: 409, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
    return Response.json({ taskId: result.taskId, state: result.state, idempotent: result.idempotent, contentRetained: false }, { status: 201, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  } catch (error) {
    if (error instanceof WorkflowControlInputError) return Response.json({ error: error.message }, { status: error.status, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
    console.error('[ORCHESTRATION_CREATE_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return Response.json({ error: 'Workflow task could not be created.' }, { status: 503, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  }
}
