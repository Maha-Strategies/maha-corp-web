import { createHash } from 'node:crypto'

import { epistemicRecordPath } from '../lib/epistemic-publication.ts'
import { REPAIRED_REVISION_CANARY_RECORDS, REPAIRED_REVISION_CANARY_TARGETS, repairedRevisionCanaryReviewInputs } from '../lib/repaired-revision-canary.ts'

type Json = Record<string, unknown>
const ORIGIN = 'https://www.mahastrategies.com'
const CONFIRMATION = 'RELEASE_2_REPAIRED_REVISIONS'

function object(value: unknown, label: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Json
}

function array(value: unknown, label: string): Json[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value.map((entry, index) => object(entry, `${label}[${index}]`))
}

function token(environment: NodeJS.ProcessEnv, name: 'EPISTEMIC_OPERATIONS_TOKEN' | 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN'): string {
  const value = environment[name]?.trim()
  if (!value || Buffer.byteLength(value) < 32) throw new Error(`${name} must contain at least 32 bytes.`)
  return value
}

async function request(bearer: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${bearer}`)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(`${ORIGIN}${path}`, { ...init, headers, cache: 'no-store', redirect: 'follow' })
  const text = await response.text()
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${text.slice(0, 500)}`)
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: response.status, body }
}

async function ingestAndReview(operationsToken: string) {
  const setDigest = createHash('sha256').update(REPAIRED_REVISION_CANARY_TARGETS.map((target) => target.targetSha256).join('|')).digest('hex')
  await request(operationsToken, '/api/admin/epistemic-ingestion', {
    method: 'POST',
    body: JSON.stringify({ adapterId: 'repaired-revision-canary', idempotencyKey: `repaired-revision-targets:${setDigest}` }),
  })
  const results = []
  for (const decision of repairedRevisionCanaryReviewInputs()) {
    const response = await request(operationsToken, '/api/admin/epistemic-reviews', { method: 'POST', body: JSON.stringify(decision) })
    results.push({ recordId: decision.recordId, scope: decision.scope, status: response.status })
  }
  return results
}

async function publish(releaseToken: string) {
  const workspace = object((await request(releaseToken, '/api/admin/epistemic-releases')).body, 'release workspace')
  const candidates = array(workspace.candidates, 'release candidates')
  const results = []
  for (const target of REPAIRED_REVISION_CANARY_TARGETS) {
    const candidate = candidates.find((entry) => entry.recordId === target.recordId && entry.targetSha256 === target.targetSha256)
    if (!candidate) throw new Error(`${target.recordId}: exact repaired target is absent from release workspace.`)
    const active = candidate.activeRelease ? object(candidate.activeRelease, `${target.recordId} active release`) : null
    if (active?.targetSha256 === target.targetSha256) {
      results.push({ recordId: target.recordId, releaseKind: 'already-current', replayed: true })
      continue
    }
    if (candidate.ready !== true) throw new Error(`${target.recordId}: release gate blocked exact target: ${JSON.stringify(candidate.blockers)}`)
    const common = {
      recordId: target.recordId,
      targetSha256: target.targetSha256,
      canonicalVersion: active ? '1.1.0' : '1.0.0',
      supersedesReleaseId: active ? String(active.releaseId) : null,
      authority: {
        authorityId: 'authority_maha-founder-release',
        displayName: 'Maha Strategies Release Authority',
        role: 'Internal canonical knowledge release authority',
        authorizationBasis: 'The organization owner authorized this exact two-record repaired-revision canary after source-alignment, citation-identity, substantial-page, and internal editorial review gates passed. External endorsement is not claimed.',
        publicAttribution: false,
      },
      publicChangeSummary: active
        ? 'Superseding canonical release binds the exact repaired source and claim revision under the disclosed internal-review tier.'
        : 'Initial canonical release binds the exact repaired source and claim revision under the disclosed internal-review tier.',
      rationale: 'The exact revision passed four scoped internal editorial decisions derived from a record-specific ten-dimension ledger. Publisher conflict is disclosed; external expert review, peer review, independent reproduction, scientific validation, and commercial certification are not claimed.',
    }
    const id = createHash('sha256').update(`${target.recordId}|${target.targetSha256}|repaired-canary-v1`).digest('hex')
    await request(releaseToken, '/api/admin/epistemic-releases', { method: 'POST', body: JSON.stringify({ ...common, operation: 'preview', idempotencyKey: `repaired-canary-preview:${id}` }) })
    await request(releaseToken, '/api/admin/epistemic-releases', { method: 'POST', body: JSON.stringify({ ...common, operation: 'publish', idempotencyKey: `repaired-canary-publish:${id}` }) })
    results.push({ recordId: target.recordId, releaseKind: active ? 'superseding' : 'initial', replayed: false, supersededReleaseId: active ? String(active.releaseId) : null })
  }
  return results
}

async function verify(strict: boolean) {
  const [sitemap, llms, registryResponse] = await Promise.all([
    fetch(`${ORIGIN}/sitemap.xml`, { cache: 'no-store' }).then((response) => response.text()),
    fetch(`${ORIGIN}/llms.txt`, { cache: 'no-store' }).then((response) => response.text()),
    fetch(`${ORIGIN}/knowledge/epistemic-system/releases/registry.json`, { cache: 'no-store' }),
  ])
  const registry = await registryResponse.text()
  const projection = []
  for (const record of REPAIRED_REVISION_CANARY_RECORDS) {
    const target = REPAIRED_REVISION_CANARY_TARGETS.find((entry) => entry.recordId === record.id)!
    const path = epistemicRecordPath(record)
    const response = await fetch(`${ORIGIN}${path}`, { cache: 'no-store' })
    const provenance = await fetch(`${ORIGIN}${path}/provenance.json`, { cache: 'no-store' })
    const missing = []
    if (response.status !== 200) missing.push(`route:${response.status}`)
    if (provenance.status !== 200) missing.push(`provenance:${provenance.status}`)
    if (!sitemap.includes(`${ORIGIN}${path}`)) missing.push('sitemap')
    if (!llms.includes(`${ORIGIN}${path}`)) missing.push('llms')
    if (!registry.includes(target.targetSha256)) missing.push('release-registry-target')
    if (strict && missing.length) throw new Error(`${record.id}: incomplete projection (${missing.join(', ')}).`)
    projection.push({ recordId: record.id, targetSha256: target.targetSha256, path, status: response.status, provenanceStatus: provenance.status, complete: missing.length === 0, missing })
  }
  return projection
}

export async function runRepairedRevisionCanary(environment = process.env, arguments_ = process.argv.slice(2)) {
  const review = arguments_.includes('--review')
  const publishRequested = arguments_.includes('--publish')
  if (publishRequested && !review) throw new Error('--publish requires --review.')
  if (publishRequested && environment.REPAIRED_REVISION_CANARY_CONFIRM !== CONFIRMATION) throw new Error(`REPAIRED_REVISION_CANARY_CONFIRM must equal ${CONFIRMATION}.`)
  const reviewed = review ? await ingestAndReview(token(environment, 'EPISTEMIC_OPERATIONS_TOKEN')) : []
  const released = publishRequested ? await publish(token(environment, 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN')) : []
  const projection = await verify(publishRequested)
  console.log(JSON.stringify({ operation: publishRequested ? 'review-publish-verify' : review ? 'review' : 'verify', targets: REPAIRED_REVISION_CANARY_TARGETS, scopedDecisionsSubmitted: reviewed.length, released, projection, boundary: 'Internal editorial canary only; no external endorsement, independent reproduction, scientific validation, or commercial certification.' }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) runRepairedRevisionCanary().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
