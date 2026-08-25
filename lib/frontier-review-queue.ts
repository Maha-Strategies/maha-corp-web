import type { EpistemicExpertReview } from './epistemic-review.ts'
import { buildExpertReviewProgress } from './epistemic-review.ts'
import {
  FRONTIER_CANARY_RECORDS,
  FRONTIER_CANARY_VERSION,
} from './frontier-canonicalization.ts'
import {
  FRONTIER_DOMAIN_GRAPH_RECORDS_BY_DOMAIN,
  FRONTIER_EPISTEMIC_DOMAINS,
} from './frontier-domain-graphs.ts'
import { epistemicRecordPath, epistemicReviewTargetHash } from './epistemic-publication.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'
import type { FrontierSourceVerificationReport } from './frontier-source-verification.ts'

export const FRONTIER_REVIEW_QUEUE_VERSION = 'frontier-review-queues/1.0' as const

export interface FrontierQueueTarget {
  recordId: string
  reviewTargetSha256: string
  sourcePublicPath: string
  candidateSnapshot?: EpistemicRecord
  gateDecision: { publicEligible?: boolean; reasons?: string[] }
}

const workflowReasons = new Set([
  'public-promotion-not-requested',
  'review-state-not-canonical',
  'publication-date-missing',
  'canonical-version-missing',
  'approval-review-missing',
])

export function buildFrontierReviewQueues(
  targets: readonly FrontierQueueTarget[],
  reviews: readonly EpistemicExpertReview[],
  report: FrontierSourceVerificationReport | null,
  activeRecordIds: ReadonlySet<string> = new Set(),
) {
  const canaryIds = new Set(FRONTIER_CANARY_RECORDS.map((record) => record.id))
  const verificationBySource = new Map(report?.results.map((result) => [result.sourceId, result]) ?? [])
  const lanes = FRONTIER_EPISTEMIC_DOMAINS.map((domain) => {
    const records = FRONTIER_DOMAIN_GRAPH_RECORDS_BY_DOMAIN[domain.slug].map((record) => {
      const expectedTargetSha256 = epistemicReviewTargetHash(record)
      const target = targets.find((candidate) => candidate.recordId === record.id && candidate.reviewTargetSha256 === expectedTargetSha256)
      const sourceResults = record.sources.map((source) => verificationBySource.get(source.id) ?? null)
      const sourceVerified = sourceResults.length > 0 && sourceResults.every((result) => result?.status === 'verified')
      const structuralBlockers = (target?.gateDecision.reasons ?? []).filter((reason) => !workflowReasons.has(reason) && !reason.startsWith('expert-review-'))
      const progress = target?.candidateSnapshot ? buildExpertReviewProgress(target.candidateSnapshot, reviews) : null
      const scopeStatuses = progress?.scopes ?? {}
      const approvedScopes = Object.values(scopeStatuses).filter((scope) => scope.status === 'approved').length
      const canonical = activeRecordIds.has(record.id)
      const state = canonical ? 'canonical'
        : !target ? 'target-missing'
          : !sourceVerified ? 'source-blocked'
            : structuralBlockers.length ? 'structural-blocked'
              : approvedScopes === 4 ? 'release-ready'
                : approvedScopes > 0 ? 'review-in-progress'
                  : 'review-ready'
      return {
        recordId: record.id,
        title: record.title,
        publicPath: epistemicRecordPath(record),
        expectedTargetSha256,
        targetPresent: Boolean(target),
        cohort: canaryIds.has(record.id) ? 'canary' as const : 'control' as const,
        sourceIds: record.sources.map((source) => source.id),
        sourceVerification: sourceResults.map((result) => result ? ({ sourceId: result.sourceId, status: result.status, metadataStatus: result.metadataStatus, locatorStatus: result.locatorStatus }) : null),
        sourceVerified,
        structuralBlockers,
        reviewScopes: scopeStatuses,
        approvedScopes,
        state,
      }
    })
    return {
      domainSlug: domain.slug,
      domainName: domain.name,
      records,
      summary: {
        records: records.length,
        canary: records.filter((record) => record.cohort === 'canary').length,
        controls: records.filter((record) => record.cohort === 'control').length,
        sourceVerified: records.filter((record) => record.sourceVerified).length,
        releaseReady: records.filter((record) => record.state === 'release-ready').length,
        canonical: records.filter((record) => record.state === 'canonical').length,
      },
    }
  })
  const all = lanes.flatMap((lane) => lane.records)
  return {
    schemaVersion: FRONTIER_REVIEW_QUEUE_VERSION,
    canaryVersion: FRONTIER_CANARY_VERSION,
    sourceReport: report ? { reportId: report.reportId, reportSha256: report.reportSha256, verifiedAt: report.verifiedAt, summary: report.summary } : null,
    lanes,
    summary: {
      domains: lanes.length,
      records: all.length,
      canary: all.filter((record) => record.cohort === 'canary').length,
      controls: all.filter((record) => record.cohort === 'control').length,
      exactTargets: all.filter((record) => record.targetPresent).length,
      sourceVerified: all.filter((record) => record.sourceVerified).length,
      releaseReady: all.filter((record) => record.state === 'release-ready').length,
      canonical: all.filter((record) => record.state === 'canonical').length,
    },
    boundary: 'Queues are grouped by domain and preserve canary/control assignment. Machine verification and internal review states remain explicit; queue readiness is not external endorsement or publication.',
  }
}
