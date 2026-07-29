import { createHash } from 'node:crypto'
import type { GeometricAiJobRequest } from '@/lib/openapi-geometric'
import { GEOMETRIC_AI_RESEARCH_URL } from '@/lib/openapi-geometric'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Maha-API-Mode': 'mock' } }) }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }

/** Integration-only contract stub. It validates metadata, queues no compute, and retains no source input. */
export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let payload: unknown
  try { payload = await request.json() } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  if (!isRecord(payload) || typeof payload.clientRequestId !== 'string' || payload.clientRequestId.length < 8 || payload.clientRequestId.length > 120) return json({ error: { code: 'invalid_client_request_id', message: 'clientRequestId must be 8–120 characters.' } }, 400)
  if (!isRecord(payload.manifold) || typeof payload.manifold.name !== 'string' || !Number.isInteger(payload.manifold.dimension) || (payload.manifold.dimension as number) < 1) return json({ error: { code: 'invalid_manifold', message: 'manifold requires a name and positive integer dimension.' } }, 400)
  if (!isRecord(payload.symmetry) || !['SO(3)', 'SE(3)', 'SU(N)'].includes(payload.symmetry.group as string) || typeof payload.symmetry.representation !== 'string' || !payload.symmetry.representation) return json({ error: { code: 'invalid_symmetry', message: 'symmetry requires SO(3), SE(3), or SU(N), plus a representation.' } }, 400)
  if (!Array.isArray(payload.boundaryConditions) || !payload.boundaryConditions.every((condition) => isRecord(condition) && ['dirichlet', 'neumann', 'periodic', 'mixed'].includes(condition.kind as string) && typeof condition.region === 'string' && typeof condition.expression === 'string')) return json({ error: { code: 'invalid_boundary_conditions', message: 'boundaryConditions must contain declared, typed conditions.' } }, 400)
  if (!isRecord(payload.mesh) || !['point-cloud', 'triangular-surface', 'tetrahedral-volume', 'structured-grid'].includes(payload.mesh.kind as string) || !Number.isInteger(payload.mesh.nodeCount) || (payload.mesh.nodeCount as number) < 1 || ![2, 3].includes(payload.mesh.dimension as number)) return json({ error: { code: 'invalid_mesh', message: 'mesh requires a supported topology, positive nodeCount, and dimension 2 or 3.' } }, 400)
  const input = payload as unknown as GeometricAiJobRequest
  const inputHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  return json({ mock: true, message: 'Integration stub only: no geometry model has run and no physical-performance claim is implied.', jobId: `gai_${inputHash.slice(0, 32)}`, status: 'queued', clientRequestId: input.clientRequestId, inputHash, acceptedConfiguration: { manifold: input.manifold, symmetry: input.symmetry, boundaryConditionCount: input.boundaryConditions.length, mesh: input.mesh }, citations: [{ claimId: 'gai-001', url: `${GEOMETRIC_AI_RESEARCH_URL}#claims`, role: 'method-basis', verificationBoundary: 'research-node' }], sourceInputStored: false }, 202)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
