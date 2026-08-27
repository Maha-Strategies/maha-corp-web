import { createHash } from 'node:crypto'

import { epistemicRecordPath } from '../lib/epistemic-publication.ts'
import { BATCH_2_INTERNAL_REVIEW_CANARY_IDS, BATCH_2_INTERNAL_REVIEW_PACKETS } from '../lib/substantial-internal-review-batch-2.ts'
import { canaryInternalReviewInputs } from '../lib/substantial-internal-review-canary.ts'

type Json = Record<string, unknown>
const DEFAULT_BASE_URL = 'https://www.mahastrategies.com'
const CONFIRMATION = 'RELEASE_5_BATCH2_INTERNAL_REVIEW_CANARIES'

function object(value: unknown, label: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Json
}

function array(value: unknown, label: string): Json[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value.map((entry, index) => object(entry, `${label}[${index}]`))
}

function baseUrl(environment: NodeJS.ProcessEnv): string {
  const value = (environment.PRODUCTION_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  if (!/(^|\.)mahastrategies\.com$/.test(new URL(value).host)) throw new Error(`Refusing non-production host ${value}.`)
  return value
}

function token(environment: NodeJS.ProcessEnv, name: 'EPISTEMIC_OPERATIONS_TOKEN' | 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN'): string {
  const value = environment[name]?.trim()
  if (!value || Buffer.byteLength(value, 'utf8') < 32) throw new Error(`${name} must contain at least 32 bytes.`)
  return value
}

async function request(origin: string, bearer: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${bearer}`)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(`${origin}${path}`, { redirect: 'follow', cache: 'no-store', ...init, headers })
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${text}`)
  return { body, status: response.status, text }
}

async function submitReviews(origin: string, operationsToken: string) {
  const decisions = canaryInternalReviewInputs()
  const results = []
  for (const decision of decisions) {
    const result = await request(origin, operationsToken, '/api/admin/epistemic-reviews', { method: 'POST', body: JSON.stringify(decision) })
    results.push({ recordId: decision.recordId, scope: decision.scope, status: result.status })
  }
  return results
}

function authority() {
  return {
    authorityId: 'authority_maha-founder-release',
    displayName: 'Maha Strategies Release Authority',
    role: 'Internal canonical knowledge release authority',
    authorizationBasis: 'The organization owner explicitly authorized the Batch 2 internal-review tier and this five-record canary after record-specific exact-revision review. External expert endorsement is neither claimed nor required for this labelled tier.',
    publicAttribution: false,
  }
}

async function publishCanary(origin: string, releaseToken: string) {
  const workspace = object((await request(origin, releaseToken, '/api/admin/epistemic-releases')).body, 'release workspace')
  const candidates = array(workspace.candidates, 'release candidates')
  const results = []
  for (const recordId of BATCH_2_INTERNAL_REVIEW_CANARY_IDS) {
    const packet = BATCH_2_INTERNAL_REVIEW_PACKETS.find((entry) => entry.recordId === recordId)!
    const candidate = candidates.find((entry) => entry.recordId === recordId && entry.targetSha256 === packet.targetSha256)
    if (!candidate) throw new Error(`${recordId}: exact review target is absent from the release workspace.`)
    const active = candidate.activeRelease ? object(candidate.activeRelease, `${recordId} active release`) : null
    if (active?.targetSha256 === packet.targetSha256) {
      results.push({ recordId, replayed: true, releaseKind: 'already-current' })
      continue
    }
    if (candidate.ready !== true) throw new Error(`${recordId}: release gate blocked the reviewed target: ${JSON.stringify(candidate.blockers)}`)
    const common = {
      recordId,
      targetSha256: packet.targetSha256,
      canonicalVersion: active ? '1.1.0' : '1.0.0',
      supersedesReleaseId: active ? String(active.releaseId) : null,
      authority: authority(),
      publicChangeSummary: active
        ? 'Superseding canonical release binds the repaired source mapping under the disclosed internal-review tier.'
        : 'Initial canonical publication under the disclosed Batch 2 internal-review tier.',
      rationale: `The exact target passed a record-specific internal editorial checklist across source fidelity, domain fidelity, boundary adequacy, and rights and locator. Publisher conflict is disclosed; no external expert endorsement, consensus, scientific validation, or independent reproduction is claimed. Packet ${packet.packetDigest}.`,
    }
    const key = createHash('sha256').update(`${recordId}|${packet.targetSha256}|internal-review-canary-v1`).digest('hex')
    await request(origin, releaseToken, '/api/admin/epistemic-releases', { method: 'POST', body: JSON.stringify({ ...common, operation: 'preview', idempotencyKey: `batch2-internal-preview:${key}` }) })
    await request(origin, releaseToken, '/api/admin/epistemic-releases', { method: 'POST', body: JSON.stringify({ ...common, operation: 'publish', idempotencyKey: `batch2-internal-publish:${key}` }) })
    results.push({ recordId, replayed: false, releaseKind: active ? 'superseding' : 'initial' })
  }
  return results
}

async function verifyProjection(origin: string) {
  const [sitemap, llms] = await Promise.all([fetch(`${origin}/sitemap.xml`, { cache: 'no-store' }).then((response) => response.text()), fetch(`${origin}/llms.txt`, { cache: 'no-store' }).then((response) => response.text())])
  const results = []
  for (const recordId of BATCH_2_INTERNAL_REVIEW_CANARY_IDS) {
    const packet = BATCH_2_INTERNAL_REVIEW_PACKETS.find((entry) => entry.recordId === recordId)!
    const record = (await import('../lib/epistemic-pilots.ts')).EPISTEMIC_RECORDS.find((entry) => entry.id === recordId)!
    const path = epistemicRecordPath(record)
    const response = await fetch(`${origin}${path}`, { cache: 'no-store' })
    const text = await response.text()
    const valid = response.status === 200
      && text.includes('Substantial reference')
      && text.includes('internal-editorial')
      && text.includes('No external reviewer participated')
      && sitemap.includes(`${origin}${path}`)
      && llms.includes(`${origin}${path}`)
    if (!valid) throw new Error(`${packet.recordId}: production projection is incomplete at ${path} (${response.status}).`)
    results.push({ recordId, path, status: response.status })
  }
  return results
}

export async function runSubstantialInternalReviewCanary(environment = process.env, arguments_ = process.argv.slice(2)) {
  const review = arguments_.includes('--review')
  const publish = arguments_.includes('--publish')
  const verify = arguments_.includes('--verify') || publish
  if (publish && !review) throw new Error('--publish requires --review so the exact decisions are present before release.')
  if (publish && environment.BATCH2_INTERNAL_CANARY_CONFIRM !== CONFIRMATION) throw new Error(`BATCH2_INTERNAL_CANARY_CONFIRM must equal ${CONFIRMATION}.`)
  const origin = baseUrl(environment)
  const reviewed = review ? await submitReviews(origin, token(environment, 'EPISTEMIC_OPERATIONS_TOKEN')) : []
  const released = publish ? await publishCanary(origin, token(environment, 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN')) : []
  const projection = verify ? await verifyProjection(origin) : []
  console.log(JSON.stringify({ operation: publish ? 'review-publish-verify' : review ? 'review' : 'verify', reviewed: reviewed.length, released, projection, boundary: 'Internal editorial review is disclosed and exact-revision scoped. External expert review remains optional and is not claimed.' }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) runSubstantialInternalReviewCanary().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })

