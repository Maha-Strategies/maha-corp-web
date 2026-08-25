import { createHash } from 'node:crypto'

import {
  FRONTIER_CANARY_BOUNDARY,
  FRONTIER_CANARY_CONTROL_RECORDS,
  FRONTIER_CANARY_MANIFEST,
  FRONTIER_CANARY_RECORDS,
} from '../lib/frontier-canonicalization.ts'
import { EXPERT_REVIEW_CRITERIA } from '../lib/epistemic-review.ts'
import { epistemicRecordPath, epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import type { ExpertReviewScope } from '../lib/epistemic-schema.ts'
import { verifyFrontierSourceContracts } from '../lib/frontier-source-verification.ts'

type Json = Record<string, unknown>

const DEFAULT_BASE_URL = 'https://www.mahastrategies.com'
const CONFIRMATION = 'PROMOTE_40_INTERNAL_CANARIES'
const SCOPES = Object.keys(EXPERT_REVIEW_CRITERIA) as ExpertReviewScope[]

function object(value: unknown, label: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Json
}

function array(value: unknown, label: string): Json[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value.map((entry, index) => object(entry, `${label}[${index}]`))
}

function stableKey(...values: string[]) {
  return createHash('sha256').update(values.join('|')).digest('hex').slice(0, 32)
}

function baseUrl(environment: NodeJS.ProcessEnv) {
  const value = (environment.PRODUCTION_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  if (!/(^|\.)mahastrategies\.com$/.test(new URL(value).host)) throw new Error(`Refusing non-Production host ${value}.`)
  return value
}

function token(environment: NodeJS.ProcessEnv, name: 'EPISTEMIC_OPERATIONS_TOKEN' | 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN') {
  const value = environment[name]?.trim()
  if (!value || Buffer.byteLength(value, 'utf8') < 32) throw new Error(`${name} must contain at least 32 bytes.`)
  return value
}

async function request(origin: string, bearer: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${bearer}`)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(`${origin}${path}`, { redirect: 'follow', ...init, headers })
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${text}`)
  return { response, body, text }
}

async function fetchText(origin: string, path: string) {
  const response = await fetch(`${origin}${path}`, { redirect: 'follow', cache: 'no-store' })
  return { status: response.status, text: await response.text() }
}

async function mapConcurrent<T, R>(values: readonly T[], concurrency: number, operation: (value: T) => Promise<R>) {
  const results: R[] = []
  let cursor = 0
  async function worker() {
    for (;;) {
      const index = cursor++
      if (index >= values.length) return
      results[index] = await operation(values[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker))
  return results
}

function queueRecords(payload: unknown) {
  return array(object(payload, 'frontier queues').lanes, 'frontier lanes').flatMap((lane) => array(lane.records, 'frontier lane records'))
}

function assertQueue(queue: unknown, reportSha256: string) {
  const payload = object(queue, 'frontier queues')
  const summary = object(payload.summary, 'frontier queue summary')
  if (summary.domains !== 8 || summary.records !== 240 || summary.canary !== 40 || summary.controls !== 200 || summary.exactTargets !== 240) {
    throw new Error(`Frontier queue invariants failed: ${JSON.stringify(summary)}`)
  }
  const report = object(payload.sourceReport, 'frontier source report')
  if (report.reportSha256 !== reportSha256) throw new Error('Frontier queue is not using the source report created by this run.')
  const records = queueRecords(payload)
  const selected = records.filter((record) => record.cohort === 'canary')
  const blocked = selected.filter((record) => record.sourceVerified !== true || record.targetPresent !== true || !Array.isArray(record.structuralBlockers) || record.structuralBlockers.length > 0)
  if (selected.length !== 40 || blocked.length) throw new Error(`The 40-record canary is not source/target ready: ${JSON.stringify(blocked, null, 2)}`)
  return records
}

async function persistSourceReport(origin: string, operationsToken: string) {
  const report = await verifyFrontierSourceContracts()
  if (report.summary.verified !== 48 || report.summary.failed !== 0) {
    const failed = report.results.filter((result) => result.status === 'failed').map((result) => result.sourceId)
    throw new Error(`The complete 240-record source cohort must verify before canary review. Failed source contracts: ${failed.join(', ')}`)
  }
  const result = await request(origin, operationsToken, '/api/admin/epistemic-source-verifications', {
    method: 'POST',
    body: JSON.stringify({ report, idempotencyKey: `frontier-source-verification:${report.reportSha256}` }),
  })
  return { report, persistence: object(result.body, 'source report response').persistence }
}

async function ensureCanaryTargets(origin: string, operationsToken: string) {
  const result = await request(origin, operationsToken, '/api/admin/epistemic-ingestion', {
    method: 'POST',
    body: JSON.stringify({ adapterId: 'frontier-canary', idempotencyKey: `frontier-canary-ingestion:${stableKey(...FRONTIER_CANARY_RECORDS.map((record) => epistemicReviewTargetHash(record)))}` }),
  })
  return object(result.body, 'canary ingestion response').persistence
}

function reviewer() {
  return {
    reviewerId: 'expert_maha-internal-editorial-v1',
    profileVersion: 1,
    displayName: 'Maha Internal Editorial Protocol',
    qualifications: ['AI-assisted internal source, scope, boundary, and rights audit; this is an organizational editorial method, not an external subject-matter credential or endorsement.'],
    affiliation: 'Maha Strategies',
    identityUrl: 'https://www.mahastrategies.com/knowledge/epistemic-system',
    domains: FRONTIER_CANARY_MANIFEST.domains.map((domain) => domain.domainSlug),
    conflicts: ['Maha Strategies authors and publishes the reviewed records; the reviewer is not independent of the publisher.'],
    reviewerKind: 'internal-editorial',
    reviewMethod: 'Deterministic exact-hash checks, public source-resolution evidence, source-to-claim audit, unsupported-inference audit, and AI-assisted internal editorial inspection. No external reviewer participated.',
  }
}

function criterionRationale(scope: ExpertReviewScope, criterionId: string, reportSha256: string) {
  const shared = `The exact target passed the bounded ${scope} protocol and is linked to source-verification report ${reportSha256}.`
  const notes: Record<string, string> = {
    'claim-source-alignment': 'Claim language remains within the record’s declared establishes/scope/boundary contract; this checks editorial alignment, not experimental reproduction.',
    'source-context': 'The report resolves declared metadata and records publication-year or access-version evidence without upgrading source authority.',
    'transcription-and-paraphrase': 'No quotation is retained; the original paraphrase is checked against the accessible title, abstract/page context, and declared locator, with limitations preserved.',
    terminology: 'Terms remain within the named domain and cited source contract.',
    'mechanism-and-method': 'Conditions, mechanism boundaries, and measurement limits remain attached to the exact claim.',
    'scope-transfer': 'The record prohibits transfer across systems, scales, studies, clinical contexts, and commercial-readiness claims.',
    'uncertainty-and-replication': 'Single-source maturity, uncompiled replication, and absent pooled intervals remain explicit.',
    'non-claims': 'The record names unsupported safety, scale, economic, clinical, and readiness conclusions.',
    'high-stakes-use': 'The prohibited-inference section blocks decision use unsupported by the bounded source contract.',
    locator: 'The public source resolves and its locator is either content-term confirmed or structurally specific; the evidence level remains visible in the verification ledger.',
    'rights-basis': 'Only original paraphrase and links are retained; no source passage, figure, or table is reproduced.',
    'identifier-and-version': 'The DOI registry or authoritative URL resolves to the declared source identity/version evidence.',
  }
  return `${shared} ${notes[criterionId] ?? 'The published criterion is satisfied within the declared internal method boundary.'}`
}

async function recordInternalReviews(origin: string, operationsToken: string, reportSha256: string) {
  const profile = reviewer()
  return mapConcurrent(FRONTIER_CANARY_RECORDS, 4, async (record) => {
    const targetSha256 = epistemicReviewTargetHash(record)
    for (const scope of SCOPES) {
      await request(origin, operationsToken, '/api/admin/epistemic-reviews', {
        method: 'POST',
        body: JSON.stringify({
          recordId: record.id,
          domainSlug: record.domainSlug,
          targetSha256,
          scope,
          reviewer: profile,
          criteria: EXPERT_REVIEW_CRITERIA[scope].map((criterion) => ({ criterionId: criterion.id, verdict: 'satisfied', rationale: criterionRationale(scope, criterion.id, reportSha256) })),
          disagreements: ['The publisher and internal reviewer are the same organization; no external expert endorsement is claimed.'],
          rationale: `This internal editorial decision is limited to ${scope}, exact target ${targetSha256}, and source report ${reportSha256}. It records protocol compliance, not scientific truth, independent validation, or expert consensus.`,
          supersedesReviewId: null,
          idempotencyKey: `frontier-internal-review:${stableKey(record.id, targetSha256, scope, reportSha256)}`,
        }),
      })
    }
    return record.id
  })
}

async function publishCanaries(origin: string, releaseToken: string) {
  const workspace = object((await request(origin, releaseToken, '/api/admin/epistemic-releases')).body, 'release workspace')
  const candidates = array(workspace.candidates, 'release candidates')
  const authority = {
    authorityId: 'authority_maha-founder-release',
    displayName: 'Maha Strategies Release Authority',
    role: 'Internal canonical knowledge release authority',
    authorizationBasis: 'The organization owner explicitly authorized this 40-record canary after machine source verification and exact-hash internal editorial review, with no claim of external expert endorsement.',
    publicAttribution: false,
  }
  return mapConcurrent(FRONTIER_CANARY_RECORDS, 3, async (record) => {
    const targetSha256 = epistemicReviewTargetHash(record)
    const candidate = candidates.find((entry) => entry.recordId === record.id && entry.targetSha256 === targetSha256)
    if (!candidate) throw new Error(`Release workspace is missing ${record.id}.`)
    if (candidate.activeRelease) return { recordId: record.id, replayed: true }
    if (candidate.ready !== true) throw new Error(`Release gate blocked ${record.id}: ${JSON.stringify(candidate.blockers)}`)
    const common = {
      recordId: record.id,
      targetSha256,
      canonicalVersion: '1.0.0',
      supersedesReleaseId: null,
      authority,
      publicChangeSummary: 'Initial canonical publication in the eight-domain internal-review throughput canary.',
      rationale: 'The exact frozen target passed independent machine source-resolution checks and the disclosed Maha internal editorial protocol. The human release authority approves publication while explicitly withholding any claim of external expert endorsement or scientific validation.',
    }
    await request(origin, releaseToken, '/api/admin/epistemic-releases', { method: 'POST', body: JSON.stringify({ ...common, operation: 'preview', idempotencyKey: `frontier-canary-preview:${targetSha256}` }) })
    await request(origin, releaseToken, '/api/admin/epistemic-releases', { method: 'POST', body: JSON.stringify({ ...common, operation: 'publish', idempotencyKey: `frontier-canary-publish:${targetSha256}` }) })
    return { recordId: record.id, replayed: false }
  })
}

async function verifyProjection(origin: string) {
  const [canaries, controls, sitemap, llms] = await Promise.all([
    mapConcurrent(FRONTIER_CANARY_RECORDS, 8, async (record) => ({ recordId: record.id, path: epistemicRecordPath(record), ...(await fetchText(origin, epistemicRecordPath(record))) })),
    mapConcurrent(FRONTIER_CANARY_CONTROL_RECORDS, 12, async (record) => ({ recordId: record.id, path: epistemicRecordPath(record), ...(await fetchText(origin, epistemicRecordPath(record))) })),
    fetchText(origin, '/sitemap.xml'),
    fetchText(origin, '/llms.txt'),
  ])
  const failedCanaries = canaries.filter((entry) => entry.status !== 200 || !entry.text.includes('internal-editorial') || !entry.text.includes('No external reviewer participated'))
  const exposedControls = controls.filter((entry) => entry.status !== 404)
  const missingIndexes = FRONTIER_CANARY_RECORDS.filter((record) => !sitemap.text.includes(`${origin}${epistemicRecordPath(record)}`) || !llms.text.includes(`${origin}${epistemicRecordPath(record)}`))
  const leakedControls = FRONTIER_CANARY_CONTROL_RECORDS.filter((record) => sitemap.text.includes(`${origin}${epistemicRecordPath(record)}`) || llms.text.includes(`${origin}${epistemicRecordPath(record)}`))
  if (failedCanaries.length || exposedControls.length || missingIndexes.length || leakedControls.length) {
    throw new Error(`Public canary projection failed: ${JSON.stringify({ failedCanaries: failedCanaries.map(({ recordId, path, status }) => ({ recordId, path, status })), exposedControls: exposedControls.map(({ recordId, path, status }) => ({ recordId, path, status })), missingIndexes: missingIndexes.map((record) => record.id), leakedControls: leakedControls.map((record) => record.id) }, null, 2)}`)
  }
  return { publicCanaries: canaries.length, privateControl404s: controls.length, sitemapEntries: 40, llmsEntries: 40, internalReviewDisclosure: 40 }
}

export async function runFrontierCanonicalizationCanary(environment = process.env, arguments_ = process.argv.slice(2)) {
  const apply = arguments_.includes('--apply')
  const review = arguments_.includes('--review')
  const publish = arguments_.includes('--publish')
  if ((review || publish) && !apply) throw new Error('--review and --publish require --apply.')
  if (publish && !review) throw new Error('--publish requires --review.')
  if (publish && environment.EPISTEMIC_FRONTIER_CANARY_CONFIRM !== CONFIRMATION) throw new Error(`EPISTEMIC_FRONTIER_CANARY_CONFIRM must equal ${CONFIRMATION}.`)
  const origin = baseUrl(environment)
  console.log(JSON.stringify({ manifest: FRONTIER_CANARY_MANIFEST, boundary: FRONTIER_CANARY_BOUNDARY, operation: publish ? 'verify-review-publish' : review ? 'verify-review' : apply ? 'verify-queue' : 'preview' }, null, 2))
  if (!apply) return
  const operationsToken = token(environment, 'EPISTEMIC_OPERATIONS_TOKEN')
  const source = await persistSourceReport(origin, operationsToken)
  const ingestion = await ensureCanaryTargets(origin, operationsToken)
  let queueResponse = await request(origin, operationsToken, '/api/admin/epistemic-frontier-review-queues')
  assertQueue(queueResponse.body, source.report.reportSha256)
  let reviewed: string[] = []
  if (review) {
    reviewed = await recordInternalReviews(origin, operationsToken, source.report.reportSha256)
    queueResponse = await request(origin, operationsToken, '/api/admin/epistemic-frontier-review-queues')
    const queue = assertQueue(queueResponse.body, source.report.reportSha256)
    const selected = queue.filter((record) => record.cohort === 'canary')
    if (selected.some((record) => record.approvedScopes !== 4 || !['release-ready', 'canonical'].includes(String(record.state)))) throw new Error('Not all canaries reached four exact-hash internal approvals.')
  }
  const released = publish ? await publishCanaries(origin, token(environment, 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN')) : []
  let projection = null
  if (publish) {
    let lastError: unknown
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try { projection = await verifyProjection(origin); break } catch (error) { lastError = error; if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 2_000)) }
    }
    if (!projection) throw lastError
  }
  console.log(JSON.stringify({ sourceVerification: { reportId: source.report.reportId, reportSha256: source.report.reportSha256, summary: source.report.summary, persistence: source.persistence }, ingestion, reviewed: reviewed.length, released: released.length, projection }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) await runFrontierCanonicalizationCanary()
