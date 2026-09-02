import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'

/**
 * Read-only probe of the release workspace.
 *
 * Emits one sanitized row per candidate so the readiness question can be
 * answered by its actual failed predicate rather than by the single word
 * "unready". Creates nothing, ingests nothing, releases nothing.
 */

const DEFAULT_BASE_URL = 'https://www.mahastrategies.com'

function baseUrl(environment: NodeJS.ProcessEnv): string {
  const value = (environment.PRODUCTION_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  if (!/(^|\.)mahastrategies\.com$/.test(new URL(value).host)) throw new Error(`Refusing non-production host ${value}.`)
  return value
}

interface Candidate {
  recordId: string
  targetSha256: string
  ready?: boolean
  blockers?: unknown[] | null
  approvals?: unknown[] | null
  activeRelease?: { releaseId: string; targetSha256: string; status?: string } | null
}

export async function probe(environment = process.env) {
  const token = environment.EPISTEMIC_RELEASE_AUTHORITY_TOKEN?.trim()
  if (!token || Buffer.byteLength(token, 'utf8') < 32) throw new Error('EPISTEMIC_RELEASE_AUTHORITY_TOKEN must contain at least 32 bytes.')
  const origin = baseUrl(environment)
  const response = await fetch(`${origin}/api/admin/epistemic-releases`, {
    headers: { authorization: `Bearer ${token}` }, cache: 'no-store',
  })
  if (!response.ok) throw new Error(`workspace read returned ${response.status}`)
  const workspace = await response.json() as { candidates: Candidate[]; summary?: unknown }
  const candidates = workspace.candidates
  const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((r) => [r.id, r]))

  const vocabulary = new Map<string, number>()
  const rows = candidates.map((candidate) => {
    const record = records.get(candidate.recordId)
    const blockers = (candidate.blockers ?? []) as unknown[]
    for (const b of blockers) {
      const key = typeof b === 'string' ? b : JSON.stringify(b).slice(0, 120)
      vocabulary.set(key, (vocabulary.get(key) ?? 0) + 1)
    }
    return {
      recordId: candidate.recordId,
      targetSha256: candidate.targetSha256,
      ready: candidate.ready === true,
      approvalCount: (candidate.approvals ?? []).length,
      blockerCount: blockers.length,
      blockers: blockers.slice(0, 6),
      hasActiveRelease: Boolean(candidate.activeRelease),
      activeReleaseStatus: candidate.activeRelease?.status ?? null,
      activeReleaseMatchesTarget: candidate.activeRelease?.targetSha256 === candidate.targetSha256,
      localRecordPresent: Boolean(record),
      localTargetMatches: record ? epistemicReviewTargetHash(record) === candidate.targetSha256 : null,
    }
  })

  console.log(`PROBE_BEGIN ${JSON.stringify({
    totalCandidates: candidates.length,
    ready: rows.filter((r) => r.ready).length,
    withApprovals: rows.filter((r) => r.approvalCount > 0).length,
    withDeclaredBlockers: rows.filter((r) => r.blockerCount > 0).length,
    withActiveRelease: rows.filter((r) => r.hasActiveRelease).length,
    localRecordPresent: rows.filter((r) => r.localRecordPresent).length,
    localTargetMatches: rows.filter((r) => r.localTargetMatches === true).length,
    blockerVocabulary: [...vocabulary.entries()].sort((a, b) => b[1] - a[1]),
    summaryKeys: workspace.summary ? Object.keys(workspace.summary as object) : [],
    summary: workspace.summary ?? null,
    sampleRows: rows.slice(0, 2),
  })} PROBE_END`)
  // Every row, compactly, so the reconciliation can be done offline without
  // another round trip to Production.
  console.log(`ROWS_BEGIN ${JSON.stringify(rows.map((r) => [
    r.recordId, r.targetSha256, r.ready ? 1 : 0, r.approvalCount, r.blockerCount,
    r.hasActiveRelease ? 1 : 0, r.localRecordPresent ? 1 : 0, r.localTargetMatches === true ? 1 : 0,
    r.blockers.map((b) => (typeof b === 'string' ? b : 'non-string')).join('|'),
  ]))} ROWS_END`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  probe().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
}
