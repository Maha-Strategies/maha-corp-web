import {
  EPISTEMIC_CANARY_CONTROL_RECORDS,
  EPISTEMIC_CANARY_RECORDS,
} from '../lib/epistemic-canary.ts'
import { epistemicRecordPath } from '../lib/epistemic-publication.ts'

interface ReleaseCandidate {
  recordId: string
  title: string
  targetSha256: string
  ready: boolean
  blockers: string[]
  activeRelease: { releaseId: string } | null
}

interface ReleaseWorkspace {
  candidates: ReleaseCandidate[]
}

interface ReviewWorkspace {
  targets: Array<{
    recordId: string
    title: string | null
    reviewTargetSha256: string
    reviewProgress: {
      scopes: Record<string, { status: string }>
    } | null
  }>
}

const baseUrl = (process.env.MAHA_CANARY_BASE_URL ?? 'https://www.mahastrategies.com').replace(/\/$/, '')
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
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'follow',
    ...init,
    headers,
  })
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { response, body, text }
}

async function status(path: string) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'follow', cache: 'no-store' })
  await response.body?.cancel()
  return response.status
}

async function assertPublicProjection() {
  const canaryStatuses = await Promise.all(EPISTEMIC_CANARY_RECORDS.map(async (record) => ({
    recordId: record.id,
    path: epistemicRecordPath(record),
    status: await status(epistemicRecordPath(record)),
  })))
  const controlStatuses = await Promise.all(EPISTEMIC_CANARY_CONTROL_RECORDS.map(async (record) => ({
    recordId: record.id,
    path: epistemicRecordPath(record),
    status: await status(epistemicRecordPath(record)),
  })))
  const [sitemap, llms, quantumRegistry, syntheticRegistry] = await Promise.all([
    fetch(`${baseUrl}/sitemap.xml`, { cache: 'no-store' }).then((response) => response.text()),
    fetch(`${baseUrl}/llms.txt`, { cache: 'no-store' }).then((response) => response.text()),
    fetch(`${baseUrl}/knowledge/quantum-systems/registry`, { cache: 'no-store' }).then((response) => response.text()),
    fetch(`${baseUrl}/knowledge/synthetic-biology/registry`, { cache: 'no-store' }).then((response) => response.text()),
  ])

  const failedCanaries = canaryStatuses.filter((entry) => entry.status !== 200)
  const exposedControls = controlStatuses.filter((entry) => entry.status !== 404)
  const missingSitemap = EPISTEMIC_CANARY_RECORDS.filter((record) => !sitemap.includes(`${baseUrl}${epistemicRecordPath(record)}`)).map((record) => record.id)
  const missingLlms = EPISTEMIC_CANARY_RECORDS.filter((record) => !llms.includes(`${baseUrl}${epistemicRecordPath(record)}`)).map((record) => record.id)
  const leakedControls = EPISTEMIC_CANARY_CONTROL_RECORDS.filter((record) => (
    quantumRegistry.includes(record.id)
    || quantumRegistry.includes(record.title)
    || syntheticRegistry.includes(record.id)
    || syntheticRegistry.includes(record.title)
  )).map((record) => record.id)

  if (failedCanaries.length || exposedControls.length || missingSitemap.length || missingLlms.length || leakedControls.length) {
    throw new Error(JSON.stringify({ failedCanaries, exposedControls, missingSitemap, missingLlms, leakedControls }, null, 2))
  }
  return { canaryStatuses, control404Count: controlStatuses.length, sitemap: 'updated', llms: 'updated', draftMetadataLeaks: 0 }
}

