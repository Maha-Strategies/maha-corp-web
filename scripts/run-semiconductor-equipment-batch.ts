import { createHash } from 'node:crypto'

import {
  SEMICONDUCTOR_EQUIPMENT_FACTORY_BATCH_VERSION,
  SEMICONDUCTOR_EQUIPMENT_FACTORY_BOUNDARY,
  SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES,
} from '../lib/semiconductor-equipment-factory.ts'

type Json = Record<string, unknown>

interface ReviewTarget {
  recordId: string
  reviewTargetSha256: string
  sourcePublicPath: string
  gateDecision?: { reasons?: string[] }
  reviewProgress?: { scopes?: Record<string, { status?: string }> } | null
}

const DEFAULT_BASE_URL = 'https://www.mahastrategies.com'
const CONFIRMATION = 'PROMOTE_25_EQUIPMENT_RECORDS'
const WORKFLOW_ONLY_BLOCKERS = new Set([
  'public-promotion-not-requested',
  'review-state-not-canonical',
  'publication-date-missing',
  'canonical-version-missing',
  'approval-review-missing',
])

function object(value: unknown, label: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Json
}

function array(value: unknown, label: string): Json[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value.map((entry, index) => object(entry, `${label}[${index}]`))
}

function stableKey(...values: string[]) {
  return createHash('sha256').update(values.join('|')).digest('hex').slice(0, 24)
}

function productionBaseUrl(environment: NodeJS.ProcessEnv) {
  const baseUrl = (environment.PRODUCTION_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  if (!/(^|\.)mahastrategies\.com$/.test(new URL(baseUrl).host)) throw new Error(`Refusing non-Production host ${baseUrl}.`)
  return baseUrl
}

function bearer(environment: NodeJS.ProcessEnv, name: 'EPISTEMIC_OPERATIONS_TOKEN' | 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN', required = true) {
  const token = environment[name]?.trim()
  if (required && (!token || Buffer.byteLength(token, 'utf8') < 32)) throw new Error(`${name} must contain at least 32 bytes.`)
  return token ?? ''
}

async function request(baseUrl: string, token: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${token}`)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'follow', ...init, headers })
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${text}`)
  return { response, body, text }
}

async function fetchText(baseUrl: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'follow', cache: 'no-store' })
  return { status: response.status, text: await response.text() }
}

function renderedText(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&middot;|&#183;|&#xB7;/gi, ' · ')
    .replace(/\s+/g, ' ')
}

function equipmentTargets(payload: unknown): ReviewTarget[] {
  const workspace = object(payload, 'review workspace')
  const targets = array(workspace.targets, 'review workspace targets') as unknown as ReviewTarget[]
  return SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES.map((candidate) => {
    const target = targets.find((entry) => entry.recordId === candidate.record.id)
    if (!target) throw new Error(`The immutable equipment target is missing: ${candidate.record.id}`)
    return target
  })
}

function readiness(targets: readonly ReviewTarget[]) {
  const records = targets.map((target) => {
    const gateReasons = target.gateDecision?.reasons ?? []
    const structuralBlockers = gateReasons.filter((reason) => (
      !WORKFLOW_ONLY_BLOCKERS.has(reason) && !reason.startsWith('expert-review-')
    ))
    const scopes = Object.entries(target.reviewProgress?.scopes ?? {})
    const reviewBlockers = scopes.length
      ? scopes.flatMap(([scope, progress]) => progress.status === 'approved' ? [] : [`expert-review-${progress.status ?? 'missing'}:${scope}`])
      : ['review-progress-unavailable']
    return {
      recordId: target.recordId,
      reviewTargetSha256: target.reviewTargetSha256,
      sourcePublicPath: target.sourcePublicPath,
      structuralBlockers,
      reviewBlockers,
      ready: structuralBlockers.length === 0 && reviewBlockers.length === 0,
    }
  })
  return {
    records,
    ready: records.filter((record) => record.ready).length,
    blocked: records.filter((record) => !record.ready).length,
    structuralBlockers: records.reduce((total, record) => total + record.structuralBlockers.length, 0),
    reviewBlockers: records.reduce((total, record) => total + record.reviewBlockers.length, 0),
  }
}

async function verifyPublicProjection(baseUrl: string) {
  const routes = await Promise.all(SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES.map(async (candidate) => ({
    recordId: candidate.record.id,
    path: candidate.sourcePublicPath,
    ...(await fetchText(baseUrl, candidate.sourcePublicPath)),
  })))
  const [overview, sitemap] = await Promise.all([fetchText(baseUrl, '/knowledge'), fetchText(baseUrl, '/sitemap.xml')])
  const failedRoutes = routes.filter((route) => (
    route.status !== 200
    || !route.text.includes('FOUNDATIONAL')
    || !route.text.includes('Boundary:')
    || !route.text.includes('Sources')
  ))
  const missingSitemap = routes.filter((route) => !sitemap.text.includes(`${baseUrl}${route.path}`)).map((route) => route.path)
  if (overview.status !== 200 || !/Equipment\s*·\s*25/i.test(renderedText(overview.text)) || failedRoutes.length || missingSitemap.length) {
    throw new Error(`Public equipment projection failed: ${JSON.stringify({ overviewStatus: overview.status, failedRoutes: failedRoutes.map(({ recordId, path, status }) => ({ recordId, path, status })), missingSitemap }, null, 2)}`)
  }
  return { overview: 'Equipment · 25', publicRoutes: routes.length, sitemapEntries: routes.length }
}

