import { createHash } from 'node:crypto'

import {
  DORMANT_SUBSTANTIAL_RELEASE_CANARY_IDS,
  DORMANT_SUBSTANTIAL_RELEASE_PACKETS,
  DORMANT_SUBSTANTIAL_RELEASE_REMAINDER_IDS,
  dormantSubstantialReviewInputs,
} from '../lib/substantial-dormant-release.ts'

type Json = Record<string, unknown>
type CohortName = 'canary' | 'remainder'
const ORIGIN = 'https://www.mahastrategies.com'
const EXPECTED_STATUSES = ['active', 'superseded', 'withdrawn'] as const
const CONFIRMATIONS = {
  canary: 'RELEASE_1_DORMANT_SUBSTANTIAL_CANARY',
  remainder: 'RELEASE_3_DORMANT_SUBSTANTIAL_REMAINDER',
} as const

function object(value: unknown, label: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Json
}

function array(value: unknown, label: string): Json[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value.map((entry, index) => object(entry, `${label}[${index}]`))
}

function token(name: 'EPISTEMIC_OPERATIONS_TOKEN' | 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN'): string {
  const value = process.env[name]?.trim()
  if (!value || Buffer.byteLength(value) < 32) throw new Error(`${name} is missing or too short.`)
  return value
}

async function request(bearer: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${bearer}`)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(`${ORIGIN}${path}`, { ...init, headers, cache: 'no-store', redirect: 'follow' })
  const text = await response.text()
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}.`)
  return text ? JSON.parse(text) as unknown : null
}

function cohort(name: CohortName): readonly string[] {
  return name === 'canary' ? DORMANT_SUBSTANTIAL_RELEASE_CANARY_IDS : DORMANT_SUBSTANTIAL_RELEASE_REMAINDER_IDS
}

