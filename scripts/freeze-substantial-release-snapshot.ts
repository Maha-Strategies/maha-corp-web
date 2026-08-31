import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS } from '../lib/substantial-scale-cohort.ts'

const SOURCE = 'https://www.mahastrategies.com/knowledge/epistemic-system/releases/registry.json'
const REQUIRED_SCOPES = ['boundary-adequacy', 'domain-fidelity', 'rights-and-locator', 'source-fidelity'] as const

interface RegistryApproval {
  scope: string
  reviewerKind: string
}

interface RegistryRelease {
  recordId: string
  releaseId: string
  targetSha256: string
  canonicalPath: string
  canonicalVersion: string
  releaseKind: string
  status: string
  assuranceTier: string
  releaseSha256: string
  approvals: RegistryApproval[]
}

interface RegistryPayload {
  generatedAt: string
  counts: { totalReleases: number; active: number }
  releases: RegistryRelease[]
}

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

const response = await fetch(SOURCE, {
  headers: { Accept: 'application/json' },
  cache: 'no-store',
})
if (!response.ok) throw new Error(`Release registry returned HTTP ${response.status}.`)

const raw = await response.text()
const registry = JSON.parse(raw) as RegistryPayload
if (!registry.generatedAt || !Array.isArray(registry.releases) || !registry.counts) {
  throw new Error('Release registry schema is incomplete.')
}

const cohort = new Set<string>(SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS)
const active = registry.releases.filter((release) => release.status === 'active')
const selected = active.filter((release) => cohort.has(release.recordId))
const selectedIds = new Set(selected.map((release) => release.recordId))
const missing = SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS.filter((recordId) => !selectedIds.has(recordId))
if (selected.length !== 64 || selectedIds.size !== 64 || missing.length > 0) {
  throw new Error(`Expected 64 unique active cohort releases; found ${selected.length}. Missing: ${missing.join(', ') || 'none'}.`)
}

function sanitizeRelease(release: RegistryRelease) {
  const approvalScopes = release.approvals.map((approval) => approval.scope).sort(codeUnitCompare)
  if (approvalScopes.join('|') !== [...REQUIRED_SCOPES].join('|')) {
    throw new Error(`${release.recordId}: release does not carry the four exact review scopes.`)
  }
  if (release.approvals.some((approval) => approval.reviewerKind !== 'internal-editorial')) {
    throw new Error(`${release.recordId}: release claims a reviewer tier outside the declared internal editorial protocol.`)
  }
  if (release.assuranceTier !== 'internally-reviewed-canonical') {
    throw new Error(`${release.recordId}: assurance tier is ${release.assuranceTier}.`)
  }
  return {
    recordId: release.recordId,
    releaseId: release.releaseId,
    targetSha256: release.targetSha256,
    canonicalPath: release.canonicalPath,
    canonicalVersion: release.canonicalVersion,
    releaseKind: release.releaseKind,
    approvalScopes,
    approvals: release.approvals.map((approval) => ({
      scope: approval.scope,
      reviewerKind: approval.reviewerKind,
    })).sort((left, right) => codeUnitCompare(left.scope, right.scope)),
    assuranceTier: release.assuranceTier,
    releaseSha256: release.releaseSha256,
  }
}

const activeReleases = active.map(sanitizeRelease).sort((left, right) => codeUnitCompare(left.recordId, right.recordId))
const cohortReleases = selected.map(sanitizeRelease).sort((left, right) => codeUnitCompare(left.recordId, right.recordId))

const snapshot = {
  schemaVersion: 'maha-substantial-release-snapshot/1.0',
  source: SOURCE,
  generatedAt: registry.generatedAt,
  sourceSha256: `sha256:${createHash('sha256').update(raw, 'utf8').digest('hex')}`,
  counts: {
    registryTotal: registry.counts.totalReleases,
    registryActive: registry.counts.active,
    cohortActive: cohortReleases.length,
  },
  activeRecordIds: active.map((release) => release.recordId).sort(codeUnitCompare),
  activeReleases,
  cohortReleases,
  boundary:
    'Sanitized public release evidence only. Reviewer identity, review prose, release-authority attribution, credentials, private corpus data and source passages are excluded.',
}

mkdirSync('content/substantial-pages', { recursive: true })
writeFileSync(
  'content/substantial-pages/publication-batch-6-release-snapshot.json',
  `${JSON.stringify(snapshot, null, 2)}\n`,
)

process.stdout.write(`${JSON.stringify({
  registryActive: snapshot.counts.registryActive,
  cohortActive: snapshot.counts.cohortActive,
  sourceSha256: snapshot.sourceSha256,
})}\n`)
