import { createHash } from 'node:crypto'

const baseUrl = process.env.MCP_EVIDENCE_CANARY_BASE_URL?.replace(/\/$/, '')
const credential = process.env.MCP_EVIDENCE_CANARY_CREDENTIAL
const releaseId = process.env.MCP_EVIDENCE_CANARY_RELEASE_ID
const canonicalPath = process.env.MCP_EVIDENCE_CANARY_CANONICAL_PATH

if (!baseUrl || !credential || !releaseId || !canonicalPath) {
  throw new Error('MCP_EVIDENCE_CANARY_BASE_URL, MCP_EVIDENCE_CANARY_CREDENTIAL, MCP_EVIDENCE_CANARY_RELEASE_ID, and MCP_EVIDENCE_CANARY_CANONICAL_PATH are required.')
}
if (!/^https:\/\//.test(baseUrl)) throw new Error('The private canary requires an HTTPS base URL.')
if (!/^epirelease_[a-f0-9]{32}$/.test(releaseId)) throw new Error('MCP_EVIDENCE_CANARY_RELEASE_ID is invalid.')
if (!/^\/knowledge\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/.test(canonicalPath)) throw new Error('MCP_EVIDENCE_CANARY_CANONICAL_PATH is invalid.')

const endpoint = `${baseUrl}/api/mcp/evidence`
const clientRequestId = `private-canary-${releaseId.slice(-16)}`
const credentialFingerprint = `sha256:${createHash('sha256').update(credential).digest('hex')}`

async function rpc(id: number, method: string, params?: object) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credential}`,
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-11-25',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }),
    signal: AbortSignal.timeout(10_000),
  })
  const body = await response.json() as Record<string, unknown>
  return { status: response.status, body }
}

const initialized = await rpc(1, 'initialize')
if (initialized.status !== 200 || !(initialized.body.result as { serverInfo?: { name?: string } } | undefined)?.serverInfo?.name) throw new Error('Initialize failed.')

const listed = await rpc(2, 'tools/list')
const tools = (listed.body.result as { tools?: Array<{ name?: string }> } | undefined)?.tools ?? []
if (listed.status !== 200 || tools.length !== 1 || tools[0]?.name !== 'evidence.retrieve_released_record') throw new Error('Licensed evidence tool discovery failed.')

const parameters = {
  name: 'evidence.retrieve_released_record',
  arguments: { clientRequestId, selector: { releaseId } },
}
const first = await rpc(3, 'tools/call', parameters)
const firstResult = first.body.result as { structuredContent?: Record<string, unknown>; _meta?: { idempotentReplay?: boolean } } | undefined
const firstProjection = firstResult?.structuredContent
if (first.status !== 200 || !firstProjection || (firstProjection.release as { releaseId?: string } | undefined)?.releaseId !== releaseId) throw new Error('First licensed retrieval failed.')

const replay = await rpc(4, 'tools/call', parameters)
const replayResult = replay.body.result as { structuredContent?: Record<string, unknown>; _meta?: { idempotentReplay?: boolean } } | undefined
if (replay.status !== 200 || replayResult?._meta?.idempotentReplay !== true) throw new Error('Replay was not identified as idempotent.')
if (JSON.stringify(replayResult.structuredContent) !== JSON.stringify(firstProjection)) throw new Error('Replay changed the licensed evidence projection.')

const substitution = await rpc(5, 'tools/call', {
  name: 'evidence.retrieve_released_record',
  arguments: { clientRequestId, selector: { canonicalPath } },
})
if ((substitution.body.error as { data?: { reason?: string } } | undefined)?.data?.reason !== 'idempotency_conflict') throw new Error('Selector substitution did not fail closed.')

const unavailable = await rpc(6, 'tools/call', {
  name: 'evidence.retrieve_released_record',
  arguments: { clientRequestId: `${clientRequestId}-missing`, selector: { releaseId: 'epirelease_00000000000000000000000000000000' } },
})
if ((unavailable.body.error as { data?: { reason?: string } } | undefined)?.data?.reason !== 'release_unavailable') throw new Error('Unavailable release did not fail closed.')

const output = {
  schemaVersion: 'maha-mcp-evidence-private-canary/1.0',
  endpoint,
  credentialFingerprint,
  releaseId,
  releaseSha256: (firstProjection.release as { releaseSha256?: string }).releaseSha256,
  executionId: (firstProjection.execution as { executionId?: string }).executionId,
  projectionSha256: `sha256:${createHash('sha256').update(JSON.stringify(firstProjection)).digest('hex')}`,
  checks: {
    initialize: 'pass',
    toolDiscovery: 'pass',
    firstRetrieval: 'pass',
    byteIdenticalReplay: 'pass',
    selectorSubstitution: 'blocked',
    unavailableRelease: 'blocked',
  },
  secretsIncluded: false,
  publicDiscoveryAuthorized: false,
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
