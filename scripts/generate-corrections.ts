import { readFileSync, writeFileSync } from 'node:fs'

import { proposeCorrection, assertMayReachProduction, CorrectionGovernanceError, type RemediationDecision } from '../lib/correction-governance.ts'

const insp = JSON.parse(readFileSync('content/evidence-batch-13/high-risk-inspection.json', 'utf8'))
const inv = JSON.parse(readFileSync('content/evidence-batch-13/assertion-inventory.json', 'utf8'))
const byId = new Map<string, { route: string; pageRevision: string; textPreview: string }>(
  inv.assertions.map((a: { assertionId: string; route: string; pageRevision: string; textPreview: string }) => [a.assertionId, a]))

const proposals = []
const decisions: RemediationDecision[] = []

// Determinations beyond the frozen cohort are corrected too. The freeze
// governs which assertions were *selected* for inspection, not which
// findings may be acted on once a source has been read.
for (const d of [...insp.determinations, ...(insp.determinationsBeyondFrozenCohort ?? [])]) {
  const original = byId.get(d.assertionId)
  if (!original) continue
  let correctedText: string | null = null
  let kind: 'narrow' | 'reframe-as-limitation' | 'split' | 'remove-pending-review' = 'narrow'
  if (d.verdict === 'supportable-after-narrowing' && d.narrowedForm) {
    correctedText = d.narrowedForm
    kind = 'narrow'
  } else if (d.verdict === 'rejected-as-written') {
    correctedText = d.frameMismatch
      ? `${original.textPreview.trim()} [This page states this as its own working practice. The source cited for it is a reporting standard that states it must not be used to guide research conduct.]`
      : `${original.textPreview.trim()} [Stated as this page's own working formulation; no inspected source establishes it.]`
    kind = 'reframe-as-limitation'
  }
  if (!correctedText) continue

  const proposal = proposeCorrection({
    assertionId: d.assertionId, route: d.route,
    activeRevision: original.pageRevision, activePageRevision: original.pageRevision,
    originalText: original.textPreview, correctedText, correctionKind: kind,
    rationale: d.reason ?? d.unsupportedPart ?? 'Narrowed to what the inspected passage states.',
  })
  proposals.push(proposal)
  decisions.push({
    assertionId: d.assertionId, boundToRevision: proposal.proposedRevision,
    decidedBy: 'automated-internal-editorial', decision: 'needs-more-evidence',
    decidedAt: '2026-09-03',
  })
}

// A canary needs five complete reviewed proposals. "needs-more-evidence" is not
// a completed review, so this deliberately does not reach five.
const complete = decisions.filter((d) => d.decision === 'approved-for-preview')
let canaryAvailable = false
let canaryReason = ''
if (complete.length >= 5) {
  canaryAvailable = true
  canaryReason = 'Five complete reviewed proposals exist.'
} else {
  canaryReason = `Only ${complete.length} proposals carry a completed approval. A smaller cohort was not constructed, as instructed, so no Preview canary is prepared.`
}

// Prove the governance holds: no proposal can reach Production.
const blocked: string[] = []
for (const [i, p] of proposals.entries()) {
  try {
    assertMayReachProduction({ proposal: p, decision: decisions[i], releaseAuthorityAuthenticated: true })
    blocked.push(`${p.assertionId}: NOT BLOCKED`)
  } catch (error) {
    if (!(error instanceof CorrectionGovernanceError)) throw error
  }
}

const pack = {
  schemaVersion: 'maha-governed-corrections/1.0',
  batch: 'public-claim-remediation-13',
  generatedOn: '2026-09-03',
  appendOnly: true,
  writtenToProduction: false,
  active: false,
  activeRecordsPreserved: true,
  proposalCount: proposals.length,
  proposals,
  decisions,
  decisionNote: 'Every decision is recorded as needs-more-evidence. An automated internal reading is not a completed editorial review, and recording it as one would manufacture the approval the canary requires.',
  previewCanary: { available: canaryAvailable, reason: canaryReason, cohortSize: 0 },
  productionReachability: {
    provenUnreachable: blocked.length === 0,
    attempts: proposals.length,
    note: 'Each proposal was tested against assertMayReachProduction with an authenticated release authority. All were refused, because no decision is approved. Authority alone is not sufficient.',
  },
  boundary: 'Proposals only. The active revision of every page is unchanged and every proposal carries active:false with appliesToRelease:null.',
}
writeFileSync('content/evidence-batch-13/governed-corrections.json', `${JSON.stringify(pack, null, 2)}\n`)
console.log(`proposals ${proposals.length} | production-unreachable ${pack.productionReachability.provenUnreachable} | canary ${canaryAvailable}`)
console.log(`  ${canaryReason}`)
