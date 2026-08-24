import type { EpistemicRecord, EpistemicSource } from './epistemic-schema.ts'
import {
  epistemicReviewTargetHash,
  evaluatePublicationGate,
  sha256Canonical,
} from './epistemic-publication.ts'

export const EPISTEMIC_AUDIT_VERSION = 'maha-epistemic-audit/1.0' as const
export const EPISTEMIC_AUDIT_COMPILER_VERSION = 'maha-source-claim-auditor/1.0' as const

export type EpistemicAuditSeverity = 'blocker' | 'warning' | 'information'
export type EpistemicAuditStatus = 'blocked' | 'review-required' | 'automated-checks-passed'
export type SourceClaimAlignment = 'aligned-by-structure' | 'declared-partial' | 'declared-mismatch' | 'unresolved'

export interface EpistemicAuditFinding {
  code: string
  severity: EpistemicAuditSeverity
  path: string
  message: string
  evidence: string
}

export interface SourceClaimAuditLink {
  claimId: string
  sourceId: string
  alignment: SourceClaimAlignment
  locator: string
  establishes: string
  boundary: string
}

export interface EpistemicCandidateAudit {
  schemaVersion: typeof EPISTEMIC_AUDIT_VERSION
  compilerVersion: typeof EPISTEMIC_AUDIT_COMPILER_VERSION
  auditId: string
  recordId: string
  candidateSha256: string
  reviewTargetSha256: string
  status: EpistemicAuditStatus
  sourceClaimLinks: SourceClaimAuditLink[]
  findings: EpistemicAuditFinding[]
  gateReasons: string[]
  counts: {
    claims: number
    sources: number
    sourceClaimLinks: number
    blockers: number
    warnings: number
    information: number
  }
  auditedAt: string
  auditBoundary: string
  auditSha256: string
}

export const EPISTEMIC_AUTOMATED_AUDIT_BOUNDARY = 'Automated audits detect structural omissions, declared source mismatches, and a bounded set of unsupported-inference phrases. They do not read a source like a qualified reviewer, establish empirical truth, satisfy any expert-review scope, or authorize publication.'

const DECLARED_MISMATCH = [
  /no (?:supporting )?passage (?:was )?(?:located|retrievable)/i,
  /could not be matched/i,
  /does not establish (?:the|this|either|which|whether)/i,
  /do not establish (?:the|this|either|which|whether)/i,
  /not a matching source/i,
  /does not support (?:the|this|its)/i,
]

function expectedDraftWorkflowReason(reason: string): boolean {
  return reason === 'public-promotion-not-requested'
    || reason === 'review-state-not-canonical'
    || reason === 'publication-date-missing'
    || reason === 'canonical-version-missing'
    || reason === 'approval-review-missing'
    || reason.startsWith('expert-review-')
}

function structuralGateAudit(record: EpistemicRecord): { gateReasons: string[]; findings: EpistemicAuditFinding[] } {
  const gateReasons = evaluatePublicationGate(record).reasons
  return {
    gateReasons,
    findings: gateReasons.filter((reason) => !expectedDraftWorkflowReason(reason)).map((reason) => ({
      code: `candidate-integrity:${reason.split(':')[0]}`,
      severity: 'blocker' as const,
      path: reason.includes(':') ? reason.slice(reason.indexOf(':') + 1) : 'record',
      message: 'The publication schema reports a candidate-integrity defect that must be resolved before scoped review can approve this hash.',
      evidence: reason,
    })),
  }
}

const DECLARED_PARTIAL = [
  /only partially/i,
  /partial mismatch/i,
  /extends beyond/i,
  /does not establish the complete/i,
  /supports .* but not/i,
  /must (?:be )?(?:narrowed|reviewed|re-sourced|replaced)/i,
]

const UNSUPPORTED_INFERENCE_PATTERNS: ReadonlyArray<{ code: string; pattern: RegExp; message: string }> = [
  { code: 'guaranteed-outcome', pattern: /\b(?:guarantees? (?:a |the )?(?:future|success|outcome|result|return|event)|will definitely|is certain to)\b/i, message: 'The narrative asserts a guaranteed future outcome.' },
  { code: 'predictive-validity-overreach', pattern: /\b(?:proves?|scientifically validates?) (?:astrology|an astrological|the tradition|this tradition)\b/i, message: 'The narrative transfers calculation or provenance quality into predictive validation.' },
  { code: 'deterministic-personhood', pattern: /\b(?:chart|planetary placement|birth time) determines? (?:personality|character|behavio[u]?r|destiny|fate)\b/i, message: 'The narrative makes a deterministic claim about a person.' },
  { code: 'high-stakes-directive', pattern: /\b(?:medical diagnosis|legal conclusion|guaranteed investment return|trade solely on|treatment decision based solely on)\b/i, message: 'The narrative contains a prohibited high-stakes directive or conclusion.' },
  { code: 'unbounded-forecast', pattern: /\b(?:predicts? the future|forecasts? events with certainty|will outperform human experts?)\b/i, message: 'The narrative makes an unbounded forecasting-performance claim.' },
]

function sourceAlignment(source: EpistemicSource): SourceClaimAlignment {
  const text = `${source.exactLocator}\n${source.establishes}\n${source.boundary}`
  if (DECLARED_MISMATCH.some((pattern) => pattern.test(text))) return 'declared-mismatch'
  if (DECLARED_PARTIAL.some((pattern) => pattern.test(text))) return 'declared-partial'
  return 'aligned-by-structure'
}

