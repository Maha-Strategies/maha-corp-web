import {
  EPISTEMIC_FACTORY_JOB_VERSION,
  EPISTEMIC_FACTORY_MCP_VERSION,
  parseEpistemicFactoryRecord,
  type EpistemicFactoryQueueJob,
} from './epistemic-factory-tools.ts'
import { epistemicReviewTargetHash, sha256Canonical } from './epistemic-publication.ts'

export const EPISTEMIC_FACTORY_WORKER_VERSION = 'maha-epistemic-factory-worker/0.1' as const

export function verifyEpistemicFactoryQueueJob(job: EpistemicFactoryQueueJob) {
  if (job.schemaVersion !== EPISTEMIC_FACTORY_JOB_VERSION || job.operation !== 'draft-node' || job.status !== 'queued') {
    throw new Error('The factory job contract is unsupported.')
  }
  const compilation = job.compilation
  if (compilation.schemaVersion !== EPISTEMIC_FACTORY_MCP_VERSION || compilation.canonicalStatus !== 'noncanonical-draft') {
    throw new Error('The factory compilation is not a noncanonical draft.')
  }
  const record = parseEpistemicFactoryRecord(compilation.candidateSnapshot)
  if (sha256Canonical(record) !== compilation.candidateSha256) throw new Error('The candidate digest does not match the queued record.')
  if (epistemicReviewTargetHash(record) !== compilation.reviewTargetSha256) throw new Error('The review-target digest does not match the queued record.')
  if (compilation.automatedAudit.candidateSha256 !== compilation.candidateSha256
    || compilation.automatedAudit.reviewTargetSha256 !== compilation.reviewTargetSha256) {
    throw new Error('The automated audit is not bound to the queued candidate.')
  }
  const unsignedCompilation = Object.fromEntries(Object.entries(compilation).filter(([key]) => key !== 'compilationSha256'))
  if (sha256Canonical(unsignedCompilation) !== compilation.compilationSha256 || job.payloadSha256 !== compilation.compilationSha256) {
    throw new Error('The compilation digest does not match the queued payload.')
  }
  const unsignedJob = Object.fromEntries(Object.entries(job).filter(([key]) => key !== 'jobSha256'))
  if (sha256Canonical(unsignedJob) !== job.jobSha256) throw new Error('The job digest does not match its snapshot.')
  return {
    schemaVersion: EPISTEMIC_FACTORY_WORKER_VERSION,
    jobId: job.jobId,
    recordId: compilation.recordId,
    candidateSha256: compilation.candidateSha256,
    reviewTargetSha256: compilation.reviewTargetSha256,
    auditStatus: compilation.automatedAudit.status,
    conflictLeadCount: compilation.conflictLeads.length,
    bridgeContractBlockers: compilation.bridgeContracts.filter((entry) => entry.status === 'blocked').length,
    canonical: false,
    sitemapEligible: false,
    processedAt: new Date().toISOString(),
    boundary: 'Worker completion creates one immutable noncanonical draft target. It does not approve, publish, revalidate, or add a page to the sitemap.',
  }
}
