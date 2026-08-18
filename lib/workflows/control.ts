import { createHash, timingSafeEqual } from 'node:crypto'
import { orchestrationDeploymentConfig, type OrchestrationDeploymentMode } from './deployment.ts'

const TENANT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/

export type WorkflowControlAuthorization =
  | { ok: true; reviewerSha256: string; tenantId: string | null; deploymentMode: OrchestrationDeploymentMode }
  | { ok: false; status: 401 | 503 }

export function authorizeWorkflowControl(request: Request): WorkflowControlAuthorization {
  const deployment = orchestrationDeploymentConfig()
  if (!deployment.authReady) return { ok: false, status: 503 }
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return { ok: false, status: 401 }
  const suppliedSha256 = createHash('sha256').update(header.slice(7), 'utf8').digest('hex')
  const supplied = Buffer.from(suppliedSha256, 'hex')
  const credential = deployment.credentials.find((candidate) => timingSafeEqual(supplied, Buffer.from(candidate.tokenSha256, 'hex')))
  if (!credential) return { ok: false, status: 401 }
  return { ok: true, reviewerSha256: `sha256:${suppliedSha256}`, tenantId: credential.tenantId || null, deploymentMode: deployment.mode }
}

export function workflowTenantId(request: Request, authorization?: WorkflowControlAuthorization): string | null {
  const value = request.headers.get('x-maha-tenant-id')
  const requested = value && TENANT_ID.test(value) ? value : null
  if (authorization?.ok && authorization.tenantId) return requested && requested !== authorization.tenantId ? null : authorization.tenantId
  return requested
}

export async function readBoundedJson(request: Request, maximumBytes = 4096): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new WorkflowControlInputError(415, 'Content-Type must be application/json.')
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maximumBytes) throw new WorkflowControlInputError(413, `Request exceeds ${maximumBytes} bytes.`)
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maximumBytes) throw new WorkflowControlInputError(413, `Request exceeds ${maximumBytes} bytes.`)
  try { return JSON.parse(text) } catch { throw new WorkflowControlInputError(400, 'Invalid JSON.') }
}

export class WorkflowControlInputError extends Error {
  readonly status: 400 | 413 | 415
  constructor(status: 400 | 413 | 415, message: string) { super(message); this.status = status }
}

export const WORKFLOW_CONTROL_RESPONSE_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
