import {
  EPISTEMIC_PILOT_RELEASE_RECORDS,
  EPISTEMIC_PILOT_WITHHELD_HYPOTHESES,
} from '../lib/epistemic-pilot-release.ts'
import { epistemicRecordPath } from '../lib/epistemic-publication.ts'

interface ReleaseCandidate {
  recordId: string
  domainSlug: string
  title: string
  targetSha256: string
  ready: boolean
  blockers: string[]
  activeRelease: { releaseId: string; targetSha256: string } | null
}

interface ReleaseWorkspace { candidates: ReleaseCandidate[] }
interface ReviewWorkspace {
  targets: Array<{
    recordId: string
    domainSlug: string | null
    title: string | null
    reviewTargetSha256: string
    reviewProgress: { scopes: Record<string, { status: string }> } | null
  }>
}

const baseUrl = (process.env.MAHA_PILOT_RELEASE_BASE_URL ?? 'https://www.mahastrategies.com').replace(/\/$/, '')
const releaseToken = process.env.EPISTEMIC_RELEASE_AUTHORITY_TOKEN?.trim()
const operationsToken = process.env.EPISTEMIC_OPERATIONS_TOKEN?.trim()
const publish = process.argv.includes('--publish')

if (publish && (!releaseToken || releaseToken.length < 32)) {
  throw new Error('EPISTEMIC_RELEASE_AUTHORITY_TOKEN must contain the production release-authority bearer token for a mutating run.')
}
if ((!releaseToken || releaseToken.length < 32) && (!operationsToken || operationsToken.length < 32)) {
  throw new Error('A production operations or release-authority bearer token is required for the readiness check.')
}

