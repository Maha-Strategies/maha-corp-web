// Generates lib/x402/offer-examples.ts from the real engines, so the published
// Bazaar examples are outputs the service actually produces.
import { writeFileSync } from 'node:fs'

import { evaluateContextPack, parseContextEvaluationRequest } from '../lib/context-pack-evaluator.ts'
import { parseMpsAuditResponse } from '../lib/mps-audit-engine.ts'
import { auditInputHash, validateAuditPassage } from '../lib/mps-audit-engine.ts'
import { assembleResearchIntakeEvidencePack, parseResearchIntakeInput } from '../lib/research-intake-evidence-pack.ts'

const DEEP_INPUT = {
  clientRequestId: 'req_rag_release_eval_001',
  task: 'Find the release condition and rollback trigger while removing duplicate operational background.',
  tokenBudget: 128,
  documents: [
    { id: 'release-notes', title: 'Release notes', text: 'Release may proceed after the security owner attaches credential-rotation evidence. The production canary passed in every region.\n\nRoutine notes cover staffing, dashboards, meeting cadence, maintenance calendars, regional handoffs, historical capacity, and documentation formatting.' },
    { id: 'rollback-runbook', title: 'Rollback runbook', text: 'Rollback if API errors exceed 2 percent for five minutes or payment failures breach the alert threshold. Restore the last-known-good deployment before reopening traffic.\n\nRoutine notes cover staffing, dashboards, meeting cadence, maintenance calendars, regional handoffs, historical capacity, and documentation formatting.' },
  ],
  provenance: 'compact', scoring: 'bm25', budgetMode: 'guaranteed',
  requiredEvidence: [
    { evidenceId: 'release-gate', sourceId: 'release-notes', text: 'Release may proceed after the security owner attaches credential-rotation evidence.' },
    { evidenceId: 'rollback-trigger', sourceId: 'rollback-runbook', text: 'Rollback if API errors exceed 2 percent for five minutes' },
    // Deliberately a span from the low-ranking filler paragraph. It is dropped
    // by the budget, and the example publishes that rather than hiding it: a
    // buyer needs to see what an omitted span looks like before paying.
    { evidenceId: 'handoff-note', sourceId: 'release-notes', text: 'regional handoffs, historical capacity, and documentation formatting' },
  ],
}

const result = evaluateContextPack(parseContextEvaluationRequest(DEEP_INPUT))

const deepOutput = {
  version: '0.1.0',
  offerId: 'deep-context-evaluation',
  evaluationId: 'ctxeval_4f1c8a2b6d5e47c0913a7e2f8b46d5c1',
  clientRequestId: result.clientRequestId,
  // Discovery identifiers are fixtures, not runtime IDs. Keep this value
  // stable so adding a new generated example cannot invalidate an existing
  // paid offer's declaration digest.
  contextPack: { ...result.contextPack, packId: 'ctxpack_d0dc187dd43a403d8aef472de5689408' },
  evidence: result.evidence,
  metrics: result.metrics,
  inputHash: result.inputHash,
  outputHash: result.outputHash,
  warnings: result.warnings,
  warningCodes: ['model_neutral_token_estimates', 'extractive_selection_not_verification', 'exact_span_retention_not_accuracy'],
  retentionBoundaries: {
    ...result.contextPack.retentionBoundaries,
    evidenceRetentionMeasurement: 'exact_span_match',
    factualAccuracyAssessed: false,
    answerQualityAssessed: false,
  },
  sourceTextStored: false,
  compiledContextStored: false,
  requiredEvidenceTextStored: false,
}

// MPS: a fixed model response, parsed by the real parser so the example is a
// shape the engine actually emits.
const PASSAGE = 'Soil microbial diversity has declined sharply across intensively farmed land. A 2019 meta-analysis attributed most of the loss to tillage frequency. Studies show that cover cropping restores diversity within three seasons, though the mechanism remains an open question.'
const passage = validateAuditPassage(PASSAGE)
const MODEL_JSON = JSON.stringify({
  claims: [
    { excerpt: 'Soil microbial diversity has declined sharply across intensively farmed land', tag: 'SOURCED', rationale: 'Well-documented in soil science literature a reader could cite.', action: 'cite' },
    { excerpt: 'A 2019 meta-analysis attributed most of the loss to tillage frequency', tag: 'UNVERIFIED', rationale: 'Names a specific study without an identifiable citation.', action: 'verify' },
    { excerpt: 'Studies show that cover cropping restores diversity within three seasons', tag: 'UNVERIFIED', rationale: 'Studies show without a named study is always unverified.', action: 'cite' },
    { excerpt: 'though the mechanism remains an open question', tag: 'BOUNDARY', rationale: 'States a limit of current knowledge.', action: 'none' },
  ],
})

const claims = parseMpsAuditResponse(MODEL_JSON, passage)
const counts: Record<string, number> = {}
for (const claim of claims) counts[claim.tag] = (counts[claim.tag] ?? 0) + 1

