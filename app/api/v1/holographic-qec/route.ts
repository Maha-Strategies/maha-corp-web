import { createHash } from 'node:crypto'
import { HOLOGRAPHIC_QEC_RESEARCH_URL, type HolographicQecJobRequest } from '@/lib/openapi-holographic-qec'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Maha-API-Mode': 'mock' } }) }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }

/** Integration-only contract stub. No compiler execution, quantum layout, or submitted topology is retained. */
export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let payload: unknown; try { payload = await request.json() } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  if (!isRecord(payload) || typeof payload.clientRequestId !== 'string' || payload.clientRequestId.length < 8 || payload.clientRequestId.length > 120) return json({ error: { code: 'invalid_client_request_id', message: 'clientRequestId must be 8–120 characters.' } }, 400)
  if (!isRecord(payload.architecture) || !['superconducting-grid', 'neutral-atom-3d-array', 'ion-trap-bus'].includes(payload.architecture.topology as string) || !Number.isInteger(payload.architecture.qubitCount) || (payload.architecture.qubitCount as number) < 1) return json({ error: { code: 'invalid_architecture', message: 'architecture requires a supported topology and positive integer qubitCount.' } }, 400)
  if (!isRecord(payload.target) || !Number.isInteger(payload.target.codeDistance) || (payload.target.codeDistance as number) < 1 || typeof payload.target.physicalErrorRate !== 'number' || payload.target.physicalErrorRate <= 0 || payload.target.physicalErrorRate > 1 || !Number.isInteger(payload.target.logicalQubitCount) || (payload.target.logicalQubitCount as number) < 1) return json({ error: { code: 'invalid_target', message: 'target requires positive codeDistance and logicalQubitCount plus physicalErrorRate in (0, 1].' } }, 400)
  const input = payload as unknown as HolographicQecJobRequest; const inputHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  return json({ mock: true, message: 'Integration stub only: no QEC layout, threshold estimate, or physical-qubit reduction has been calculated.', jobId: `hqc_${inputHash.slice(0, 32)}`, status: 'queued', clientRequestId: input.clientRequestId, inputHash, acceptedConfiguration: input, compiledTensorLayoutGraphs: [{ id: `layout_${inputHash.slice(0, 16)}`, status: 'mock', description: 'A deterministic identifier only; no graph has been synthesized.' }], boundaryMappingSpec: { status: 'mock', description: 'No boundary mapping has been calculated.' }, citations: [{ claimId: 'hqc-001', url: `${HOLOGRAPHIC_QEC_RESEARCH_URL}#article`, role: 'method-basis', verificationBoundary: 'research-node' }], sourceInputStored: false }, 202)
}
export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
