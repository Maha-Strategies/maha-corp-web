import { authorizeWorkflowControl, workflowTenantId, WORKFLOW_CONTROL_RESPONSE_HEADERS } from '@/lib/workflows/control'
import { orchestrationDeploymentConfig } from '@/lib/workflows/deployment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = authorizeWorkflowControl(request)
  if (!auth.ok) return Response.json({ error: auth.status === 503 ? 'Workflow control is unavailable.' : 'Unauthorized.' }, { status: auth.status, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  const tenantId = workflowTenantId(request, auth)
  if (!tenantId) return Response.json({ error: 'Invalid or missing tenant attribution.' }, { status: 400, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
  const deployment = orchestrationDeploymentConfig()
  return Response.json({
    ready: deployment.ready,
    deployment: { mode: deployment.mode, storageProvider: deployment.storageProvider, retentionDays: deployment.retentionDays, tenantId },
    checks: { authentication: deployment.authReady, durableStorage: deployment.storageReady },
    errors: deployment.errors,
    contentRetained: false,
  }, { status: deployment.ready ? 200 : 503, headers: WORKFLOW_CONTROL_RESPONSE_HEADERS })
}
