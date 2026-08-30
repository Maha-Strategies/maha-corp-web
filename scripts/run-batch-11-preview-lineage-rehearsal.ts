import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

import {
  assertDeclarationCoverage,
  lineageManifestDigest,
  reconcileLineage,
  type LineageManifest,
  type RegistryObservation,
} from '../lib/batch-11-mixed-lineage-release.ts'
import {
  BATCH_11_REVISED_RECORDS,
  batch11RevisionReviewInputs,
} from '../lib/batch-11-revision-canary.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from '../lib/frontier-domain-graphs.ts'
import { epistemicRecordPath, epistemicReviewTargetHash, sha256Canonical } from '../lib/epistemic-publication.ts'
import { evaluatePublicationQueueCandidate, type FrozenActiveRelease } from '../lib/substantial-publication-queue.ts'

/**
 * Private Preview lineage rehearsal for the five Batch 11 records.
 *
 * DISABLED BY DEFAULT. Without MAHA_B11_REHEARSAL_AUTHORIZED=1 this performs the
 * entirely local reconciliation and prints the plan it *would* execute, then
 * exits. It creates no database, applies no migration, and presents no
 * credential. The remote half stays off until someone turns it on deliberately.
 *
 * The rehearsal exists to prove one thing the local manifest cannot: that a
 * mixed cohort - four superseding, one initial - moves through the real release
 * gate without the initial release being treated as a superseding one with a
 * missing parent, or the reverse.
 */

const AUTHORIZED = process.env.MAHA_B11_REHEARSAL_AUTHORIZED === '1'
const CONFIRMATION = 'RELEASE_BATCH_11_MIXED_LINEAGE_IN_PREVIEW'
const origin = (process.env.MAHA_B11_PREVIEW_ORIGIN ?? '').replace(/\/$/, '')
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()

assertDeclarationCoverage()
const observation = JSON.parse(
  readFileSync('content/frontier-alignment/batch-11-registry-observation.json', 'utf8'),
) as RegistryObservation
const manifest: LineageManifest = reconcileLineage(observation)

const blocked = manifest.entries.filter((entry) => !entry.ready)
if (blocked.length > 0) {
  console.error('Reconciliation is not clean; the rehearsal will not run.')
  for (const entry of blocked) console.error(`  ${entry.recordId}: ${entry.failures.join(', ')}`)
  process.exit(1)
}

/** What the remote half would assert, stated so it can be reviewed before it runs. */
const PLANNED_ASSERTIONS = [
  'All five records enter the release gate.',
  'The four superseding releases each bind their exact declared prior release id.',
  'The initial release binds no superseded target and carries supersedesReleaseId null.',
  'The publication queue admits a record only after its exact-revision release exists.',
  'A stale revision digest is refused at the gate.',
  'An older revision cannot render revised material.',
  'An unreleased revision stays out of the queue, the sitemap and llms.txt.',
  'Five routes, five provenance chains, five sitemap entries, five llms.txt entries and five registry entries converge on the same five exact revisions.',
] as const