const mpsOutput = {
  version: '0.1',
  offerId: 'mps-autonomous-audit',
  auditId: 'audit_9b3f71ac52d84e6fa0c8d1e37b5942af',
  retrievalToken: 'mpsrt_Q7xK2mN8pR4vT6yB1cD3fG5hJ9kL0nM2qS4uW6zA8eC',
  clientRequestId: 'req_mps_soil_001',
  inputHash: auditInputHash(passage),
  status: 'completed',
  idempotentReplay: false,
  audit: { version: '0.1', claims, counts },
  warnings: [
    'Provenance statuses are model-assigned triage, not factual certification.',
    'This is not legal advice and not a substitute for human editorial review before publication.',
  ],
  warningCodes: ['automated_triage_not_certification', 'not_legal_advice', 'not_human_verification', 'model_assigned_status'],
  retentionBoundaries: {
    fullPassageStored: false,
    verbatimExcerptsRetained: true,
    claimVerificationPerformed: false,
    legalAdviceProvided: false,
    humanReviewPerformed: false,
  },
  fullPassageStored: false,
  verbatimExcerptsRetained: true,
  retentionNote: 'The complete submitted passage is not retained. Audit results retain short verbatim claim excerpts, classifications, rationales, hashes, and operational metadata.',
}

const mpsInput = { clientRequestId: 'req_mps_soil_001', text: PASSAGE }

const researchInput = parseResearchIntakeInput({
  clientRequestId: 'req_research_intake_001',
  question: 'What evidence would be needed to decide whether a governed AI gateway pilot is sufficiently scoped?',
  intendedAudience: 'AI platform and risk owners',
  intendedDecision: 'Whether to commission a bounded human research engagement',
  sourceHandling: { classification: 'public_or_synthetic_non_sensitive', anthropicProcessingAuthorized: true },
  sections: [
    { sourceId: 'platform-note', sectionId: 'requirements', title: 'Platform requirements', text: PASSAGE },
    { sourceId: 'risk-note', sectionId: 'limits', title: 'Risk limits', text: 'The proposed gateway may reduce context volume by 40 percent. No production benchmark has established that saving. The approval owner and acceptable failure threshold remain open questions.' },
  ],
})
const secondPassage = researchInput.sections[1]!.text
const secondClaims = parseMpsAuditResponse(JSON.stringify({ claims: [
  { excerpt: 'The proposed gateway may reduce context volume by 40 percent', tag: 'UNVERIFIED', rationale: 'The quantified projection has no supplied benchmark.', action: 'verify' },
  { excerpt: 'No production benchmark has established that saving', tag: 'BOUNDARY', rationale: 'Explicitly states the limit of the supplied evidence.', action: 'none' },
  { excerpt: 'The approval owner and acceptable failure threshold remain open questions', tag: 'BOUNDARY', rationale: 'Identifies unresolved governance inputs.', action: 'none' },
] }), secondPassage)
const researchPack = assembleResearchIntakeEvidencePack(researchInput, [
  { mps_version: '0.1', input_hash: auditInputHash(passage), claims },
  { mps_version: '0.1', input_hash: auditInputHash(secondPassage), claims: secondClaims },
])
const researchOutput = {
  packId: 'intake_9b3f71ac52d84e6fa0c8d1e37b5942af',
  retrievalToken: 'rirt_Q7xK2mN8pR4vT6yB1cD3fG5hJ9kL0nM2qS4uW6zA8eC',
  clientRequestId: researchInput.clientRequestId,
  inputHash: researchPack.inputHash,
  status: 'completed',
  idempotentReplay: false,
  retrievalPath: '/api/v1/research/intake/intake_9b3f71ac52d84e6fa0c8d1e37b5942af',
  progress: { sectionCount: 2, sectionsCompleted: 2, sectionsFailed: 0, totalModelCalls: 2 },
  pack: researchPack,
}

const banner = `// GENERATED by scripts/generate-x402-offer-examples.ts -- do not hand-edit.
//
// These are outputs the real engines produced for the inputs above them. They
// are published verbatim as the Bazaar examples, and a test re-validates them
// against their declared schemas. Hand-writing them would make the example a
// second, unexecuted implementation of the compiler -- and it is the one that
// would be wrong.
`

const body = `${banner}
export const DEEP_CONTEXT_EXAMPLE_INPUT = ${JSON.stringify(DEEP_INPUT, null, 2)} as const

export const DEEP_CONTEXT_EXAMPLE_OUTPUT = ${JSON.stringify(deepOutput, null, 2)} as const

export const MPS_AUDIT_EXAMPLE_INPUT = ${JSON.stringify(mpsInput, null, 2)} as const

export const MPS_AUDIT_EXAMPLE_OUTPUT = ${JSON.stringify(mpsOutput, null, 2)} as const

export const RESEARCH_INTAKE_EXAMPLE_INPUT = ${JSON.stringify(researchInput, null, 2)} as const

export const RESEARCH_INTAKE_EXAMPLE_OUTPUT = ${JSON.stringify(researchOutput, null, 2)} as const
`

writeFileSync(process.argv[2], body)
console.log('retention percent:', result.metrics.requiredEvidenceRetentionPercent)
console.log('evidence:', JSON.stringify(result.evidence, null, 2))
console.log('claim count:', claims.length, 'counts:', counts)
