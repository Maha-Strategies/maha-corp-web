import { createHash } from 'node:crypto'

import { epistemicRecordPath } from '../lib/epistemic-publication.ts'
import { BATCH_2_INTERNAL_REVIEW_PACKETS } from '../lib/substantial-internal-review-batch-2.ts'
import {
  BATCH_2_REMAINDER_APPROVED_IDS,
  BATCH_2_REMAINDER_WITHHELD_IDS,
  remainderInternalReviewInputs,
  remainderReview,
} from '../lib/substantial-internal-review-remainder.ts'

type Json = Record<string, unknown>
const DEFAULT_BASE_URL = 'https://www.mahastrategies.com'
const CONFIRMATION = 'RELEASE_APPROVED_BATCH2_INTERNAL_REVIEW_REMAINDER'

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

/** Reads a token without ever echoing it. Only its presence and length are checked. */
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
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${text.slice(0, 400)}`)
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { body, status: response.status }
}

/** Replays the frozen 27-record target batch. The key is the target set, so a replay cannot cross digests. */
async function ingestTargets(origin: string, operationsToken: string) {
  const targetKey = createHash('sha256').update(BATCH_2_INTERNAL_REVIEW_PACKETS.map((packet) => packet.targetSha256).join('|')).digest('hex')
  await request(origin, operationsToken, '/api/admin/epistemic-ingestion', {
    method: 'POST',
    body: JSON.stringify({ adapterId: 'substantial-batch-2-internal-review', idempotencyKey: `batch2-internal-targets:${targetKey}` }),
  })
  return { targets: BATCH_2_INTERNAL_REVIEW_PACKETS.length, replayKey: `sha256:${targetKey}` }
}

async function submitReviews(origin: string, operationsToken: string) {
  const decisions = remainderInternalReviewInputs()
  const approved = new Set(BATCH_2_REMAINDER_APPROVED_IDS)
  for (const decision of decisions) {
    if (!approved.has(decision.recordId)) throw new Error(`${decision.recordId}: only approved remainder records may submit review decisions.`)
  }
  const results: { recordId: string; scope: string; status: number }[] = []
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
    authorizationBasis: 'The organization owner authorized the Batch 2 internal-review tier. Each record in this operation passed a record-specific exact-revision editorial checklist across all twelve criteria. External expert endorsement is neither claimed nor required for this labelled tier.',
    publicAttribution: false,
  }
}

async function publishApproved(origin: string, releaseToken: string) {
  const workspace = object((await request(origin, releaseToken, '/api/admin/epistemic-releases')).body, 'release workspace')
  const candidates = array(workspace.candidates, 'release candidates')
  const results: { recordId: string; releaseKind: string; replayed: boolean }[] = []

  for (const recordId of BATCH_2_REMAINDER_APPROVED_IDS) {
    const review = remainderReview(recordId)!
    if (review.disposition !== 'approved') throw new Error(`${recordId}: refusing to publish a non-approved record.`)
    const packet = BATCH_2_INTERNAL_REVIEW_PACKETS.find((entry) => entry.recordId === recordId)!
    const candidate = candidates.find((entry) => entry.recordId === recordId && entry.targetSha256 === packet.targetSha256)
    if (!candidate) throw new Error(`${recordId}: the exact reviewed target is absent from the release workspace.`)

    const active = candidate.activeRelease ? object(candidate.activeRelease, `${recordId} active release`) : null
    if (active?.targetSha256 === packet.targetSha256) {
      results.push({ recordId, releaseKind: 'already-current', replayed: true })
      continue
    }
    // A superseding release requires a genuine prior active release, and an initial release requires none.
    if (review.releaseKind === 'superseding' && !active) throw new Error(`${recordId}: reviewed as superseding but no active prior release exists.`)
    if (review.releaseKind === 'initial' && active) throw new Error(`${recordId}: reviewed as an initial release but an active release already exists.`)
    if (candidate.ready !== true) throw new Error(`${recordId}: the release gate blocked the reviewed target: ${JSON.stringify(candidate.blockers)}`)

    const common = {
      recordId,
      targetSha256: packet.targetSha256,
      canonicalVersion: active ? '1.1.0' : '1.0.0',
      supersedesReleaseId: active ? String(active.releaseId) : null,
      authority: authority(),
      publicChangeSummary: active
        ? 'Superseding canonical release binds the re-audited source mapping under the disclosed internal-review tier.'
        : 'Initial canonical publication under the disclosed Batch 2 internal-review tier.',
      rationale: `The exact target passed a record-specific internal editorial checklist across source fidelity, domain fidelity, boundary adequacy, and rights and locator. Publisher conflict is disclosed; no external expert endorsement, peer review, consensus, scientific validation, or independent reproduction is claimed. Packet ${packet.packetDigest}.`,
    }
    const key = createHash('sha256').update(`${recordId}|${packet.targetSha256}|internal-review-remainder-v1`).digest('hex')
    await request(origin, releaseToken, '/api/admin/epistemic-releases', { method: 'POST', body: JSON.stringify({ ...common, operation: 'preview', idempotencyKey: `batch2-remainder-preview:${key}` }) })
    await request(origin, releaseToken, '/api/admin/epistemic-releases', { method: 'POST', body: JSON.stringify({ ...common, operation: 'publish', idempotencyKey: `batch2-remainder-publish:${key}` }) })
    results.push({ recordId, releaseKind: active ? 'superseding' : 'initial', replayed: false })
  }
  return results
}

/**
 * `strict` is true only after a publish in the same run. A standalone verify is
 * a pre-flight: it reports what is and is not yet live instead of aborting on
 * the first unreleased record, because verify-only is meant to be run *before*
 * the release. A withheld record serving substantial material is always fatal.
 */
async function verifyProjection(origin: string, strict: boolean) {
  const { EPISTEMIC_RECORDS } = await import('../lib/epistemic-pilots.ts')
  const [sitemap, llms] = await Promise.all([
    fetch(`${origin}/sitemap.xml`, { cache: 'no-store' }).then((response) => response.text()),
    fetch(`${origin}/llms.txt`, { cache: 'no-store' }).then((response) => response.text()),
  ])

  const released: { recordId: string; path: string; status: number; complete: boolean; missing: string[] }[] = []
  for (const recordId of BATCH_2_REMAINDER_APPROVED_IDS) {
    const record = EPISTEMIC_RECORDS.find((entry) => entry.id === recordId)!
    const path = epistemicRecordPath(record)
    const response = await fetch(`${origin}${path}`, { cache: 'no-store' })
    const text = response.status === 200 ? await response.text() : ''
    const missing: string[] = []
    if (response.status !== 200) missing.push(`status ${response.status}`)
    if (!text.includes('Substantial reference')) missing.push('substantial source-bound content')
    if (!text.includes('internal-editorial')) missing.push('assurance label')
    if (!text.includes('No external reviewer participated')) missing.push('no-external-review disclosure')
    if (!text.includes(`<link rel="canonical" href="${origin}${path}"`)) missing.push('canonical metadata')
    if (!/"@type"\s*:\s*"TechArticle"/.test(text)) missing.push('TechArticle JSON-LD')
    if (!sitemap.includes(`${origin}${path}`)) missing.push('sitemap membership')
    if (!llms.includes(`${origin}${path}`)) missing.push('llms.txt membership')
    if (strict && missing.length > 0) throw new Error(`${recordId}: production projection incomplete at ${path} (${missing.join('; ')}).`)
    released.push({ recordId, path, status: response.status, complete: missing.length === 0, missing })
  }

  // A withheld record may legitimately have an ordinary canonical page. What it
  // must never have is Batch 2 substantial material.
  const withheld: { recordId: string; path: string; status: number; substantialMaterial: boolean }[] = []
  for (const recordId of BATCH_2_REMAINDER_WITHHELD_IDS) {
    const record = EPISTEMIC_RECORDS.find((entry) => entry.id === recordId)!
    const path = epistemicRecordPath(record)
    const response = await fetch(`${origin}${path}`, { cache: 'no-store' })
    const text = response.status === 200 ? await response.text() : ''
    const substantialMaterial = text.includes('Substantial reference')
    if (substantialMaterial) throw new Error(`${recordId}: a withheld record is serving Batch 2 substantial material at ${path}.`)
    withheld.push({ recordId, path, status: response.status, substantialMaterial })
  }
  return { released, withheld }
}

export async function runSubstantialInternalReviewRemainder(environment = process.env, arguments_ = process.argv.slice(2)) {
  const review = arguments_.includes('--review')
  const publish = arguments_.includes('--publish')
  const verify = arguments_.includes('--verify') || publish
  if (publish && !review) throw new Error('--publish requires --review so the exact decisions exist before release.')
  if (publish && environment.BATCH2_INTERNAL_REMAINDER_CONFIRM !== CONFIRMATION) {
    throw new Error(`BATCH2_INTERNAL_REMAINDER_CONFIRM must equal ${CONFIRMATION}.`)
  }
  const origin = baseUrl(environment)

  const ingested = review ? await ingestTargets(origin, token(environment, 'EPISTEMIC_OPERATIONS_TOKEN')) : null
  const reviewed = review ? await submitReviews(origin, token(environment, 'EPISTEMIC_OPERATIONS_TOKEN')) : []
  const released = publish ? await publishApproved(origin, token(environment, 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN')) : []
  const projection = verify ? await verifyProjection(origin, publish) : null

  console.log(JSON.stringify({
    operation: publish ? 'review-publish-verify' : review ? 'review' : 'verify',
    ingested,
    approved: BATCH_2_REMAINDER_APPROVED_IDS.length,
    withheldRecords: BATCH_2_REMAINDER_WITHHELD_IDS,
    scopedDecisionsSubmitted: reviewed.length,
    released,
    releasedCount: released.filter((entry) => !entry.replayed).length,
    projection: projection && {
      ...projection,
      liveAndComplete: projection.released.filter((entry) => entry.complete).length,
      notYetLive: projection.released.filter((entry) => !entry.complete).map((entry) => entry.recordId),
    },
    boundary: 'Internal editorial review is disclosed, exact-revision scoped, and performed by the publisher. It is not external expert review, peer review, consensus, independent reproduction, scientific validation, or commercial certification. External expert review remains an optional append-only upgrade.',
  }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSubstantialInternalReviewRemainder().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
}
