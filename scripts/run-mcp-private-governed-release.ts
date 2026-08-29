import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'

import {
  MCP_PRIVATE_CANARY_ADAPTER_ID,
  MCP_PRIVATE_CANARY_RECORD,
  MCP_PRIVATE_CANARY_TARGET_SHA256,
  mcpPrivateCanaryReviewInputs,
} from '../lib/mcp-private-canary-release.ts'

type Json = Record<string, unknown>

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function object(value: unknown, label: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Json
}

const base = new URL(required('CABEZON_PREVIEW_BASE_URL'))
if (base.protocol !== 'https:' || !base.hostname.endsWith('.vercel.app') || base.pathname !== '/') throw new Error('The governed release target must be an HTTPS Vercel Preview origin.')
const operationsToken = required('EPISTEMIC_OPERATIONS_TOKEN')
const releaseToken = required('EPISTEMIC_RELEASE_AUTHORITY_TOKEN')
if (operationsToken === releaseToken) throw new Error('Operations and release-authority tokens must be distinct.')
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()

async function request(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${token}`)
  if (bypass) headers.set('x-vercel-protection-bypass', bypass)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(new URL(path, base), { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(15_000) })
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${text.slice(0, 500)}`)
  return { status: response.status, body }
}

const ingestion = await request('/api/admin/epistemic-ingestion', operationsToken, {
  method: 'POST',
  body: JSON.stringify({ adapterId: MCP_PRIVATE_CANARY_ADAPTER_ID, idempotencyKey: `mcp-private-canary-ingestion:${MCP_PRIVATE_CANARY_TARGET_SHA256}` }),
})

const reviews = []
for (const decision of mcpPrivateCanaryReviewInputs()) {
  const result = await request('/api/admin/epistemic-reviews', operationsToken, { method: 'POST', body: JSON.stringify(decision) })
  const review = object(object(result.body, 'review response').review, 'review')
  if (review.decision !== 'approve' || review.targetSha256 !== MCP_PRIVATE_CANARY_TARGET_SHA256) throw new Error(`Scoped review ${decision.scope} did not approve the exact target.`)
  reviews.push({ scope: decision.scope, reviewId: review.reviewId, reviewSha256: review.reviewSha256 })
}

const workspace = object((await request('/api/admin/epistemic-releases', releaseToken)).body, 'release workspace')
const candidates = Array.isArray(workspace.candidates) ? workspace.candidates.map((entry, index) => object(entry, `candidate[${index}]`)) : []
const candidate = candidates.find((entry) => entry.recordId === MCP_PRIVATE_CANARY_RECORD.id && entry.targetSha256 === MCP_PRIVATE_CANARY_TARGET_SHA256)
if (!candidate || candidate.ready !== true || candidate.activeRelease !== null) throw new Error(`Synthetic exact target is not ready for an initial release: ${JSON.stringify(candidate?.blockers ?? ['missing'])}`)

const common = {
  recordId: MCP_PRIVATE_CANARY_RECORD.id,
  targetSha256: MCP_PRIVATE_CANARY_TARGET_SHA256,
  canonicalVersion: 'private-canary-1.0.0',
  supersedesReleaseId: null,
  authority: {
    authorityId: 'authority_private-preview-canary',
    displayName: 'Maha private Preview canary authority',
    role: 'Synthetic Preview-only release authority',
    authorizationBasis: 'The owner explicitly authorized one fully governed, clearly labeled synthetic canonical release solely inside a new ephemeral Preview branch.',
    publicAttribution: false,
  },
  publicChangeSummary: 'Synthetic Preview-only canonical release for the private CABEZON and licensed MCP lifecycle canary.',
  rationale: 'One synthetic record passed four exact-hash internal-editorial scope decisions. This release exists only in the ephemeral Preview branch and claims no Production, scientific, external-review or commercial status.',
}
const key = createHash('sha256').update(`${MCP_PRIVATE_CANARY_RECORD.id}|${MCP_PRIVATE_CANARY_TARGET_SHA256}|fully-governed-preview-v1`).digest('hex')
await request('/api/admin/epistemic-releases', releaseToken, { method: 'POST', body: JSON.stringify({ ...common, operation: 'preview', idempotencyKey: `mcp-private-release-preview:${key}` }) })
const published = object((await request('/api/admin/epistemic-releases', releaseToken, { method: 'POST', body: JSON.stringify({ ...common, operation: 'publish', idempotencyKey: `mcp-private-release-publish:${key}` }) })).body, 'publish response')
const release = object(published.release, 'release')
if (release.recordId !== MCP_PRIVATE_CANARY_RECORD.id || release.targetSha256 !== MCP_PRIVATE_CANARY_TARGET_SHA256 || release.releaseKind !== 'initial') throw new Error('Published release does not bind the governed synthetic target.')

const registryResponse = await fetch(new URL('/knowledge/epistemic-system/releases/registry.json', base), { headers: bypass ? { 'x-vercel-protection-bypass': bypass } : {}, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000) })
const registry = object(await registryResponse.json(), 'release registry')
const registryReleases = Array.isArray(registry.releases) ? registry.releases.map((entry, index) => object(entry, `registry release[${index}]`)) : []
if (!registryResponse.ok || !registryReleases.some((entry) => entry.releaseId === release.releaseId && entry.status === 'active')) throw new Error('Synthetic governed release is absent from the private registry.')

const baseEvidence = {
  schemaVersion: 'maha-mcp-private-governed-release-evidence/1.0',
  synthetic: true,
  previewOnly: true,
  recordId: MCP_PRIVATE_CANARY_RECORD.id,
  targetSha256: MCP_PRIVATE_CANARY_TARGET_SHA256,
  ingestionStatus: ingestion.status,
  scopedReviewCount: reviews.length,
  scopes: reviews.map((entry) => entry.scope).sort(),
  releaseId: release.releaseId,
  releaseSha256: release.releaseSha256,
  canonicalPath: release.canonicalPath,
  assuranceTier: release.assuranceTier,
  releaseKind: release.releaseKind,
  authoritySeparatedFromOperations: true,
  productionMutation: false,
  externalReviewClaimed: false,
  scientificValidationClaimed: false,
  commercialTransactionClaimed: false,
  secretsIncluded: false,
}
const evidence = { ...baseEvidence, evidenceSha256: `sha256:${createHash('sha256').update(JSON.stringify(baseEvidence)).digest('hex')}` }
const outputPath = required('MCP_GOVERNED_RELEASE_EVIDENCE')
await mkdir(new URL('./', `file://${outputPath}`), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
process.stdout.write(`${JSON.stringify(evidence)}\n`)
