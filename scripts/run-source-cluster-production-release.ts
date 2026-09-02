import { createHash } from 'node:crypto'

import { epistemicRecordPath } from '../lib/epistemic-publication.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import plan from '../content/source-cluster/production-operating-plan.json' with { type: 'json' }
import proof from '../content/source-cluster/cascade-proof.json' with { type: 'json' }

/**
 * Executes the frozen 33-record package against Production, in two phases.
 *
 * The operation ids in the plan are the idempotency keys. They are derived from
 * record identity and exact revision, so re-running a phase is recognised as
 * the same operation rather than applied twice, and a record whose revision
 * drifted since the freeze produces a key that matches no prepared operation.
 *
 * Readiness is read-only and is the only mode that runs without a confirmation.
 */

type Json = Record<string, unknown>
const DEFAULT_BASE_URL = 'https://www.mahastrategies.com'
const CONFIRM_CANARY = 'RELEASE_5_SOURCE_CLUSTER_CANARY'
const CONFIRM_REMAINDER = 'RELEASE_28_SOURCE_CLUSTER_REMAINDER'
const CASCADE_ROUTE = proof.targetRoute

const object = (value: unknown, label: string): Json => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Json
}
const array = (value: unknown, label: string): Json[] => {
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
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${text.slice(0, 400)}`)
  return { body, status: response.status }
}

const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((r) => [r.id, r]))
type Entry = { recordId: string; revisionSha256: string; operationId: string; canonicalRoute: string; releaseClassification: string; unlocksCascade: boolean }
const phaseOf = (name: 'A' | 'B') => (plan.phases.find((p) => p.phase === name)!.manifest as unknown as Entry[])

function authority() {
  return {
    authorityId: 'authority_maha-founder-release',
    displayName: 'Maha Strategies Release Authority',
    role: 'Internal canonical knowledge release authority',
    authorizationBasis: 'The organization owner explicitly authorized the five-record source-cluster canary and, conditional on its verification, the 28-record remainder. The reviewer tier is automated-internal-editorial: no human, expert, external or independent review is claimed.',
    publicAttribution: false,
  }
}

/** Read-only. Reports what Production thinks of every record in a phase. */
async function readiness(origin: string, releaseToken: string, entries: Entry[]) {
  const workspace = object((await request(origin, releaseToken, '/api/admin/epistemic-releases')).body, 'release workspace')
  const candidates = array(workspace.candidates, 'release candidates')
  return entries.map((entry) => {
    const candidate = candidates.find((c) => c.recordId === entry.recordId && c.targetSha256 === entry.revisionSha256)
    const anyRevision = candidates.filter((c) => c.recordId === entry.recordId)
    const active = candidate?.activeRelease ? object(candidate.activeRelease, 'active release') : null
    return {
      recordId: entry.recordId,
      presentAtExactRevision: Boolean(candidate),
      revisionsPresentForRecord: anyRevision.length,
      ready: candidate?.ready === true,
      blockers: (candidate?.blockers as unknown[]) ?? null,
      alreadyCurrent: active?.targetSha256 === entry.revisionSha256,
      activeReleaseId: active ? String(active.releaseId) : null,
    }
  })
}

async function publish(origin: string, releaseToken: string, entries: Entry[], phase: string) {
  const workspace = object((await request(origin, releaseToken, '/api/admin/epistemic-releases')).body, 'release workspace')
  const candidates = array(workspace.candidates, 'release candidates')
  const results = []
  for (const entry of entries) {
    const candidate = candidates.find((c) => c.recordId === entry.recordId && c.targetSha256 === entry.revisionSha256)
    if (!candidate) throw new Error(`${entry.recordId}: exact revision ${entry.revisionSha256} is absent from the release workspace. Refusing to release a different revision.`)
    const active = candidate.activeRelease ? object(candidate.activeRelease, 'active release') : null
    if (active?.targetSha256 === entry.revisionSha256) {
      results.push({ recordId: entry.recordId, replayed: true, releaseKind: 'already-current' })
      continue
    }
    if (candidate.ready !== true) throw new Error(`${entry.recordId}: the release gate refused the reviewed target: ${JSON.stringify(candidate.blockers)}`)
    if (!active && entry.releaseClassification !== 'initial') throw new Error(`${entry.recordId}: plan declares ${entry.releaseClassification} but Production holds no active release to supersede.`)
    if (active && entry.releaseClassification === 'initial') throw new Error(`${entry.recordId}: plan declares initial but Production already holds active release ${String(active.releaseId)}.`)
    const common = {
      recordId: entry.recordId,
      targetSha256: entry.revisionSha256,
      canonicalVersion: active ? '1.1.0' : '1.0.0',
      supersedesReleaseId: active ? String(active.releaseId) : null,
      authority: authority(),
      publicChangeSummary: active
        ? 'Superseding canonical release under the disclosed automated-internal-editorial tier.'
        : 'Initial canonical publication under the disclosed automated-internal-editorial tier.',
      rationale: `The exact revision passed a five-axis internal editorial review covering source identity and fidelity, claim-to-passage support, scope and unsupported inference, rights and locator adequacy, and release boundary and non-claims. The reviewer is a machine under the automated-internal-editorial tier; no human, expert, external or independent review is claimed. Operation ${entry.operationId}.`,
    }
    // The plan's operation id is the idempotency key: identity bound to exact revision.
    await request(origin, releaseToken, '/api/admin/epistemic-releases', { method: 'POST', body: JSON.stringify({ ...common, operation: 'preview', idempotencyKey: `source-cluster-${phase}-preview:${entry.operationId}` }) })
    await request(origin, releaseToken, '/api/admin/epistemic-releases', { method: 'POST', body: JSON.stringify({ ...common, operation: 'publish', idempotencyKey: `source-cluster-${phase}-publish:${entry.operationId}` }) })
    results.push({ recordId: entry.recordId, replayed: false, releaseKind: active ? 'superseding' : 'initial', operationId: entry.operationId })
  }
  return results
}

async function verify(origin: string, entries: Entry[], expectCascade: boolean) {
  const [sitemap, llms] = await Promise.all([
    fetch(`${origin}/sitemap.xml`, { cache: 'no-store' }).then((r) => r.text()),
    fetch(`${origin}/llms.txt`, { cache: 'no-store' }).then((r) => r.text()),
  ])
  const routes = []
  for (const entry of entries) {
    const record = records.get(entry.recordId)
    if (!record) throw new Error(`${entry.recordId}: no record definition to derive a canonical route from.`)
    const path = epistemicRecordPath(record)
    const response = await fetch(`${origin}${path}`, { cache: 'no-store' })
    const text = await response.text()
    const inSitemap = sitemap.includes(`${origin}${path}`)
    const inLlms = llms.includes(path)
    // The page must not claim assurances the tier does not carry.
    const overclaims = /\b(peer[- ]reviewed|expert[- ]endorsed|independently (verified|reproduced|replicated))\b/i.test(text)
    if (response.status !== 200 || !inSitemap || !inLlms || overclaims) {
      throw new Error(`${entry.recordId}: projection incomplete at ${path} (status ${response.status}, sitemap ${inSitemap}, llms ${inLlms}, overclaims ${overclaims}).`)
    }
    routes.push({ recordId: entry.recordId, path, status: response.status })
  }
  const cascade = await fetch(`${origin}${CASCADE_ROUTE}`, { cache: 'no-store' })
  const cascadeLive = cascade.status === 200
  if (expectCascade && !cascadeLive) throw new Error(`The cascade source page ${CASCADE_ROUTE} is still ${cascade.status} after the records that unlock it were released.`)
  if (!expectCascade && cascadeLive) throw new Error(`The cascade source page ${CASCADE_ROUTE} became available in a phase that must not unlock it.`)
  const sitemapCount = (sitemap.match(/<loc>/g) ?? []).length
  const sourceRoutes = (sitemap.match(/\/knowledge\/sources\//g) ?? []).length
  const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1])
  if (new Set(locs).size !== locs.length) throw new Error('The sitemap contains duplicate URLs.')
  return { routes: routes.length, sitemapCount, sourceRoutes, cascadeRoute: CASCADE_ROUTE, cascadeStatus: cascade.status, duplicateUrls: 0 }
}

export async function runSourceClusterProductionRelease(environment = process.env, arguments_ = process.argv.slice(2)) {
  const mode = arguments_.find((a) => !a.startsWith('--')) ?? 'readiness'
  const origin = baseUrl(environment)
  const phaseA = phaseOf('A')
  const phaseB = phaseOf('B')

  if (mode === 'readiness') {
    const releaseToken = token(environment, 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN')
    const a = await readiness(origin, releaseToken, phaseA)
    const b = await readiness(origin, releaseToken, phaseB)
    const summarise = (rows: Awaited<ReturnType<typeof readiness>>) => ({
      total: rows.length, presentAtExactRevision: rows.filter((r) => r.presentAtExactRevision).length,
      ready: rows.filter((r) => r.ready).length, alreadyCurrent: rows.filter((r) => r.alreadyCurrent).length,
      notReady: rows.filter((r) => !r.ready && !r.alreadyCurrent).map((r) => ({ recordId: r.recordId, present: r.presentAtExactRevision, blockers: r.blockers })),
    })
    console.log(JSON.stringify({ mode, mutations: 0, phaseA: summarise(a), phaseB: summarise(b) }, null, 2))
    return
  }

  if (mode === 'canary') {
    if (environment.SOURCE_CLUSTER_CONFIRM !== CONFIRM_CANARY) throw new Error(`SOURCE_CLUSTER_CONFIRM must equal ${CONFIRM_CANARY}.`)
    const released = await publish(origin, token(environment, 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN'), phaseA, 'canary')
    const projection = await verify(origin, phaseA, false)
    console.log(JSON.stringify({ mode, released, projection,
      boundary: 'Five records released under the automated-internal-editorial tier. The cascade source page must not appear in this phase.' }, null, 2))
    return
  }

  if (mode === 'remainder') {
    if (environment.SOURCE_CLUSTER_CONFIRM !== CONFIRM_REMAINDER) throw new Error(`SOURCE_CLUSTER_CONFIRM must equal ${CONFIRM_REMAINDER}.`)
    // The remainder may not run until every canary record is live.
    const canaryCheck = await verify(origin, phaseA, false)
    const released = await publish(origin, token(environment, 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN'), phaseB, 'remainder')
    const projection = await verify(origin, [...phaseA, ...phaseB], true)
    console.log(JSON.stringify({ mode, canaryPrecondition: canaryCheck.routes, released, projection,
      cascadeRecords: proof.jointlyRequiredRemainderRecords,
      boundary: 'The cascade source page is a projection of released claims and carries no independent factual authority.' }, null, 2))
    return
  }

  throw new Error(`Unknown mode ${mode}. Expected readiness, canary or remainder.`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSourceClusterProductionRelease().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
}