async function request(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${token}`)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'follow', ...init, headers })
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { response, body, text }
}

async function fetchText(path: string) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'follow', cache: 'no-store' })
  return { status: response.status, text: await response.text() }
}

async function assertPublicProjection() {
  const recordPages = await Promise.all(EPISTEMIC_PILOT_RELEASE_RECORDS.map(async (record) => ({
    record,
    path: epistemicRecordPath(record),
    ...(await fetchText(epistemicRecordPath(record))),
  })))
  const hypotheses = await Promise.all(EPISTEMIC_PILOT_WITHHELD_HYPOTHESES.map(async (hypothesis) => ({
    ...hypothesis,
    ...(await fetchText(hypothesis.path)),
  })))
  const [sitemap, llms, quantumRegistry, syntheticRegistry, quantumDomain, syntheticDomain] = await Promise.all([
    fetchText('/sitemap.xml'),
    fetchText('/llms.txt'),
    fetchText('/knowledge/quantum-systems/registry'),
    fetchText('/knowledge/synthetic-biology/registry'),
    fetchText('/knowledge/quantum-systems'),
    fetchText('/knowledge/synthetic-biology'),
  ])

  const failedRecords = recordPages.flatMap(({ record, path, status, text }) => {
    const missingContracts = [
      'maha-epistemic/1.0', 'Claim ledger', 'Scope', 'Boundary', 'Uncertainty', 'Primary sources', 'Exact locator',
    ].filter((contract) => !text.includes(contract))
    return status === 200 && missingContracts.length === 0 ? [] : [{ recordId: record.id, path, status, missingContracts }]
  })
  const missingSitemap = EPISTEMIC_PILOT_RELEASE_RECORDS.filter((record) => !sitemap.text.includes(`${baseUrl}${epistemicRecordPath(record)}`)).map((record) => record.id)
  const missingLlms = EPISTEMIC_PILOT_RELEASE_RECORDS.filter((record) => !llms.text.includes(`${baseUrl}${epistemicRecordPath(record)}`)).map((record) => record.id)
  const registryFailures = EPISTEMIC_PILOT_RELEASE_RECORDS.filter((record) => {
    const registry = record.domainSlug === 'quantum-systems' ? quantumRegistry.text : syntheticRegistry.text
    return !registry.includes(record.id) || !registry.includes(record.title)
  }).map((record) => record.id)
  const exposedHypotheses = hypotheses.filter((hypothesis) => (
    hypothesis.status !== 404
    || sitemap.text.includes(hypothesis.path)
    || llms.text.includes(hypothesis.path)
    || quantumRegistry.text.includes(hypothesis.recordId)
    || syntheticRegistry.text.includes(hypothesis.recordId)
  )).map(({ recordId, path, status }) => ({ recordId, path, status }))
  const inactiveDomains = [quantumDomain, syntheticDomain].filter(({ status, text }) => status !== 200 || !text.includes('Active structured domain'))

  if (failedRecords.length || missingSitemap.length || missingLlms.length || registryFailures.length || exposedHypotheses.length || inactiveDomains.length) {
    throw new Error(JSON.stringify({ failedRecords, missingSitemap, missingLlms, registryFailures, exposedHypotheses, inactiveDomainCount: inactiveDomains.length }, null, 2))
  }
  return {
    canonicalRecordPages: recordPages.length,
    quantumFactoryRecords: recordPages.filter(({ record }) => record.domainSlug === 'quantum-systems').length,
    syntheticBiologyFactoryRecords: recordPages.filter(({ record }) => record.domainSlug === 'synthetic-biology').length,
    domainSurfaces: 'active-structured-domain',
    sitemap: 'updated',
    llms: 'updated',
    withheldHypotheses404: hypotheses.length,
    claimContracts: 'rendered',
  }
}

let selected: ReleaseCandidate[]
if (releaseToken && releaseToken.length >= 32) {
  const result = await request('/api/admin/epistemic-releases', releaseToken)
  if (!result.response.ok) throw new Error(`Release workspace returned ${result.response.status}: ${result.text}`)
  const workspace = result.body as ReleaseWorkspace
  selected = EPISTEMIC_PILOT_RELEASE_RECORDS.map((record) => {
    const candidate = workspace.candidates.find((entry) => entry.recordId === record.id)
    if (!candidate) throw new Error(`The frozen pilot target is missing: ${record.id}`)
    return candidate
  })
} else {
  const result = await request('/api/admin/epistemic-reviews', operationsToken!)
  if (!result.response.ok) throw new Error(`Review workspace returned ${result.response.status}: ${result.text}`)
  const workspace = result.body as ReviewWorkspace
  selected = EPISTEMIC_PILOT_RELEASE_RECORDS.map((record) => {
    const target = workspace.targets.find((entry) => entry.recordId === record.id)
    if (!target) throw new Error(`The frozen pilot target is missing: ${record.id}`)
    const scopeBlockers = Object.entries(target.reviewProgress?.scopes ?? {}).flatMap(([scope, progress]) => (
      progress.status === 'approved' ? [] : [`expert-review-${progress.status}:${scope}`]
    ))
    return {
      recordId: target.recordId,
      domainSlug: target.domainSlug ?? record.domainSlug,
      title: target.title ?? record.title,
      targetSha256: target.reviewTargetSha256,
      ready: scopeBlockers.length === 0 && Boolean(target.reviewProgress),
      blockers: target.reviewProgress ? scopeBlockers : ['review-progress-unavailable'],
      activeRelease: null,
    }
  })
}

const staleActive = selected.filter((candidate) => candidate.activeRelease && candidate.activeRelease.targetSha256 !== candidate.targetSha256)
if (staleActive.length) throw new Error(`Active canonical targets have drifted and require explicit supersession:\n${JSON.stringify(staleActive, null, 2)}`)
const blockers = selected.filter((candidate) => !candidate.ready && !candidate.activeRelease).map((candidate) => ({
  recordId: candidate.recordId,
  domainSlug: candidate.domainSlug,
  title: candidate.title,
  blockers: candidate.blockers,
}))
const summary = {
  total: selected.length,
  quantumSystems: selected.filter((candidate) => candidate.domainSlug === 'quantum-systems').length,
  syntheticBiology: selected.filter((candidate) => candidate.domainSlug === 'synthetic-biology').length,
  alreadyActive: selected.filter((candidate) => candidate.activeRelease).length,
  readyForInitialRelease: selected.filter((candidate) => candidate.ready && !candidate.activeRelease).length,
  blocked: blockers.length,
  missingScopedDecisions: blockers.reduce((total, candidate) => total + candidate.blockers.filter((blocker) => blocker.startsWith('expert-review-')).length, 0),
}

if (!publish) {
  console.log(JSON.stringify({ operation: 'readiness', publishable: blockers.length === 0, summary, blockers }, null, 2))
  process.exit(0)
}
if (process.env.EPISTEMIC_PILOT_RELEASE_CONFIRM !== 'PROMOTE_46_PILOT_RECORDS') {
  throw new Error('EPISTEMIC_PILOT_RELEASE_CONFIRM must equal PROMOTE_46_PILOT_RECORDS for a mutating run.')
}
if (blockers.length) throw new Error(`The exact-hash review gate refused publication:\n${JSON.stringify({ summary, blockers }, null, 2)}`)

const authority = {
  authorityId: 'authority_maha-founder-release',
  displayName: 'Maha Strategies Release Authority',
  role: 'Internal canonical knowledge release authority',
  authorizationBasis: 'The organization owner authorized the complete adversarial-pilot release only after all required exact-hash review scopes passed.',
  publicAttribution: false,
}
const pending = selected.filter((candidate) => !candidate.activeRelease)
for (const candidate of pending) {
  const preview = await request('/api/admin/epistemic-releases', releaseToken!, {
    method: 'POST',
    body: JSON.stringify({
      operation: 'preview',
      recordId: candidate.recordId,
      targetSha256: candidate.targetSha256,
      canonicalVersion: '1.0.0',
      supersedesReleaseId: null,
      authority,
      publicChangeSummary: 'Initial canonical publication in the complete Quantum Systems and Synthetic Biology foundational pilot release.',
      rationale: 'All required exact-hash review scopes passed, and the human release authority approved this bounded record for canonical publication.',
      idempotencyKey: `production-pilot-preview-${candidate.targetSha256}`,
    }),
  })
  if (!preview.response.ok) throw new Error(`Release preview failed for ${candidate.recordId}: ${preview.text}`)
}

const releases: unknown[] = []
for (const candidate of pending) {
  const result = await request('/api/admin/epistemic-releases', releaseToken!, {
    method: 'POST',
    body: JSON.stringify({
      operation: 'publish',
      recordId: candidate.recordId,
      targetSha256: candidate.targetSha256,
      canonicalVersion: '1.0.0',
      supersedesReleaseId: null,
      authority,
      publicChangeSummary: 'Initial canonical publication in the complete Quantum Systems and Synthetic Biology foundational pilot release.',
      rationale: 'All required exact-hash review scopes passed, and the human release authority approved this bounded record for canonical publication.',
      idempotencyKey: `production-pilot-publish-${candidate.targetSha256}`,
    }),
  })
  if (!result.response.ok) throw new Error(`Canonical release failed for ${candidate.recordId}: ${result.text}`)
  releases.push(result.body)
}

let projection: Awaited<ReturnType<typeof assertPublicProjection>> | null = null
let projectionError: unknown = null
for (let attempt = 0; attempt < 10; attempt += 1) {
  try {
    projection = await assertPublicProjection()
    break
  } catch (error) {
    projectionError = error
    if (attempt < 9) await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
}
if (!projection) throw projectionError
console.log(JSON.stringify({ operation: 'publish', released: releases.length, previouslyActive: summary.alreadyActive, projection }, null, 2))
