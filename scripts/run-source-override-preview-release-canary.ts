import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { epistemicRecordPath, epistemicReviewTargetHash, sha256Canonical } from '../lib/epistemic-publication.ts'
import {
  PRIVATE_REVISION_RELEASE_CANARY,
  SOURCE_OVERRIDE_REVISED_RECORDS,
  SOURCE_OVERRIDE_REVISION_AUDITS,
  sourceOverrideRevisionCanaryReviewInputs,
} from '../lib/source-override-revision-canary.ts'
import { publishBatch2Record } from '../lib/substantial-page-publication-batch-2.ts'
import {
  evaluatePublicationQueueCandidate,
  type FrozenActiveRelease,
} from '../lib/substantial-publication-queue.ts'

type Json = Record<string, unknown>

const CONFIRMATION = 'RELEASE_5_SOURCE_OVERRIDE_REVISIONS_IN_PREVIEW'
const origin = (process.env.SOURCE_OVERRIDE_PREVIEW_ORIGIN ?? '').replace(/\/$/, '')
const evidencePath = process.env.SOURCE_OVERRIDE_PREVIEW_EVIDENCE_PATH?.trim()
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()

function object(value: unknown, label: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Json
}

function array(value: unknown, label: string): Json[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value.map((entry, index) => object(entry, `${label}[${index}]`))
}

function secret(name: 'EPISTEMIC_OPERATIONS_TOKEN' | 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN'): string {
  const value = process.env[name]?.trim()
  if (!value || Buffer.byteLength(value) < 32) throw new Error(`${name} must contain at least 32 bytes.`)
  return value
}

function assertPreviewBoundary(): void {
  if (!/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) throw new Error('The canary origin must be an HTTPS Vercel Preview host.')
  if (/mahastrategies\.com/i.test(origin)) throw new Error('Production hosts are forbidden.')
  if (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME !== 'codex/corrected-revision-preview-release') {
    throw new Error('The remote canary is restricted to codex/corrected-revision-preview-release.')
  }
  if (process.env.SOURCE_OVERRIDE_PREVIEW_CANARY_CONFIRM !== CONFIRMATION) {
    throw new Error(`SOURCE_OVERRIDE_PREVIEW_CANARY_CONFIRM must equal ${CONFIRMATION}.`)
  }
  const operations = secret('EPISTEMIC_OPERATIONS_TOKEN')
  const authority = secret('EPISTEMIC_RELEASE_AUTHORITY_TOKEN')
  if (operations === authority) throw new Error('Operations and release-authority credentials must be distinct.')
}