let selected: ReleaseCandidate[]
if (releaseToken && releaseToken.length >= 32) {
  const workspaceResult = await request('/api/admin/epistemic-releases', releaseToken)
  if (!workspaceResult.response.ok) {
    throw new Error(`Release workspace returned ${workspaceResult.response.status}: ${workspaceResult.text}`)
  }
  const workspace = workspaceResult.body as ReleaseWorkspace
  selected = EPISTEMIC_CANARY_RECORDS.map((record) => {
    const candidate = workspace.candidates.find((entry) => entry.recordId === record.id)
    if (!candidate) throw new Error(`The frozen canary target is missing: ${record.id}`)
    return candidate
  })
} else {
  const workspaceResult = await request('/api/admin/epistemic-reviews', operationsToken!)
  if (!workspaceResult.response.ok) {
    throw new Error(`Review workspace returned ${workspaceResult.response.status}: ${workspaceResult.text}`)
  }
  const workspace = workspaceResult.body as ReviewWorkspace
  selected = EPISTEMIC_CANARY_RECORDS.map((record) => {
    const target = workspace.targets.find((entry) => entry.recordId === record.id)
    if (!target) throw new Error(`The frozen canary target is missing: ${record.id}`)
    const scopeBlockers = Object.entries(target.reviewProgress?.scopes ?? {}).flatMap(([scope, progress]) => (
      progress.status === 'approved' ? [] : [`expert-review-${progress.status}:${scope}`]
    ))
    return {
      recordId: target.recordId,
      title: target.title ?? record.title,
      targetSha256: target.reviewTargetSha256,
      ready: scopeBlockers.length === 0 && Boolean(target.reviewProgress),
      blockers: target.reviewProgress ? scopeBlockers : ['review-progress-unavailable'],
      activeRelease: null,
    }
  })
}

const blockers = selected.filter((candidate) => !candidate.ready && !candidate.activeRelease).map((candidate) => ({
  recordId: candidate.recordId,
  title: candidate.title,
  blockers: candidate.blockers,
}))

if (!publish) {
  console.log(JSON.stringify({ operation: 'readiness', publishable: blockers.length === 0, canaries: selected, blockers }, null, 2))
  process.exit(0)
}
if (process.env.EPISTEMIC_CANARY_CONFIRM !== 'PROMOTE_6_CANARIES') {
  throw new Error('EPISTEMIC_CANARY_CONFIRM must equal PROMOTE_6_CANARIES for a mutating run.')
}
if (blockers.length) {
  throw new Error(`The exact-hash review gate refused publication:\n${JSON.stringify(blockers, null, 2)}`)
}

const authority = {
  authorityId: 'authority_maha-founder-release',
  displayName: 'Maha Strategies Release Authority',
  role: 'Internal canonical knowledge release authority',
  authorizationBasis: 'The organization owner explicitly authorized this six-record production canary after all exact-hash expert-review scopes passed.',
  publicAttribution: false,
}

for (const candidate of selected.filter((entry) => !entry.activeRelease)) {
  const common = {
    recordId: candidate.recordId,
    targetSha256: candidate.targetSha256,
    canonicalVersion: '1.0.0',
    supersedesReleaseId: null,
    authority,
    publicChangeSummary: 'Initial canonical publication in the six-record production revalidation canary.',
    rationale: 'All required exact-hash review scopes passed, and the human release authority approved this bounded record for the production ISR and discovery canary.',
    idempotencyKey: `production-canary-preview-${candidate.targetSha256}`,
  }
  const preview = await request('/api/admin/epistemic-releases', releaseToken!, { method: 'POST', body: JSON.stringify({ ...common, operation: 'preview' }) })
  if (!preview.response.ok) throw new Error(`Release preview failed for ${candidate.recordId}: ${preview.text}`)
}

const releases = []
for (const candidate of selected.filter((entry) => !entry.activeRelease)) {
  const result = await request('/api/admin/epistemic-releases', releaseToken!, {
    method: 'POST',
    body: JSON.stringify({
      operation: 'publish',
      recordId: candidate.recordId,
      targetSha256: candidate.targetSha256,
      canonicalVersion: '1.0.0',
      supersedesReleaseId: null,
      authority,
      publicChangeSummary: 'Initial canonical publication in the six-record production revalidation canary.',
      rationale: 'All required exact-hash review scopes passed, and the human release authority approved this bounded record for the production ISR and discovery canary.',
      idempotencyKey: `production-canary-publish-${candidate.targetSha256}`,
    }),
  })
  if (!result.response.ok) throw new Error(`Canonical release failed for ${candidate.recordId}: ${result.text}`)
  releases.push(result.body)
}

let projection: Awaited<ReturnType<typeof assertPublicProjection>> | null = null
let projectionError: unknown = null
for (let attempt = 0; attempt < 6; attempt += 1) {
  try {
    projection = await assertPublicProjection()
    break
  } catch (error) {
    projectionError = error
    if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
}
if (!projection) throw projectionError
console.log(JSON.stringify({ operation: 'publish', released: releases.length, projection }, null, 2))
