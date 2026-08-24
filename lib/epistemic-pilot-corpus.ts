import { ADAPTED_EPISTEMIC_CANDIDATES } from './epistemic-adapters.ts'
import { sha256Canonical } from './epistemic-publication.ts'

export const EPISTEMIC_PHASE4_PILOT_VERSION = 'maha-phase4-pilot/1.0' as const
export const EPISTEMIC_PHASE4_PILOT_DATE = '2026-08-24' as const

const PUBLICATION_ONLY_REASONS = new Set([
  'public-promotion-not-requested',
  'review-state-not-canonical',
  'publication-date-missing',
  'canonical-version-missing',
  'approval-review-missing',
])

const selection = [
  ['semiconductor', 'direct-to-silicon-liquid-cooling', 'A commercially relevant systems record with a small, concrete evidence-completion surface.'],
  ['semiconductor', 'ion-implantation-and-annealing', 'A process-mechanism record that tests condition, equipment, and transfer boundaries.'],
  ['semiconductor', 'plasma-etch-and-pattern-transfer', 'A process-mechanism record with material scope and metrology dependencies.'],
  ['semiconductor', 'semiconductor-metrology-and-defect-inspection', 'A measurement record that tests uncertainty and instrument-specific claims.'],
  ['mathematics', 'bayesian-updating', 'A formal concept needed by later evidence updating and calibration work.'],
  ['mathematics', 'calibration-and-reliability', 'A method record that connects prediction quality to measurable reliability.'],
  ['mathematics', 'causal-inference', 'A boundary-critical concept separating association, intervention, and causal claims.'],
  ['mathematics', 'formal-logic-and-rule-compilation', 'A method record that tests executable formalization without transferring truth from syntax.'],
  ['astronomy', 'orbits-gravity-and-ephemerides', 'A mechanistic record joining observation, physical model, and reproducible calculation.'],
  ['astronomy', 'telescopes-detectors-and-angular-resolution', 'An instrumentation record with explicit resolution and measurement limits.'],
  ['astronomy', 'cosmic-microwave-background-and-lambda-cdm', 'A model-comparison record with inferential and uncertainty boundaries.'],
  ['astronomy', 'exoplanet-detection-and-confirmation', 'A method record that distinguishes detection, validation, and confirmation.'],
  ['religion', 'textual-authority', 'A methodological record separating documentary authority from empirical truth.'],
  ['religion', 'translation-and-semantic-range', 'A source-fidelity record that makes edition and translation disagreement material.'],
  ['religion', 'historical-evidence', 'A methodological record separating historical inference from theology and lived practice.'],
  ['religion', 'empirical-claims-and-study-design', 'A comparison boundary for claims that can and cannot enter empirical testing.'],
  ['neuromorphic-biocomputing', 'in-memory-and-memristive-computing', 'A hardware record that tests benchmark and substrate-transfer claims.'],
  ['neuromorphic-biocomputing', 'molecular-and-dna-computing', 'A non-silicon mechanism record with laboratory and scaling boundaries.'],
  ['neuromorphic-biocomputing', 'physical-reservoir-computing', 'A cross-substrate record requiring careful task and performance equivalence.'],
  ['neuromorphic-biocomputing', 'synthetic-biological-circuits', 'A biological-computation record with strong safety and readiness boundaries.'],
] as const

const candidates = new Map(
  ADAPTED_EPISTEMIC_CANDIDATES.map((candidate) => [`${candidate.adapterId}:${candidate.record.slug}`, candidate]),
)

export const EPISTEMIC_PHASE4_PILOT_ENTRIES = selection.map(([domainSlug, slug, selectionRationale], index) => {
  const candidate = candidates.get(`${domainSlug}:${slug}`)
  if (!candidate) throw new Error(`Phase 4 pilot record is missing from the adapted corpus: ${domainSlug}/${slug}`)
  const sourceBlockers = candidate.gateDecision.reasons.filter(
    (reason) => !PUBLICATION_ONLY_REASONS.has(reason) && !reason.startsWith('expert-review-'),
  )
  return {
    sequence: index + 1,
    recordId: candidate.record.id,
    domainSlug: candidate.record.domainSlug,
    title: candidate.record.title,
    recordKind: candidate.record.recordKind,
    slug: candidate.record.slug,
    sourcePublicPath: candidate.sourcePublicPath,
    initialReviewTargetSha256: candidate.reviewTargetSha256,
    initialSourceBlockers: sourceBlockers,
    selectionRationale,
  }
})

const manifest = {
  schemaVersion: EPISTEMIC_PHASE4_PILOT_VERSION,
  generatedAt: `${EPISTEMIC_PHASE4_PILOT_DATE}T00:00:00.000Z`,
  objective: 'Operate the complete source-completion, exact-hash review, and separately authorized release lifecycle on a bounded cross-domain corpus.',
  selectionPolicy: 'Four records per migrated domain, chosen for methodological coverage, commercial relevance, and a tractable but non-zero evidence-completion surface. Selection does not imply truth, quality, or publication approval.',
  entries: EPISTEMIC_PHASE4_PILOT_ENTRIES,
}

export const EPISTEMIC_PHASE4_PILOT_MANIFEST = {
  ...manifest,
  manifestSha256: sha256Canonical(manifest),
  counts: {
    records: EPISTEMIC_PHASE4_PILOT_ENTRIES.length,
    domains: new Set(EPISTEMIC_PHASE4_PILOT_ENTRIES.map((entry) => entry.domainSlug)).size,
    sourceBlockers: EPISTEMIC_PHASE4_PILOT_ENTRIES.reduce((total, entry) => total + entry.initialSourceBlockers.length, 0),
  },
} as const

export const EPISTEMIC_PHASE4_PILOT_RECORD_IDS = new Set(
  EPISTEMIC_PHASE4_PILOT_ENTRIES.map((entry) => entry.recordId),
)

export function getEpistemicPhase4PilotEntry(recordId: string) {
  return EPISTEMIC_PHASE4_PILOT_ENTRIES.find((entry) => entry.recordId === recordId)
}

export const EPISTEMIC_PHASE4_PILOT_BOUNDARY = 'Pilot selection creates a bounded operating backlog. It is not an endorsement, expert decision, empirical validation, or authorization to publish any selected record.'
