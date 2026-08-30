import { createHash } from 'node:crypto'

import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { epistemicRecordPath } from '../lib/epistemic-publication.ts'
import {
  SUBSTANTIAL_SCALE_REVIEW_PACKETS,
  substantialScaleReviewInputs,
} from '../lib/substantial-scale-internal-review.ts'
import {
  SUBSTANTIAL_SCALE_RELEASE_CANARY_IDS,
  SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS,
} from '../lib/substantial-scale-cohort.ts'

type Json = Record<string, unknown>
const ORIGIN = 'https://www.mahastrategies.com'
const CONFIRMATIONS = {
  canary: 'RELEASE_10_SUBSTANTIAL_SCALE_CANARY',
  remainder: 'RELEASE_54_SUBSTANTIAL_SCALE_REMAINDER',
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
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${text.slice(0, 400)}`)
  return text ? JSON.parse(text) as unknown : null
}

function cohort(name: 'canary' | 'remainder'): readonly string[] {
  const canary = new Set<string>(SUBSTANTIAL_SCALE_RELEASE_CANARY_IDS)
  return name === 'canary'
    ? SUBSTANTIAL_SCALE_RELEASE_CANARY_IDS
    : SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS.filter((recordId) => !canary.has(recordId))
}

async function ingestTargets(operationsToken: string) {
  const targetSet = SUBSTANTIAL_SCALE_REVIEW_PACKETS.map((packet) => packet.targetSha256).join('|')
  const digest = createHash('sha256').update(targetSet).digest('hex')
  await request(operationsToken, '/api/admin/epistemic-ingestion', {
    method: 'POST',
    body: JSON.stringify({ adapterId: 'substantial-scale-release', idempotencyKey: `substantial-scale-targets:${digest}` }),
  })
  return `sha256:${digest}`
}

async function reviewRecords(operationsToken: string, recordIds: readonly string[]) {
  const decisions = substantialScaleReviewInputs(recordIds)
  for (const decision of decisions) {
    await request(operationsToken, '/api/admin/epistemic-reviews', {
      method: 'POST',
      body: JSON.stringify(decision),
    })
  }
  return decisions.length
}

async function publishRecords(releaseToken: string, recordIds: readonly string[]) {
  const workspace = object(await request(releaseToken, '/api/admin/epistemic-releases'), 'release workspace')
  const candidates = array(workspace.candidates, 'release candidates')
  const results: { recordId: string; releaseId: string; replayed: boolean }[] = []
  for (const recordId of recordIds) {
    const packet = SUBSTANTIAL_SCALE_REVIEW_PACKETS.find((entry) => entry.recordId === recordId)!
    const candidate = candidates.find((entry) => entry.recordId === recordId && entry.targetSha256 === packet.targetSha256)
    if (!candidate) throw new Error(`${recordId}: exact reviewed candidate is absent.`)
    const active = candidate.activeRelease ? object(candidate.activeRelease, `${recordId} active release`) : null
    if (active?.targetSha256 === packet.targetSha256) {
      results.push({ recordId, releaseId: String(active.releaseId), replayed: true })
      continue
    }
    if (active) throw new Error(`${recordId}: cohort was frozen as initial release but an active release now exists.`)
    if (candidate.ready !== true) throw new Error(`${recordId}: release gate blocked: ${JSON.stringify(candidate.blockers)}`)
    const key = createHash('sha256').update(`${recordId}|${packet.targetSha256}|substantial-scale-v1`).digest('hex')
    const common = {
      recordId,
      targetSha256: packet.targetSha256,
      canonicalVersion: '1.0.0',
      supersedesReleaseId: null,
      authority: {
        authorityId: 'authority_maha-founder-release',
        displayName: 'Maha Strategies Release Authority',
        role: 'Internal canonical knowledge release authority',
        authorizationBasis: 'The organization owner authorized continuous release-aware publishing to at least 100 substantial pages. This exact record passed the disclosed exact-revision internal editorial protocol.',
        publicAttribution: false,
      },
      publicChangeSummary: 'Initial canonical publication under the disclosed exact-revision internal editorial tier.',
      rationale: `The exact target passed record-specific source, domain, boundary, rights, locator, and revision checks. No external endorsement, independent reproduction, scientific validation, or fitness for use is claimed. Packet ${packet.packetDigest}.`,
    }
    await request(releaseToken, '/api/admin/epistemic-releases', {
      method: 'POST', body: JSON.stringify({ ...common, operation: 'preview', idempotencyKey: `substantial-scale-preview:${key}` }),
    })
    const published = object(await request(releaseToken, '/api/admin/epistemic-releases', {
      method: 'POST', body: JSON.stringify({ ...common, operation: 'publish', idempotencyKey: `substantial-scale-publish:${key}` }),
    }), `${recordId} publication`)
    const release = object(published.release, `${recordId} release`)
    results.push({ recordId, releaseId: String(release.releaseId), replayed: false })
  }
  return results
}

async function verifyRecords(recordIds: readonly string[]) {
  const registry = object(await fetch(`${ORIGIN}/knowledge/epistemic-system/releases/registry.json`, { cache: 'no-store' }).then((response) => response.json()), 'public registry')
  const releases = array(registry.releases, 'public releases').filter((release) => release.status === 'active')
  const verified = []
  for (const recordId of recordIds) {
    const packet = SUBSTANTIAL_SCALE_REVIEW_PACKETS.find((entry) => entry.recordId === recordId)!
    const release = releases.find((entry) => entry.recordId === recordId && entry.targetSha256 === packet.targetSha256)
    if (!release) throw new Error(`${recordId}: exact active release absent from public registry.`)
    const record = EPISTEMIC_RECORDS.find((entry) => entry.id === recordId)!
    const path = epistemicRecordPath(record)
    const status = (await fetch(`${ORIGIN}${path}`, { cache: 'no-store' })).status
    if (status !== 200) throw new Error(`${recordId}: canonical route returned ${status}.`)
    verified.push({ recordId, targetSha256: packet.targetSha256, releaseId: String(release.releaseId), path, status })
  }
  return verified
}

export async function run() {
  const cohortName = process.argv.includes('--remainder') ? 'remainder' : 'canary'
  const publish = process.argv.includes('--publish')
  const verifyOnly = process.argv.includes('--verify') && !publish
  const recordIds = cohort(cohortName)
  if (recordIds.length !== (cohortName === 'canary' ? 10 : 54)) throw new Error('Release cohort size drifted.')
  if (publish && process.env.SUBSTANTIAL_SCALE_CONFIRM !== CONFIRMATIONS[cohortName]) {
    throw new Error(`SUBSTANTIAL_SCALE_CONFIRM must equal ${CONFIRMATIONS[cohortName]}.`)
  }
  const targetSetDigest = publish ? await ingestTargets(token('EPISTEMIC_OPERATIONS_TOKEN')) : null
  const scopedDecisions = publish ? await reviewRecords(token('EPISTEMIC_OPERATIONS_TOKEN'), recordIds) : 0
  const releases = publish ? await publishRecords(token('EPISTEMIC_RELEASE_AUTHORITY_TOKEN'), recordIds) : []
  const verified = publish || verifyOnly ? await verifyRecords(recordIds) : []
  console.log(JSON.stringify({
    schemaVersion: 'maha-substantial-scale-release-evidence/1.0',
    cohort: cohortName,
    recordCount: recordIds.length,
    targetSetDigest,
    scopedDecisions,
    releases,
    verified,
    counts: { released: releases.length, replayed: releases.filter((entry) => entry.replayed).length, verified: verified.length },
    boundary: 'AI-assisted internal editorial release. No external expert endorsement, peer review, consensus, independent reproduction, scientific validation, or commercial certification is claimed.',
  }, null, 2))
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