function narrativeFields(record: EpistemicRecord): Array<{ path: string; value: string }> {
  return [
    { path: 'title', value: record.title },
    { path: 'description', value: record.description },
    { path: 'summary', value: record.summary },
    ...record.claims.map((claim, index) => ({ path: `claims[${index}].statement`, value: claim.statement })),
    ...record.sections.flatMap((section, sectionIndex) => section.paragraphs.map((paragraph, paragraphIndex) => ({
      path: `sections[${sectionIndex}].paragraphs[${paragraphIndex}]`,
      value: paragraph,
    }))),
    ...record.bridges.map((bridge, index) => ({ path: `bridges[${index}].statement`, value: bridge.statement })),
  ]
}

function sourceClaimAudit(record: EpistemicRecord): { links: SourceClaimAuditLink[]; findings: EpistemicAuditFinding[] } {
  const sources = new Map(record.sources.map((source) => [source.id, source]))
  const links: SourceClaimAuditLink[] = []
  const findings: EpistemicAuditFinding[] = []
  for (const [claimIndex, claim] of record.claims.entries()) {
    for (const sourceId of claim.sourceIds) {
      const source = sources.get(sourceId)
      if (!source) {
        links.push({ claimId: claim.id, sourceId, alignment: 'unresolved', locator: '', establishes: '', boundary: '' })
        findings.push({
          code: 'source-to-claim-unresolved',
          severity: 'blocker',
          path: `claims[${claimIndex}].sourceIds`,
          message: 'The claim references a source absent from the frozen record.',
          evidence: `${claim.id} -> ${sourceId}`,
        })
        continue
      }
      const alignment = sourceAlignment(source)
      links.push({
        claimId: claim.id,
        sourceId,
        alignment,
        locator: source.exactLocator,
        establishes: source.establishes,
        boundary: source.boundary,
      })
      if (alignment === 'declared-mismatch') {
        findings.push({
          code: 'source-to-claim-declared-mismatch',
          severity: 'blocker',
          path: `claims[${claimIndex}].sourceIds`,
          message: 'The frozen source metadata explicitly says the source does not establish the complete linked claim.',
          evidence: `${claim.id} -> ${sourceId}: ${source.boundary}`.slice(0, 1000),
        })
      } else if (alignment === 'declared-partial') {
        findings.push({
          code: 'source-to-claim-declared-partial',
          severity: 'warning',
          path: `claims[${claimIndex}].sourceIds`,
          message: 'The frozen source metadata records only partial support or a scope limitation.',
          evidence: `${claim.id} -> ${sourceId}: ${source.boundary}`.slice(0, 1000),
        })
      }
    }
  }
  return { links, findings }
}

function unsupportedInferenceAudit(record: EpistemicRecord): EpistemicAuditFinding[] {
  const findings: EpistemicAuditFinding[] = []
  for (const field of narrativeFields(record)) {
    for (const rule of UNSUPPORTED_INFERENCE_PATTERNS) {
      const match = field.value.match(rule.pattern)
      if (!match) continue
      findings.push({
        code: `unsupported-inference:${rule.code}`,
        severity: 'blocker',
        path: field.path,
        message: rule.message,
        evidence: match[0],
      })
    }
  }
  return findings
}

export function buildEpistemicCandidateAudit(record: EpistemicRecord, auditedAt = new Date()): EpistemicCandidateAudit {
  if (!Number.isFinite(auditedAt.getTime())) throw new Error('auditedAt must be valid.')
  const candidateSha256 = sha256Canonical(record)
  const reviewTargetSha256 = epistemicReviewTargetHash(record)
  const sourceAudit = sourceClaimAudit(record)
  const structuralAudit = structuralGateAudit(record)
  const findings = [...structuralAudit.findings, ...sourceAudit.findings, ...unsupportedInferenceAudit(record)]

  if (record.publication.requestedPublicPromotion || record.publication.reviewState !== 'draft') {
    findings.push({
      code: 'candidate-workflow-state-unsafe',
      severity: 'blocker',
      path: 'publication',
      message: 'A factory candidate must remain a non-promoted draft.',
      evidence: `requestedPublicPromotion=${record.publication.requestedPublicPromotion}; reviewState=${record.publication.reviewState}`,
    })
  }

  const gateReasons = structuralAudit.gateReasons
  const blockers = findings.filter((finding) => finding.severity === 'blocker').length
  const warnings = findings.filter((finding) => finding.severity === 'warning').length
  const information = findings.filter((finding) => finding.severity === 'information').length
  const status: EpistemicAuditStatus = blockers ? 'blocked' : warnings ? 'review-required' : 'automated-checks-passed'
  const auditedAtIso = auditedAt.toISOString()
  const unsigned = {
    schemaVersion: EPISTEMIC_AUDIT_VERSION,
    compilerVersion: EPISTEMIC_AUDIT_COMPILER_VERSION,
    auditId: `epiaudit_${sha256Canonical({ candidateSha256, reviewTargetSha256, auditedAt: auditedAtIso, compilerVersion: EPISTEMIC_AUDIT_COMPILER_VERSION }).slice(7, 39)}`,
    recordId: record.id,
    candidateSha256,
    reviewTargetSha256,
    status,
    sourceClaimLinks: sourceAudit.links,
    findings,
    gateReasons,
    counts: {
      claims: record.claims.length,
      sources: record.sources.length,
      sourceClaimLinks: sourceAudit.links.length,
      blockers,
      warnings,
      information,
    },
    auditedAt: auditedAtIso,
    auditBoundary: EPISTEMIC_AUTOMATED_AUDIT_BOUNDARY,
  }
  return { ...unsigned, auditSha256: sha256Canonical(unsigned) }
}