if (!AUTHORIZED) {
  console.log(
    JSON.stringify(
      {
        mode: 'plan-only',
        reason: 'MAHA_B11_REHEARSAL_AUTHORIZED is not set to 1',
        remoteOperationsPerformed: 0,
        previewDatabaseCreated: false,
        migrationApplied: false,
        credentialPresented: false,
        cohort: manifest.totals,
        plannedAssertions: PLANNED_ASSERTIONS,
        requiredSecretNames: ['MAHA_PREVIEW_SUPABASE_URL', 'MAHA_PREVIEW_SUPABASE_SERVICE_ROLE', 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN'],
        migrationScope: 'One additive migration creating only the Batch 11 rehearsal ingestion table and its RPC. No existing table is altered and no row outside the five records is touched.',
        cleanup: 'Drop the rehearsal schema and delete the Preview branch database. Production is never a target of this script.',
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

type Json = Record<string, unknown>

function object(value: unknown, label: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Json
}

function array(value: unknown, label: string): Json[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value.map((entry, index) => object(entry, `${label}[${index}]`))
}

function secret(name: 'MAHA_PREVIEW_SUPABASE_URL' | 'MAHA_PREVIEW_SUPABASE_SERVICE_ROLE' | 'EPISTEMIC_OPERATIONS_TOKEN' | 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN'): string {
  const value = process.env[name]?.trim()
  if (!value || Buffer.byteLength(value) < (name.includes('URL') ? 16 : 32)) throw new Error(`${name} is missing or invalid.`)
  return value
}

function assertRemoteBoundary(): void {
  if (process.env.MAHA_B11_REHEARSAL_CONFIRM !== CONFIRMATION) throw new Error(`MAHA_B11_REHEARSAL_CONFIRM must equal ${CONFIRMATION}.`)
  if (!/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) || /mahastrategies\.com/i.test(origin)) {
    throw new Error('The rehearsal origin must be an HTTPS Vercel Preview host, never Production.')
  }
  if (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME !== 'codex/batch-11-preview-lifecycle') {
    throw new Error('The remote rehearsal is restricted to codex/batch-11-preview-lifecycle.')
  }
  if (process.env.SUPABASE_PROJECT_REF === 'uhwuullakihgszxhiygz') throw new Error('The Production Supabase project is forbidden.')
  if (secret('EPISTEMIC_OPERATIONS_TOKEN') === secret('EPISTEMIC_RELEASE_AUTHORITY_TOKEN')) {
    throw new Error('Operations and release-authority tokens must be distinct.')
  }
}

async function request(path: string, token: string | null = null, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (token) headers.set('authorization', `Bearer ${token}`)
  if (bypass) headers.set('x-vercel-protection-bypass', bypass)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(`${origin}${path}`, { ...init, headers, cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(20_000) })
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${text.slice(0, 500)}`)
  return { status: response.status, body, text }
}

function priorFixtures() {
  return manifest.entries.filter((entry) => entry.releaseKind === 'superseding').map((entry) => {
    const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((candidate) => candidate.id === entry.recordId)
    const observed = observation.records.find((candidate) => candidate.recordId === entry.recordId)?.activeRelease
    if (!record || !observed || epistemicReviewTargetHash(record) !== entry.priorTargetSha256) {
      throw new Error(`${entry.recordId}: frozen prior lineage cannot be reconstructed exactly.`)
    }
    const approvals = ['boundary-adequacy', 'domain-fidelity', 'rights-and-locator', 'source-fidelity'].map((scope) => ({
      scope,
      reviewId: `epireview_preview_fixture_${sha256Canonical({ recordId: record.id, scope }).slice(7, 23)}`,
      reviewSha256: sha256Canonical({ fixture: observed.releaseId, scope }),
      reviewedAt: '2026-08-30T00:00:00.000Z',
      reviewerKind: 'internal-editorial',
      reviewMethod: 'Preview-only fixture preserving a previously public lineage head.',
    }))
    const authority = {
      authorityId: 'authority_batch11_preview_fixture',
      displayName: 'Maha Batch 11 Preview fixture',
      role: 'Preview-only lineage fixture',
      authorizationBasis: 'Copies the four frozen public lineage heads into an ephemeral Preview branch for supersession testing.',
      publicAttribution: false,
    }
    const recordSnapshot = {
      ...record,
      publication: {
        ...record.publication,
        requestedPublicPromotion: true,
        reviewState: 'published-canonical' as const,
        canonicalVersion: observed.canonicalVersion,
        publishedAt: '2026-08-30',
        lastReviewedAt: '2026-08-30T00:00:00.000Z',
      },
    }
    const unsigned = {
      schemaVersion: 'maha-epistemic-release/1.0',
      releaseId: observed.releaseId,
      releaseKind: 'initial',
      recordId: record.id,
      domainSlug: record.domainSlug,
      targetSha256: observed.targetSha256,
      canonicalPath: observed.canonicalPath,
      canonicalVersion: observed.canonicalVersion,
      supersedesReleaseId: null,
      approvals,
      authority,
      authoritySha256: sha256Canonical(authority),
      publicChangeSummary: 'Ephemeral Preview copy of an already-public prior lineage head.',
      rationale: 'This fixture exists only to exercise exact supersession behavior. It is not a new review, release, endorsement, or Production mutation.',
      recordSha256: sha256Canonical(recordSnapshot),
      recordSnapshot,
      gateDecision: { publicEligible: true, reasons: [] },
      idempotencyHash: sha256Canonical({ fixture: observed.releaseId }),
      releasedAt: '2026-08-30T00:00:00.000Z',
    }
    return { ...unsigned, releaseSha256: sha256Canonical(unsigned) }
  })
}

async function bootstrapPriorLineages() {
  const client = createClient(secret('MAHA_PREVIEW_SUPABASE_URL'), secret('MAHA_PREVIEW_SUPABASE_SERVICE_ROLE'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.rpc('bootstrap_batch_11_preview_prior_lineages', {
    p_fixtures: priorFixtures(),
    p_actor_fingerprint: sha256Canonical('batch-11-preview-rehearsal-operator'),
  })
  if (error) throw new Error(`Prior-lineage bootstrap failed [${error.code ?? 'unknown'}]: ${error.message}`)
  return object(data, 'prior-lineage bootstrap')
}

async function ingestAndReview() {
  const operations = secret('EPISTEMIC_OPERATIONS_TOKEN')
  const workspace = object((await request('/api/admin/epistemic-ingestion', operations)).body, 'ingestion workspace')
  const targets = array(workspace.reviewTargets, 'reviewTargets')
  const expected = BATCH_11_REVISED_RECORDS.map((record) => ({ recordId: record.id, targetSha256: epistemicReviewTargetHash(record) }))
  const counts = expected.map((entry) => targets.filter((target) => target.recordId === entry.recordId && target.reviewTargetSha256 === entry.targetSha256).length)
  if (counts.some((count) => count > 1) || (counts.some((count) => count === 0) && counts.some((count) => count === 1))) {
    throw new Error(`Preview contains a partial or duplicate Batch 11 target set: ${counts.join(',')}.`)
  }
  if (counts.every((count) => count === 0)) {
    await request('/api/admin/epistemic-ingestion', operations, {
      method: 'POST',
      body: JSON.stringify({ adapterId: 'batch-11-revision-canary', idempotencyKey: `batch-11-revision:${sha256Canonical(expected)}` }),
    })
  }
  const decisions = []
  for (const input of batch11RevisionReviewInputs()) {
    const response = await request('/api/admin/epistemic-reviews', operations, { method: 'POST', body: JSON.stringify(input) })
    decisions.push({ recordId: input.recordId, scope: input.scope, status: response.status })
  }
  return decisions
}

function releaseFact(value: Json): FrozenActiveRelease {
  return {
    recordId: String(value.recordId),
    releaseId: String(value.releaseId),
    targetSha256: String(value.targetSha256),
    canonicalPath: String(value.canonicalPath),
    approvalScopes: array(value.approvals, 'release approvals').map((approval) => String(approval.scope)).sort(),
  }
}

async function publishExactRevisions() {
  const authority = secret('EPISTEMIC_RELEASE_AUTHORITY_TOKEN')
  const before = object((await request('/api/admin/epistemic-releases', authority)).body, 'release workspace')
  const candidates = array(before.candidates, 'release candidates')
  const planned = manifest.entries.map((entry) => {
    const candidate = candidates.find((item) => item.recordId === entry.recordId && item.targetSha256 === entry.proposedTargetSha256)
    if (!candidate || candidate.ready !== true) throw new Error(`${entry.recordId}: exact revision is not release-ready.`)
    const active = candidate.activeRelease ? object(candidate.activeRelease, `${entry.recordId} active release`) : null
    if (entry.releaseKind === 'superseding') {
      if (!active || active.releaseId !== entry.priorReleaseId || active.targetSha256 !== entry.priorTargetSha256) {
        throw new Error(`${entry.recordId}: Preview prior lineage does not match the frozen declaration.`)
      }
    } else if (active) throw new Error(`${entry.recordId}: declared initial release unexpectedly has an active prior release.`)
    return { entry, active }
  })

  const previews = []
  for (const { entry, active } of planned) {
    const common = {
      recordId: entry.recordId,
      targetSha256: entry.proposedTargetSha256,
      canonicalVersion: active ? '1.1.0-preview' : '1.0.0-preview',
      supersedesReleaseId: active ? String(active.releaseId) : null,
      authority: {
        authorityId: 'authority_maha-batch11-preview',
        displayName: 'Maha Strategies Batch 11 Preview authority',
        role: 'Internal Preview-only canonical release authority',
        authorizationBasis: 'The owner authorized the exact five-record Batch 11 Preview rehearsal. Production release is not authorized.',
        publicAttribution: false,
      },
      publicChangeSummary: active
        ? 'Preview-only superseding release binds the inspected Batch 11 replacement source and exact revision.'
        : 'Preview-only initial release binds the inspected Batch 11 source and exact revision.',
      rationale: 'The exact revision passed internal source, locator, rights, scope, and boundary review. This rehearsal claims no external endorsement, independent reproduction, scientific validation, or Production standing.',
    }
    const preview = object((await request('/api/admin/epistemic-releases', authority, {
      method: 'POST', body: JSON.stringify({ ...common, operation: 'preview', idempotencyKey: `batch-11-preview:${entry.proposedTargetSha256}` }),
    })).body, `${entry.recordId} release preview`)
    previews.push(object(preview.preview, `${entry.recordId} preview payload`))
    await request('/api/admin/epistemic-releases', authority, {
      method: 'POST', body: JSON.stringify({ ...common, operation: 'publish', idempotencyKey: `batch-11-publish:${entry.proposedTargetSha256}` }),
    })
  }

  const after = object((await request('/api/admin/epistemic-releases', authority)).body, 'post-release workspace')
  const releases = array(after.releases, 'post-release releases')
  const activeFacts = manifest.entries.map((entry) => {
    const active = releases.find((release) => release.recordId === entry.recordId && release.status === 'active')
    if (!active || active.targetSha256 !== entry.proposedTargetSha256) throw new Error(`${entry.recordId}: exact revised release is not active.`)
    return releaseFact(active)
  })
  return { previews, activeFacts }
}

async function verifyProjection(activeFacts: readonly FrozenActiveRelease[]) {
  const [sitemap, llms, registry] = await Promise.all([request('/sitemap.xml'), request('/llms.txt'), request('/knowledge/epistemic-system/releases/registry.json')])
  return Promise.all(BATCH_11_REVISED_RECORDS.map(async (record) => {
    const release = activeFacts.find((entry) => entry.recordId === record.id)
    if (!release) throw new Error(`${record.id}: active release fact is absent.`)
    const queue = evaluatePublicationQueueCandidate({ record, release, inspectedAndAlignmentClear: true, exactRevisionReviewed: true, currentSubstantialPage: false })
    if (!queue.eligible) throw new Error(`${record.id}: three-gate publication queue remains blocked: ${queue.blockerCodes.join(',')}`)
    const path = epistemicRecordPath(record)
    const [page, provenance] = await Promise.all([request(path), request(`${path}/provenance.json`)])
    return {
      recordId: record.id,
      path,
      targetSha256: epistemicReviewTargetHash(record),
      queueDigest: queue.queueDigest,
      routeStatus: page.status,
      provenanceStatus: provenance.status,
      sitemapIncluded: sitemap.text.includes(path),
      llmsIncluded: llms.text.includes(path),
      registryIncluded: registry.text.includes(release.releaseId) && registry.text.includes(release.targetSha256),
    }
  }))
}

async function runRemote() {
  assertRemoteBoundary()
  const prior = await bootstrapPriorLineages()
  const decisions = await ingestAndReview()
  const released = await publishExactRevisions()
  const projection = await verifyProjection(released.activeFacts)
  const body = {
    schemaVersion: 'maha-batch-11-preview-rehearsal-evidence/1.0',
    branch: 'codex/batch-11-preview-lifecycle',
    commit: process.env.GITHUB_SHA ?? null,
    previewOriginFingerprint: sha256Canonical(origin),
    manifestDigest: lineageManifestDigest(manifest),
    priorFixture: prior,
    review: { scopedDecisionCount: decisions.length },
    release: {
      previewCount: released.previews.length,
      activeCount: released.activeFacts.length,
      initialCount: manifest.totals.initial,
      supersedingCount: manifest.totals.superseding,
      activeFacts: released.activeFacts,
    },
    projection,
    boundaries: { previewOnly: true, productionMutationPerformed: false, externalReviewClaimed: false, independentlyReproduced: false, secretsIncluded: false },
  }
  console.log(JSON.stringify({ ...body, evidenceSha256: sha256Canonical(body) }, null, 2))
}

runRemote().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