async function publicRegistry() {
  const response = await fetch(`${ORIGIN}/knowledge/epistemic-system/releases/registry.json`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Public all-status release registry returned ${response.status}.`)
  const registry = object(await response.json(), 'public registry')
  const counts = object(registry.counts, 'public registry counts')
  const releases = array(registry.releases, 'public releases')
  const statuses = new Set(releases.map((release) => String(release.status)))
  for (const status of statuses) {
    if (!EXPECTED_STATUSES.includes(status as (typeof EXPECTED_STATUSES)[number])) {
      throw new Error(`Public registry exposed unknown release status ${status}; absence is not conclusive.`)
    }
  }
  if (Number(counts.totalReleases) !== releases.length
    || releases.filter((release) => release.status === 'active').length !== Number(counts.active)
    || releases.filter((release) => release.status === 'superseded').length !== Number(counts.superseded)
    || releases.filter((release) => release.status === 'withdrawn').length !== Number(counts.withdrawn)) {
    throw new Error('Public registry counts do not reconcile with its all-status rows.')
  }
  return releases
}

function lineageState(recordId: string, releases: readonly Json[]) {
  const packet = DORMANT_SUBSTANTIAL_RELEASE_PACKETS.find((entry) => entry.recordId === recordId)!
  const lineage = releases.filter((release) => release.recordId === recordId)
  if (lineage.length === 0) return { state: 'lineage-absent' as const, releaseId: null }
  if (lineage.length === 1
    && lineage[0].status === 'active'
    && lineage[0].targetSha256 === packet.targetSha256
    && lineage[0].canonicalPath === packet.canonicalPath) {
    return { state: 'exact-active-replay' as const, releaseId: String(lineage[0].releaseId) }
  }
  throw new Error(`${recordId}: existing lineage is incompatible with this frozen initial release.`)
}

async function submitReviews(operationsToken: string, recordIds: readonly string[]) {
  const decisions = dormantSubstantialReviewInputs(recordIds)
  let replayed = 0
  for (const decision of decisions) {
    const response = object(await request(operationsToken, '/api/admin/epistemic-reviews', {
      method: 'POST', body: JSON.stringify(decision),
    }), `${decision.recordId} ${decision.scope} review`)
    const persistence = object(response.persistence, `${decision.recordId} ${decision.scope} persistence`)
    if (persistence.idempotentReplay === true) replayed += 1
  }
  return { submitted: decisions.length, replayed }
}

async function workspacePreflight(releaseToken: string, recordIds: readonly string[], lineages: readonly Json[]) {
  const workspace = object(await request(releaseToken, '/api/admin/epistemic-releases'), 'release workspace')
  const candidates = array(workspace.candidates, 'release candidates')
  return recordIds.map((recordId) => {
    const packet = DORMANT_SUBSTANTIAL_RELEASE_PACKETS.find((entry) => entry.recordId === recordId)!
    const lineage = lineageState(recordId, lineages)
    const candidate = candidates.find((entry) => entry.recordId === recordId && entry.targetSha256 === packet.targetSha256)
    if (!candidate) throw new Error(`${recordId}: exact reviewed candidate is absent from the release workspace.`)
    const active = candidate.activeRelease ? object(candidate.activeRelease, `${recordId} active release`) : null
    if (lineage.state === 'lineage-absent') {
      if (active) throw new Error(`${recordId}: public lineage is absent but the release workspace reports an active predecessor.`)
      if (candidate.ready !== true) throw new Error(`${recordId}: exact candidate is blocked: ${JSON.stringify(candidate.blockers)}`)
      return { recordId, state: 'initial-ready' as const, targetSha256: packet.targetSha256 }
    }
    if (!active
      || active.targetSha256 !== packet.targetSha256
      || String(active.releaseId) !== lineage.releaseId) {
      throw new Error(`${recordId}: active public lineage and release workspace disagree.`)
    }
    return { recordId, state: 'already-current' as const, targetSha256: packet.targetSha256 }
  })
}

function authority() {
  return {
    authorityId: 'authority_maha-founder-release',
    displayName: 'Maha Strategies Release Authority',
    role: 'Internal canonical knowledge release authority',
    authorizationBasis: 'The organization owner authorized continuous exact-revision release-aware publishing to at least 100 substantial pages. This record passed the disclosed internal editorial protocol before release.',
    publicAttribution: false,
  }
}

async function releaseRecords(releaseToken: string, recordIds: readonly string[], lineages: readonly Json[]) {
  const workspace = object(await request(releaseToken, '/api/admin/epistemic-releases'), 'release workspace')
  const candidates = array(workspace.candidates, 'release candidates')
  const results: { recordId: string; releaseId: string; replayed: boolean }[] = []

  for (const recordId of recordIds) {
    const packet = DORMANT_SUBSTANTIAL_RELEASE_PACKETS.find((entry) => entry.recordId === recordId)!
    const state = lineageState(recordId, lineages)
    if (state.state === 'exact-active-replay') {
      results.push({ recordId, releaseId: state.releaseId!, replayed: true })
      continue
    }
    const candidate = candidates.find((entry) => entry.recordId === recordId && entry.targetSha256 === packet.targetSha256)
    if (!candidate) throw new Error(`${recordId}: exact reviewed candidate is absent from the release workspace.`)
    if (candidate.activeRelease) throw new Error(`${recordId}: initial release candidate unexpectedly has an active predecessor.`)
    if (candidate.ready !== true) throw new Error(`${recordId}: exact candidate is blocked: ${JSON.stringify(candidate.blockers)}`)

    const key = createHash('sha256').update(`${recordId}|${packet.targetSha256}|${packet.packetFingerprint}|dormant-v1`).digest('hex')
    const common = {
      recordId,
      targetSha256: packet.targetSha256,
      canonicalVersion: '1.0.0',
      supersedesReleaseId: null,
      authority: authority(),
      publicChangeSummary: 'Initial canonical release activates an already-compiled exact-revision substantial reference under the disclosed internal-review tier.',
      rationale: `The content-inspected source alignment, eligible substantial package, and four internal-review scopes all bind exact target ${packet.targetSha256}. No external endorsement, independent reproduction, scientific validation, or fitness for use is claimed. Packet fingerprint ${packet.packetFingerprint}.`,
    }
    await request(releaseToken, '/api/admin/epistemic-releases', {
      method: 'POST', body: JSON.stringify({ ...common, operation: 'preview', idempotencyKey: `dormant-substantial-preview:${key}` }),
    })
    const publication = object(await request(releaseToken, '/api/admin/epistemic-releases', {
      method: 'POST', body: JSON.stringify({ ...common, operation: 'publish', idempotencyKey: `dormant-substantial-publish:${key}` }),
    }), `${recordId} publication`)
    const release = object(publication.release, `${recordId} release`)
    results.push({ recordId, releaseId: String(release.releaseId), replayed: false })
  }
  return results
}

async function verifyPublicOnce(recordIds: readonly string[]) {
  const releases = await publicRegistry()
  const [sitemapResponse, llmsResponse] = await Promise.all([
    fetch(`${ORIGIN}/sitemap.xml`, { cache: 'no-store' }),
    fetch(`${ORIGIN}/llms.txt`, { cache: 'no-store' }),
  ])
  if (sitemapResponse.status !== 200 || llmsResponse.status !== 200) {
    throw new Error(`Public indexes are unavailable (sitemap ${sitemapResponse.status}, llms.txt ${llmsResponse.status}).`)
  }
  const [sitemap, llms] = await Promise.all([sitemapResponse.text(), llmsResponse.text()])
  const verified = []
  for (const recordId of recordIds) {
    const packet = DORMANT_SUBSTANTIAL_RELEASE_PACKETS.find((entry) => entry.recordId === recordId)!
    const state = lineageState(recordId, releases)
    const response = await fetch(`${ORIGIN}${packet.canonicalPath}`, { cache: 'no-store' })
    const html = response.status === 200 ? await response.text() : ''
    const missing = []
    if (state.state !== 'exact-active-replay') missing.push('exact active release')
    if (response.status !== 200) missing.push(`route status ${response.status}`)
    if (!html.includes('Substantial reference')) missing.push('substantial reference')
    if (!html.includes('internal-editorial')) missing.push('internal-review label')
    if (!html.includes('No external reviewer participated')) missing.push('no-external-review disclosure')
    if (!html.includes(`<link rel="canonical" href="${ORIGIN}${packet.canonicalPath}"`)) missing.push('canonical metadata')
    if (!/"@type"\s*:\s*"TechArticle"/.test(html)) missing.push('TechArticle JSON-LD')
    if (!sitemap.includes(`${ORIGIN}${packet.canonicalPath}`)) missing.push('sitemap membership')
    if (!llms.includes(`${ORIGIN}${packet.canonicalPath}`)) missing.push('llms.txt membership')
    verified.push({ recordId, state: state.state, path: packet.canonicalPath, status: response.status, complete: missing.length === 0, missing })
  }
  return verified
}

async function verifyPublic(recordIds: readonly string[], strict: boolean) {
  const attempts = strict ? 12 : 1
  let result = await verifyPublicOnce(recordIds)
  for (let attempt = 1; attempt < attempts && result.some((entry) => !entry.complete); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2_000))
    result = await verifyPublicOnce(recordIds)
  }
  if (strict) {
    const incomplete = result.filter((entry) => !entry.complete)
    if (incomplete.length) {
      throw new Error(`Public projection incomplete after ${attempts} bounded checks: ${incomplete.map((entry) => `${entry.recordId} (${entry.missing.join(', ')})`).join('; ')}.`)
    }
  }
  return result
}

export async function run() {
  const cohortName: CohortName = process.argv.includes('--remainder') ? 'remainder' : 'canary'
  const publish = process.argv.includes('--publish')
  const recordIds = cohort(cohortName)
  if (recordIds.length !== (cohortName === 'canary' ? 1 : 3)) throw new Error('Dormant release cohort size drifted.')
  if (publish && process.env.DORMANT_SUBSTANTIAL_CONFIRM !== CONFIRMATIONS[cohortName]) {
    throw new Error(`DORMANT_SUBSTANTIAL_CONFIRM must equal ${CONFIRMATIONS[cohortName]}.`)
  }

  const before = await publicRegistry()
  const beforeStates = recordIds.map((recordId) => ({ recordId, ...lineageState(recordId, before) }))
  const reviews = publish ? await submitReviews(token('EPISTEMIC_OPERATIONS_TOKEN'), recordIds) : null
  const releaseToken = token('EPISTEMIC_RELEASE_AUTHORITY_TOKEN')
  const preflight = await workspacePreflight(releaseToken, recordIds, before)
  const releases = publish ? await releaseRecords(releaseToken, recordIds, before) : []
  const projection = await verifyPublic(recordIds, publish)

  console.log(JSON.stringify({
    schemaVersion: 'maha-dormant-substantial-release-evidence/1.0',
    cohort: cohortName,
    recordCount: recordIds.length,
    beforeStates,
    reviews,
    preflight,
    releases,
    projection,
    counts: {
      released: releases.filter((entry) => !entry.replayed).length,
      replayed: releases.filter((entry) => entry.replayed).length,
      publiclyComplete: projection.filter((entry) => entry.complete).length,
    },
    boundary: 'Exact-revision AI-assisted internal editorial release. No external expert endorsement, peer review, consensus, independent reproduction, scientific validation, or commercial certification is claimed.',
  }, null, 2))
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