async function enqueue(baseUrl: string, token: string) {
  let queued = 0
  let replayed = 0
  for (const candidate of SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES) {
    const result = await request(baseUrl, token, '/api/admin/epistemic-factory/jobs', {
      method: 'POST',
      body: JSON.stringify({
        record: candidate.record,
        sourcePublicPath: candidate.sourcePublicPath,
        idempotencyKey: `semiconductor-equipment:${stableKey(candidate.record.id, candidate.reviewTargetSha256)}`,
      }),
    })
    const persistence = object(object(result.body, 'enqueue response').persistence, 'enqueue persistence')
    if (persistence.idempotentReplay) replayed += 1
    else queued += 1
  }
  return { queued, replayed }
}

async function drain(baseUrl: string, token: string) {
  let completed = 0
  let failed = 0
  for (;;) {
    const result = await request(baseUrl, token, '/api/admin/epistemic-factory/worker', {
      method: 'POST', body: JSON.stringify({ limit: 25 }),
    })
    const payload = object(result.body, 'worker response')
    const claimed = Number(payload.claimed ?? 0)
    completed += Array.isArray(payload.completed) ? payload.completed.length : 0
    failed += Array.isArray(payload.failed) ? payload.failed.length : 0
    if (!claimed) break
  }
  if (failed) throw new Error(`The equipment worker failed ${failed} jobs.`)
  return { completed, failed }
}

async function compilePackets(baseUrl: string, token: string) {
  const ids = SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES.map((candidate) => candidate.record.id)
  const result = await request(baseUrl, token, '/api/admin/epistemic-factory', {
    method: 'POST',
    body: JSON.stringify({
      operation: 'compile',
      recordIds: ids,
      idempotencyKey: `semiconductor-equipment-factory:${stableKey(...ids)}`,
    }),
  })
  const run = object(object(result.body, 'factory response').run, 'factory run')
  if (Number(run.targetCount) !== 25) throw new Error(`The equipment factory compiled ${String(run.targetCount)} targets instead of 25.`)
  return { runId: String(run.runId), targetCount: Number(run.targetCount), counts: run.counts }
}

async function publishReady(baseUrl: string, token: string, state: ReturnType<typeof readiness>) {
  if (state.blocked) throw new Error(`The exact-hash publication gate refused the equipment release: ${JSON.stringify(state.records.filter((record) => !record.ready), null, 2)}`)
  const authority = {
    authorityId: 'authority_maha-founder-release',
    displayName: 'Maha Strategies Release Authority',
    role: 'Internal canonical knowledge release authority',
    authorizationBasis: 'The organization owner authorized this equipment-class release only after structural checks and all required exact-hash review scopes passed.',
    publicAttribution: false,
  }
  for (const record of state.records) {
    const common = {
      recordId: record.recordId,
      targetSha256: record.reviewTargetSha256,
      canonicalVersion: '1.0.0',
      supersedesReleaseId: null,
      authority,
      publicChangeSummary: 'Initial governed publication of a bounded semiconductor equipment-class reference.',
      rationale: 'The exact frozen equipment target passed structural audits and all required scoped reviews before release authority approval.',
    }
    await request(baseUrl, token, '/api/admin/epistemic-releases', {
      method: 'POST', body: JSON.stringify({ ...common, operation: 'preview', idempotencyKey: `equipment-preview-${record.reviewTargetSha256}` }),
    })
    await request(baseUrl, token, '/api/admin/epistemic-releases', {
      method: 'POST', body: JSON.stringify({ ...common, operation: 'publish', idempotencyKey: `equipment-publish-${record.reviewTargetSha256}` }),
    })
  }
}

export async function runSemiconductorEquipmentBatch(environment = process.env, arguments_ = process.argv.slice(2)) {
  const apply = arguments_.includes('--apply')
  const drainQueue = arguments_.includes('--drain')
  const publish = arguments_.includes('--publish')
  const baseUrl = productionBaseUrl(environment)
  console.log(JSON.stringify({
    version: SEMICONDUCTOR_EQUIPMENT_FACTORY_BATCH_VERSION,
    records: SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES.length,
    sourceRoutes: SEMICONDUCTOR_EQUIPMENT_FACTORY_CANDIDATES.map((candidate) => candidate.sourcePublicPath),
    boundary: SEMICONDUCTOR_EQUIPMENT_FACTORY_BOUNDARY,
  }, null, 2))

  const projection = await verifyPublicProjection(baseUrl)
  if (!apply) {
    console.log(JSON.stringify({ operation: 'preview', projection, stateChanged: false }, null, 2))
    return
  }

  const operationsToken = bearer(environment, 'EPISTEMIC_OPERATIONS_TOKEN')
  const enqueueResult = await enqueue(baseUrl, operationsToken)
  const workerResult = drainQueue ? await drain(baseUrl, operationsToken) : { completed: 0, failed: 0 }
  const factoryResult = drainQueue ? await compilePackets(baseUrl, operationsToken) : null
  const reviewResult = await request(baseUrl, operationsToken, '/api/admin/epistemic-reviews')
  const state = readiness(equipmentTargets(reviewResult.body))

  if (publish) {
    if (!drainQueue) throw new Error('--publish requires --drain so the exact batch is compiled and verified first.')
    if (environment.EPISTEMIC_EQUIPMENT_RELEASE_CONFIRM !== CONFIRMATION) throw new Error(`EPISTEMIC_EQUIPMENT_RELEASE_CONFIRM must equal ${CONFIRMATION}.`)
    await publishReady(baseUrl, bearer(environment, 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN'), state)
  }

  console.log(JSON.stringify({ operation: publish ? 'publish' : 'enqueue-drain-verify', projection, enqueueResult, workerResult, factoryResult, readiness: state }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) await runSemiconductorEquipmentBatch()
