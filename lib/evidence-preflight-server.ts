import { createHmac } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import type { EvidencePreflightInput, EvidencePreflightResult } from './evidence-preflight-contract.ts'

export class EvidencePreflightConfigurationError extends Error {
  constructor() {
    super('Evidence preflight privacy ledger is not configured.')
    this.name = 'EvidencePreflightConfigurationError'
  }
}

function secret(): string {
  const value = process.env.MPS_PUBLIC_AUDIT_RATE_LIMIT_SECRET
  if (!value) throw new EvidencePreflightConfigurationError()
  return value
}

function keyed(label: string, value: string): string {
  return `sha256:${createHmac('sha256', secret()).update(`evidence-preflight/1.0\n${label}\n${value}`).digest('hex')}`
}

export function evidencePreflightRequestHash(visitorHash: string, requestId: string): string {
  return keyed('request', `${visitorHash}\n${requestId}`)
}

export function evidencePreflightPayloadHmac(visitorHash: string, input: EvidencePreflightInput): string {
  return keyed('payload', `${visitorHash}\n${canonicalJson(input)}`)
}

export function evidencePreflightTelemetry(result: EvidencePreflightResult) {
  return {
    claimCount: result.summary.claimCount,
    inputCharCount: result.assessments.reduce((total, entry) => total + entry.claim.length + (entry.excerpt?.length ?? 0), 0),
    doiCount: result.assessments.filter((entry) => entry.source.kind === 'doi').length,
    urlCount: result.assessments.filter((entry) => entry.source.kind === 'url').length,
    readyCount: result.summary.readyForSourceInspection,
    blockedCount: result.summary.blockedBeforeSourceInspection,
  }
}
