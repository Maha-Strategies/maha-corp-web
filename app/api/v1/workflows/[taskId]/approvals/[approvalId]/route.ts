import { createHash, timingSafeEqual } from 'node:crypto'
import { UpstashApprovalStore } from '@/lib/workflows/approvals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TASK_ID = /^workflow-task-[a-f0-9]{32}$/
const APPROVAL_ID = /^approval-[a-f0-9]{64}$/
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/
const REASON_CODE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{2,79}$/

function authorize(request: Request): { ok: true; reviewerSha256: string } | { ok: false; status: 401 | 503 } {
  const configured = process.env.WORKFLOW_CONTROL_TOKEN
  if (!configured || Buffer.byteLength(configured, 'utf8') < 32) return { ok: false, status: 503 }
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return { ok: false, status: 401 }
  const supplied = Buffer.from(header.slice(7)); const expected = Buffer.from(configured)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return { ok: false, status: 401 }
  return { ok: true, reviewerSha256: `sha256:${createHash('sha256').update(configured).digest('hex')}` }
}

export async function POST(request: Request, context: { params: Promise<{ taskId: string; approvalId: string }> }) {
  const auth = authorize(request)
  if (!auth.ok) return Response.json({ error: auth.status === 503 ? 'Workflow approval control is unavailable.' : 'Unauthorized.' }, { status: auth.status, headers: { 'Cache-Control': 'no-store' } })
  const tenantId = request.headers.get('x-maha-tenant-id')
  const { taskId, approvalId } = await context.params
  if (!tenantId || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(tenantId) || !TASK_ID.test(taskId) || !APPROVAL_ID.test(approvalId)) return Response.json({ error: 'Invalid approval target.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return Response.json({ error: 'Content-Type must be application/json.' }, { status: 415, headers: { 'Cache-Control': 'no-store' } })
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > 2048) return Response.json({ error: 'Approval decision exceeds 2 KB.' }, { status: 413 })
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > 2048) return Response.json({ error: 'Approval decision exceeds 2 KB.' }, { status: 413 })
  let value: unknown
  try { value = JSON.parse(text) } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Response.json({ error: 'Invalid approval decision.' }, { status: 400 })
  const body = value as Record<string, unknown>
  if (Object.keys(body).some((key) => !['decision', 'reasonCode', 'idempotencyKey'].includes(key)) || (body.decision !== 'approve' && body.decision !== 'deny') || typeof body.reasonCode !== 'string' || !REASON_CODE.test(body.reasonCode) || typeof body.idempotencyKey !== 'string' || !IDEMPOTENCY_KEY.test(body.idempotencyKey)) return Response.json({ error: 'Invalid approval decision.' }, { status: 400 })
  try {
    const result = await new UpstashApprovalStore().decide({ tenantId, taskId, approvalId, decision: body.decision, reasonCode: body.reasonCode, idempotencyKey: body.idempotencyKey, reviewerSha256: auth.reviewerSha256 })
    if (!result.record) return Response.json({ error: 'Approval request not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    if (!result.accepted) return Response.json({ error: 'Approval request is no longer pending.', status: result.record.status }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
    return Response.json({ approvalId, taskId, status: result.record.status, expiresAt: result.record.expiresAt, idempotent: result.idempotent }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[WORKFLOW_APPROVAL_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return Response.json({ error: 'Workflow approval could not be committed.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
