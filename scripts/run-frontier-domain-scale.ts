import { createHash } from 'node:crypto'

import {
  FRONTIER_DOMAIN_BATCH_VERSION,
  FRONTIER_DOMAIN_BOUNDARY,
  FRONTIER_DOMAIN_GRAPH_RECORDS,
  FRONTIER_DOMAIN_GRAPH_RECORDS_BY_DOMAIN,
  FRONTIER_EPISTEMIC_DOMAINS,
} from '../lib/frontier-domain-graphs.ts'
import { epistemicRecordPath, epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import type { EpistemicRecord } from '../lib/epistemic-schema.ts'

type Json = Record<string, unknown>

const DEFAULT_BASE_URL = 'https://www.mahastrategies.com'

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

function bearer(environment: NodeJS.ProcessEnv) {
  const token = environment.EPISTEMIC_OPERATIONS_TOKEN?.trim()
  if (!token || Buffer.byteLength(token, 'utf8') < 32) throw new Error('EPISTEMIC_OPERATIONS_TOKEN must contain at least 32 bytes.')
  return token
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

function selectedRecords(arguments_: readonly string[]): EpistemicRecord[] {
  const selected = arguments_.find((argument) => argument.startsWith('--domain='))?.slice('--domain='.length)
  if (!selected || selected === 'all') return [...FRONTIER_DOMAIN_GRAPH_RECORDS]
  const records = FRONTIER_DOMAIN_GRAPH_RECORDS_BY_DOMAIN[selected]
  if (!records) throw new Error(`Unknown frontier domain ${selected}.`)
  return [...records]
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

async function enqueueDomain(baseUrl: string, token: string, domainSlug: string, records: readonly EpistemicRecord[]) {
  let queued = 0
  let replayed = 0
  for (const record of records) {
    const targetSha256 = epistemicReviewTargetHash(record)
    const result = await request(baseUrl, token, '/api/admin/epistemic-factory/jobs', {
      method: 'POST',
      body: JSON.stringify({
        record,
        sourcePublicPath: epistemicRecordPath(record),
        idempotencyKey: `frontier-domain:${stableKey(FRONTIER_DOMAIN_BATCH_VERSION, domainSlug, record.id, targetSha256)}`,
      }),
    })
    const persistence = object(object(result.body, 'enqueue response').persistence, 'enqueue persistence')
    if (persistence.idempotentReplay) replayed += 1
    else queued += 1
  }
  return { domainSlug, records: records.length, queued, replayed }
}

async function enqueue(baseUrl: string, token: string, records: readonly EpistemicRecord[]) {
  const domainBatches = FRONTIER_EPISTEMIC_DOMAINS
    .map((domain) => ({ domainSlug: domain.slug, records: records.filter((record) => record.domainSlug === domain.slug) }))
    .filter((batch) => batch.records.length)
  return mapConcurrent(domainBatches, 4, (batch) => enqueueDomain(baseUrl, token, batch.domainSlug, batch.records))
}

async function drain(baseUrl: string, token: string) {
  let completed = 0
  let failed = 0
  let passes = 0
  for (;;) {
    if (++passes > 20) throw new Error('The frontier worker exceeded 20 bounded drain passes.')
    const result = await request(baseUrl, token, '/api/admin/epistemic-factory/worker', {
      method: 'POST', body: JSON.stringify({ limit: 50 }),
    })
    const payload = object(result.body, 'worker response')
    const claimed = Number(payload.claimed ?? 0)
    completed += Array.isArray(payload.completed) ? payload.completed.length : 0
    failed += Array.isArray(payload.failed) ? payload.failed.length : 0
    if (!claimed) break
  }
  if (failed) throw new Error(`The frontier worker failed ${failed} jobs.`)
  return { passes, completed, failed }
}

async function compilePackets(baseUrl: string, token: string, records: readonly EpistemicRecord[]) {
  const ids = records.map((record) => record.id)
  const result = await request(baseUrl, token, '/api/admin/epistemic-factory', {
    method: 'POST',
    body: JSON.stringify({
      operation: 'compile',
      recordIds: ids,
      idempotencyKey: `frontier-domains:${stableKey(FRONTIER_DOMAIN_BATCH_VERSION, ...ids)}`,
    }),
  })
  const run = object(object(result.body, 'factory response').run, 'factory run')
  if (Number(run.targetCount) !== records.length) throw new Error(`The frontier factory compiled ${String(run.targetCount)} targets instead of ${records.length}.`)
  const counts = object(run.counts, 'factory counts')
  if (Number(counts.blocked ?? 0) !== 0 || Number(counts.automatedChecksPassed ?? 0) !== records.length) {
    throw new Error(`The automated source-to-claim and unsupported-inference audit did not pass the complete cohort: ${JSON.stringify(counts)}`)
  }
  return { runId: String(run.runId), targetCount: Number(run.targetCount), counts }
}

async function verifyReviewTargets(baseUrl: string, token: string, records: readonly EpistemicRecord[]) {
  const result = await request(baseUrl, token, '/api/admin/epistemic-reviews')
  const targets = array(object(result.body, 'review workspace').targets, 'review workspace targets')
  const selected = records.map((record) => {
    const expected = epistemicReviewTargetHash(record)
    const target = targets.find((entry) => entry.recordId === record.id && entry.reviewTargetSha256 === expected)
    if (!target) throw new Error(`Missing exact-hash review target for ${record.id}.`)
    return target
  })
  return {
    exactHashTargets: selected.length,
    noncanonicalDraftTargets: selected.length,
    requiredReviewScopes: 4,
  }
}

async function verifyPublicBoundary(baseUrl: string, records: readonly EpistemicRecord[]) {
  const [sitemap, llms, ...hubs] = await Promise.all([
    fetchText(baseUrl, '/sitemap.xml'),
    fetchText(baseUrl, '/llms.txt'),
    ...FRONTIER_EPISTEMIC_DOMAINS.map((domain) => fetchText(baseUrl, `/knowledge/${domain.slug}`)),
  ])
  if (sitemap.status !== 200 || llms.status !== 200 || hubs.some((hub) => hub.status !== 200)) {
    throw new Error(`Frontier public surfaces are incomplete: ${JSON.stringify({ sitemap: sitemap.status, llms: llms.status, hubs: hubs.map((hub) => hub.status) })}`)
  }
  for (const domain of FRONTIER_EPISTEMIC_DOMAINS) {
    if (!sitemap.text.includes(`${baseUrl}/knowledge/${domain.slug}`)) throw new Error(`Sitemap is missing the ${domain.slug} landing page.`)
    if (!llms.text.includes(`${baseUrl}/knowledge/${domain.slug}/registry`)) throw new Error(`llms.txt is missing the ${domain.slug} registry.`)
  }
  const leaked = records.map(epistemicRecordPath).filter((path) => sitemap.text.includes(`${baseUrl}${path}`) || llms.text.includes(`${baseUrl}${path}`))
  if (leaked.length) throw new Error(`Noncanonical frontier paths leaked into public machine indexes: ${leaked.join(', ')}`)
  const samples = await Promise.all(FRONTIER_EPISTEMIC_DOMAINS.map((domain) => {
    const record = records.find((candidate) => candidate.domainSlug === domain.slug)
    return record ? fetchText(baseUrl, epistemicRecordPath(record)) : Promise.resolve({ status: 0, text: '' })
  }))
  if (samples.some((sample) => sample.status !== 404)) throw new Error(`A sampled noncanonical frontier route did not return 404: ${samples.map((sample) => sample.status).join(', ')}`)
  return { domainHubs: hubs.length, sampledPrivateRoutes: samples.length, sitemapLeaks: 0, llmsLeaks: 0 }
}

export async function runFrontierDomainScale(environment = process.env, arguments_ = process.argv.slice(2)) {
  const records = selectedRecords(arguments_)
  const apply = arguments_.includes('--apply')
  const drainQueue = arguments_.includes('--drain')
  const baseUrl = productionBaseUrl(environment)
  const summary = {
    version: FRONTIER_DOMAIN_BATCH_VERSION,
    domains: [...new Set(records.map((record) => record.domainSlug))],
    records: records.length,
    typedEdges: records.reduce((total, record) => total + record.bridges.length, 0),
    canonical: 0,
    sitemapEligibleRecordPages: 0,
    boundary: FRONTIER_DOMAIN_BOUNDARY,
  }
  console.log(JSON.stringify(summary, null, 2))
  if (!apply) {
    console.log(JSON.stringify({ operation: 'preview', stateChanged: false }, null, 2))
    return
  }
  const token = bearer(environment)
  const enqueueResult = await enqueue(baseUrl, token, records)
  const workerResult = drainQueue ? await drain(baseUrl, token) : null
  const factoryResult = drainQueue ? await compilePackets(baseUrl, token, records) : null
  const reviewTargets = drainQueue ? await verifyReviewTargets(baseUrl, token, records) : null
  const publicBoundary = await verifyPublicBoundary(baseUrl, records)
  console.log(JSON.stringify({ operation: drainQueue ? 'enqueue-drain-verify' : 'enqueue', enqueueResult, workerResult, factoryResult, reviewTargets, publicBoundary }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) await runFrontierDomainScale()