async function request(path: string, token: string | null = null, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (token) headers.set('authorization', `Bearer ${token}`)
  if (bypass) headers.set('x-vercel-protection-bypass', bypass)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(`${origin}${path}`, { ...init, headers, cache: 'no-store', redirect: 'follow' })
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${text.slice(0, 600)}`)
  return { status: response.status, body, text }
}

function releaseFact(release: Json): FrozenActiveRelease {
  const approvals = array(release.approvals, 'release.approvals')
  return {
    recordId: String(release.recordId),
    releaseId: String(release.releaseId),
    targetSha256: String(release.targetSha256),
    canonicalPath: String(release.canonicalPath),
    approvalScopes: approvals.map((approval) => String(approval.scope)).sort(),
  }
}

function staticRevisionEvidence() {
  return SOURCE_OVERRIDE_REVISED_RECORDS.map((record) => {
    const audit = SOURCE_OVERRIDE_REVISION_AUDITS.find((entry) => entry.recordId === record.id)
    const canary = PRIVATE_REVISION_RELEASE_CANARY.find((entry) => entry.recordId === record.id)
    if (!audit || !canary) throw new Error(`${record.id}: merged-main revision evidence is incomplete.`)
    const targetSha256 = epistemicReviewTargetHash(record)
    if (targetSha256 !== audit.revisedRecordRevisionSha256 || targetSha256 !== canary.targetSha256) {
      throw new Error(`${record.id}: merged-main exact revision drifted.`)
    }
    return {
      recordId: record.id,
      targetSha256,
      canonicalPath: epistemicRecordPath(record),
      releaseKind: canary.releaseKind,
      priorReleaseId: canary.priorReleaseId,
      priorReleaseTargetSha256: canary.priorReleaseTargetSha256,
      auditSha256: audit.auditSha256,
      canarySha256: canary.canarySha256,
    }
  })
}

export function classifyExistingFrozenTargets(
  reviewTargets: readonly Json[],
  revisions: readonly { recordId: string; targetSha256: string }[],
): 'absent' | 'complete' {
  const exactCounts = revisions.map((revision) => reviewTargets.filter((target) => {
    if (target.recordId !== revision.recordId || target.reviewTargetSha256 !== revision.targetSha256) return false
    const gateDecision = target.gateDecision
    if (!gateDecision || typeof gateDecision !== 'object' || Array.isArray(gateDecision)) return false
    const reasons = (gateDecision as Json).reasons
    return Array.isArray(reasons) && !reasons.some((reason) => String(reason).startsWith('source-content-inspection-missing:'))
  }).length)
  if (exactCounts.every((count) => count === 0)) return 'absent'
  if (exactCounts.every((count) => count === 1)) return 'complete'
  throw new Error(`The Preview ingestion ledger contains a partial or duplicate exact-revision cohort: ${exactCounts.join(',')}.`)
}

async function ingestAndReview(operationsToken: string) {
  const revisions = staticRevisionEvidence()
  const setDigest = sha256Canonical(revisions.map(({ recordId, targetSha256 }) => ({ recordId, targetSha256 })))
  const existing = await request('/api/admin/epistemic-ingestion', operationsToken)
  const existingBody = object(existing.body, 'epistemic ingestion workspace')
  const frozenState = classifyExistingFrozenTargets(
    array(existingBody.reviewTargets, 'epistemic ingestion review targets'),
    revisions,
  )
  const ingestion = frozenState === 'complete'
    ? existing
    : await request('/api/admin/epistemic-ingestion', operationsToken, {
      method: 'POST',
      body: JSON.stringify({
        adapterId: 'source-override-revision-canary',
        idempotencyKey: `source-override-revisions-v2:${setDigest}`,
      }),
    })
  const decisions = []
  for (const input of sourceOverrideRevisionCanaryReviewInputs()) {
    const response = await request('/api/admin/epistemic-reviews', operationsToken, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    decisions.push({ recordId: input.recordId, scope: input.scope, status: response.status })
  }
  return { ingestionStatus: ingestion.status, ingestionReused: frozenState === 'complete', decisions }
}

async function workspace(releaseToken: string) {
  return object((await request('/api/admin/epistemic-releases', releaseToken)).body, 'release workspace')
}

function exactCandidate(workspaceBody: Json, recordId: string, targetSha256: string): Json {
  const candidates = array(workspaceBody.candidates, 'release workspace candidates')
  const matches = candidates.filter((entry) => entry.recordId === recordId && entry.targetSha256 === targetSha256)
  if (matches.length !== 1) throw new Error(`${recordId}: expected exactly one current exact-revision release candidate, found ${matches.length}.`)
  return matches[0]
}

function commonReleaseInput(entry: ReturnType<typeof staticRevisionEvidence>[number], active: Json | null) {
  return {
    recordId: entry.recordId,
    targetSha256: entry.targetSha256,
    canonicalVersion: active ? '1.1.0-preview' : '1.0.0-preview',
    supersedesReleaseId: active ? String(active.releaseId) : null,
    authority: {
      authorityId: 'authority_maha-preview-release',
      displayName: 'Maha Strategies Preview Release Authority',
      role: 'Internal Preview-only canonical release authority',
      authorizationBasis: 'The owner authorized this exact five-record Preview canary after inspected-source alignment, exact-revision review, and public-projection gates passed. Production release is not authorized.',
      publicAttribution: false,
    },
    publicChangeSummary: active
      ? 'Preview-only superseding release binds the inspected replacement source and exact revised record.'
      : 'Preview-only initial release binds the inspected replacement source and exact revised record.',
    rationale: 'The exact revision has one inspected replacement source, an exact locator, an eight-dimension revision audit, and four scoped internal-editorial approvals. External endorsement, independent reproduction, scientific validation, and Production release are not claimed.',
  }
}

async function previewAndPublish(releaseToken: string) {
  const entries = staticRevisionEvidence()
  const before = await workspace(releaseToken)
  const planned: Array<{ entry: (typeof entries)[number]; active: Json | null; candidate: Json }> = []

  for (const entry of entries) {
    const candidate = exactCandidate(before, entry.recordId, entry.targetSha256)
    const active = candidate.activeRelease ? object(candidate.activeRelease, `${entry.recordId} active release`) : null
    if (active?.targetSha256 === entry.targetSha256) continue
    if (entry.releaseKind === 'superseding') {
      if (!active) throw new Error(`${entry.recordId}: Preview lacks the required prior active release for a superseding canary.`)
      if (active.targetSha256 !== entry.priorReleaseTargetSha256) throw new Error(`${entry.recordId}: Preview prior release target does not match the frozen lineage.`)
    } else if (active) {
      throw new Error(`${entry.recordId}: initial-release target already has a different active Preview release.`)
    }
    if (candidate.ready !== true) throw new Error(`${entry.recordId}: exact target is not release-ready: ${JSON.stringify(candidate.blockers)}`)
    planned.push({ entry, active, candidate })
  }

  const previews = []
  for (const { entry, active } of planned) {
    const common = commonReleaseInput(entry, active)
    const response = await request('/api/admin/epistemic-releases', releaseToken, {
      method: 'POST',
      body: JSON.stringify({
        ...common,
        operation: 'preview',
        idempotencyKey: `source-override-preview:${entry.targetSha256}`,
      }),
    })
    const body = object(response.body, `${entry.recordId} release preview`)
    const preview = object(body.preview, `${entry.recordId} preview release`)
    previews.push({ recordId: entry.recordId, releaseKind: preview.releaseKind, targetSha256: preview.targetSha256 })
  }

  const published = []
  for (const { entry, active } of planned) {
    const common = commonReleaseInput(entry, active)
    const response = await request('/api/admin/epistemic-releases', releaseToken, {
      method: 'POST',
      body: JSON.stringify({
        ...common,
        operation: 'publish',
        idempotencyKey: `source-override-publish:${entry.targetSha256}`,
      }),
    })
    const body = object(response.body, `${entry.recordId} published release`)
    published.push(releaseFact(object(body.release, `${entry.recordId} release`)))
  }

  const registryBody = object((await request('/knowledge/epistemic-system/releases/registry.json')).body, 'public release registry')
  const registryReleases = array(registryBody.releases, 'public release registry releases')
  const activeFacts = entries.map((entry) => {
    const matches = registryReleases.filter((release) => release.recordId === entry.recordId && release.status === 'active')
    if (matches.length !== 1) throw new Error(`${entry.recordId}: expected one active Preview release after publication, found ${matches.length}.`)
    const active = matches[0]
    if (active.targetSha256 !== entry.targetSha256) throw new Error(`${entry.recordId}: exact revised release is not active after publication.`)
    return releaseFact(active)
  })
  return { previews, published, activeFacts }
}

async function projectionEvidence(activeFacts: readonly FrozenActiveRelease[]) {
  const [sitemap, llms, registry] = await Promise.all([
    request('/sitemap.xml'),
    request('/llms.txt'),
    request('/knowledge/epistemic-system/releases/registry.json'),
  ])
  const rows = []
  for (const record of SOURCE_OVERRIDE_REVISED_RECORDS) {
    const release = activeFacts.find((entry) => entry.recordId === record.id)
    if (!release) throw new Error(`${record.id}: active release fact is missing.`)
    const compiled = publishBatch2Record(record)
    const queue = evaluatePublicationQueueCandidate({
      record,
      release,
      inspectedAndAlignmentClear: true,
      exactRevisionReviewed: release.approvalScopes.length === 4,
      currentSubstantialPage: false,
    })
    if (!queue.eligible) throw new Error(`${record.id}: post-release publication queue remains blocked: ${queue.blockerCodes.join(', ')}`)
    const path = epistemicRecordPath(record)
    const [page, provenance] = await Promise.all([request(path), request(`${path}/provenance.json`)])
    rows.push({
      recordId: record.id,
      targetSha256: epistemicReviewTargetHash(record),
      path,
      releaseId: release.releaseId,
      releaseKind: PRIVATE_REVISION_RELEASE_CANARY.find((entry) => entry.recordId === record.id)?.releaseKind,
      queueDigest: queue.queueDigest,
      substantialContractDigest: compiled.contractDigest,
      routeStatus: page.status,
      provenanceStatus: provenance.status,
      sitemapIncluded: sitemap.text.includes(path),
      llmsIncluded: llms.text.includes(path),
      releaseRegistryIncluded: registry.text.includes(release.releaseId) && registry.text.includes(release.targetSha256),
    })
  }
  return rows
}

export async function runSourceOverridePreviewReleaseCanary() {
  assertPreviewBoundary()
  const revisions = staticRevisionEvidence()
  const noReleaseQueue = SOURCE_OVERRIDE_REVISED_RECORDS.map((record) => evaluatePublicationQueueCandidate({
    record,
    release: undefined,
    inspectedAndAlignmentClear: true,
    exactRevisionReviewed: true,
    currentSubstantialPage: false,
  }))
  if (noReleaseQueue.some((entry) => entry.eligible || !entry.blockerCodes.includes('active-canonical-release-missing'))) {
    throw new Error('The publication queue did not fail closed before canonical release.')
  }
  const operationsToken = secret('EPISTEMIC_OPERATIONS_TOKEN')
  const releaseToken = secret('EPISTEMIC_RELEASE_AUTHORITY_TOKEN')
  const review = await ingestAndReview(operationsToken)
  const lifecycle = await previewAndPublish(releaseToken)
  const projection = await projectionEvidence(lifecycle.activeFacts)
  const body = {
    schemaVersion: 'maha-source-override-preview-release-evidence/1.0',
    branch: 'codex/corrected-revision-preview-release',
    commit: process.env.GITHUB_SHA ?? null,
    previewOriginFingerprint: sha256Canonical(origin),
    exactRevisions: revisions,
    preReleaseQueue: noReleaseQueue,
    review: { ingestionStatus: review.ingestionStatus, ingestionReused: review.ingestionReused, scopedDecisionCount: review.decisions.length },
    release: {
      previewCount: lifecycle.previews.length,
      publishedThisRunCount: lifecycle.published.length,
      activeCount: lifecycle.activeFacts.length,
      supersedingCount: lifecycle.activeFacts.filter((fact) => revisions.find((entry) => entry.recordId === fact.recordId)?.releaseKind === 'superseding').length,
      initialCount: lifecycle.activeFacts.filter((fact) => revisions.find((entry) => entry.recordId === fact.recordId)?.releaseKind === 'initial').length,
      activeFacts: lifecycle.activeFacts,
    },
    projection,
    boundaries: {
      previewOnly: true,
      productionMutationPerformed: false,
      externalReviewClaimed: false,
      independentReproductionClaimed: false,
      secretsIncluded: false,
    },
  }
  const evidence = { ...body, evidenceSha256: sha256Canonical(body) }
  if (evidencePath) {
    mkdirSync(dirname(evidencePath), { recursive: true, mode: 0o700 })
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
  }
  console.log(JSON.stringify({
    schemaVersion: evidence.schemaVersion,
    exactRevisionCount: evidence.exactRevisions.length,
    scopedDecisionCount: evidence.review.scopedDecisionCount,
    previewCount: evidence.release.previewCount,
    publishedThisRunCount: evidence.release.publishedThisRunCount,
    activeCount: evidence.release.activeCount,
    supersedingCount: evidence.release.supersedingCount,
    initialCount: evidence.release.initialCount,
    routes200: evidence.projection.filter((entry) => entry.routeStatus === 200).length,
    sitemapIncluded: evidence.projection.filter((entry) => entry.sitemapIncluded).length,
    llmsIncluded: evidence.projection.filter((entry) => entry.llmsIncluded).length,
    evidenceSha256: evidence.evidenceSha256,
    boundary: evidence.boundaries,
  }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSourceOverridePreviewReleaseCanary().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
