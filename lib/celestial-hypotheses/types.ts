/**
 * Open Science registry for celestial-timing hypotheses — domain vocabulary.
 *
 * The registry exists to make a claim *testable*, not to make it true. A
 * registration says: this named rule, from this named tradition, was declared
 * to predict this measurable outcome, and the declaration was locked before the
 * outcome was known. Nothing here upgrades a rule's empirical standing; every
 * astrological rule remains `unvalidated-tradition` on the shared claim-evidence
 * axis regardless of what any experiment returns.
 *
 * The vocabulary is deliberately domain-neutral. There is no
 * `auspiciousnessScore` and no field that presumes a direction of effect: an
 * experiment that returns an adverse result is as publishable as one that
 * returns a positive one, and the lifecycle has no state that discards it.
 */

import type { ClaimEmpiricalStatus, ClaimProvenance } from '../claim-evidence.ts'
import type { CelestialFactBundle } from '../celestial-facts.ts'

export const HYPOTHESIS_REGISTRY_VERSION = 'celestial-hypothesis-registry/0.1' as const

/**
 * The immutable lifecycle. Progress is forward-only and each transition is
 * gated; there is no `discarded`, `withdrawn`, or `failed` state, because a
 * registry that lets an inconvenient result vanish is not a registry.
 */
export const EXPERIMENT_LIFECYCLE = ['draft', 'registered', 'outcome-recorded', 'analyzed'] as const
export type ExperimentLifecycle = typeof EXPERIMENT_LIFECYCLE[number]

/**
 * Study role. This MVP registers confirmatory tests only.
 *
 * Exploratory work over historical data has a different multiplicity problem
 * and a different honesty problem — you can always find a rule that fits a past
 * series — so it belongs to a separate subsystem that does not yet exist.
 */
export const STUDY_ROLES = ['confirmatory', 'exploratory', 'replication'] as const
export type StudyRole = typeof STUDY_ROLES[number]

/**
 * Metric shapes the registry can currently measure.
 *
 * Every one of these is countable or instrument-readable. Subjective scales are
 * absent on purpose: a self-rated "how did it go" cannot be blinded to the
 * participant's knowledge of the elected moment, which is exactly the bias a
 * pre-registration is supposed to remove.
 */
export const METRIC_KINDS = ['binary', 'count', 'duration-seconds', 'ratio', 'currency-minor-units'] as const
export type MetricKind = typeof METRIC_KINDS[number]

export const METRIC_DIRECTIONS = ['higher-is-better', 'lower-is-better'] as const
export type MetricDirection = typeof METRIC_DIRECTIONS[number]

/**
 * How the outcome value reaches the registry.
 *
 * `self-reported` is rejected at registration. It is listed so the rejection is
 * explicit in the type rather than an unexplained absence.
 */
export const MEASUREMENT_SOURCES = ['instrumented', 'third-party-record', 'self-reported'] as const
export type MeasurementSource = typeof MEASUREMENT_SOURCES[number]

/**
 * Activity domains an experiment may test.
 *
 * The list is an allowlist rather than free text, because the prohibited-use
 * policy has to be checkable. Anything touching health, legal exposure,
 * financial positions, or decisions about a person is absent by construction.
 */
export const ACTIVITY_TYPES = [
  'software-release',
  'content-publication',
  'outbound-campaign-send',
  'meeting-scheduling',
  'travel-departure',
  'equipment-maintenance-window',
  'batch-job-scheduling',
] as const
export type ActivityType = typeof ACTIVITY_TYPES[number]

export interface OutcomeMetric {
  /** Stable identifier used by the analysis plan. */
  metricId: string
  /** What is counted, in plain terms. */
  name: string
  kind: MetricKind
  /** Unit of the recorded value, e.g. `deploys`, `seconds`, `USD-cents`. */
  unit: string
  direction: MetricDirection
  /** How long after the action window the outcome is measured. */
  horizonHours: number
  /** The procedure a third party would follow to obtain the same number. */
  measurementProcedure: string
  source: MeasurementSource
  /** System of record, e.g. `github-actions`, `stripe-events`. Never a person. */
  dataSourceId: string
}

/**
 * The planned null baseline.
 *
 * This is not a causal control. It fixes, in advance, which alternative moments
 * the elected moment will be compared against, so the comparison cannot be
 * chosen after the result is known. It does not balance unobserved covariates,
 * and the registry says so wherever a comparator is displayed.
 */
export interface ComparatorPolicy {
  policyVersion: 'comparator/1'
  /** Moments outside this window were never operationally available. */
  feasibleWindowStartUtc: string
  feasibleWindowEndUtc: string
  /** Number of alternative moments drawn. */
  draws: number
  /** Constraints a drawn moment must satisfy to be a fair alternative. */
  matching: {
    /** Draw only moments falling on the same weekday as the elected moment. */
    sameWeekday: boolean
    /** Inclusive local-hour band, e.g. [9, 17] for working hours. */
    localHourBand: [number, number]
    /**
     * IANA zone the local-hour band is evaluated in. Required: "the same hour
     * of the local day" is meaningless without saying whose day.
     */
    timeZone: string
    /** Free-form but declared: market, region, or site the activity belongs to. */
    geographyId: string
    /** Comparators must be for the same activity type as the registration. */
    sameActivityType: boolean
  }
  /** Explicitly unavailable intervals — freezes, holidays, outages. */
  exclusions: { startUtc: string; endUtc: string; reason: string }[]
  /**
   * Either the seed itself, or a commitment to it.
   *
   * A revealed seed makes the draw reproducible immediately. A commitment lets
   * a seed stay sealed until the outcome is in, which prevents a participant
   * steering their elected moment away from an unlucky comparator set. Exactly
   * one must be present.
   */
  seed?: string
  seedCommitmentSha256?: string
}

/**
 * A versioned, declared analysis.
 *
 * The version is part of the registration digest, so switching analysis after
 * seeing data is visible as a different experiment rather than an edit.
 */
export interface AnalysisPlan {
  planVersion: 'binary-outcome/1'
  metricId: string
  /** Rate the elected moments are declared to beat, in [0, 1]. */
  targetRate: number
  /** Observations required before any analysis runs. */
  minimumObservations: number
  /** Pre-declared stopping rule; peeking without one inflates false positives. */
  stoppingRule: string
  /**
   * How multiple comparisons are handled. Required even when the plan makes a
   * single comparison, because "we only looked once" is itself a commitment.
   */
  multiplicityPolicy: string
}

export interface CelestialHypothesis {
  /** What the rule is declared to do, in falsifiable terms. */
  statement: string
  traditionId: string
  ruleIds: string[]
  /** Rule provenance can be strong even though the rule predicts nothing. */
  ruleProvenance: ClaimProvenance
  /** Always `unvalidated-tradition`; the registry cannot raise it. */
  ruleEmpiricalStatus: Extract<ClaimEmpiricalStatus, 'unvalidated-tradition'>
}

export interface ExperimentDraft {
  experimentId: string
  /** Pseudonymous by construction; see `PARTICIPANT_PSEUDONYM_PATTERN`. */
  participantPseudonym: string
  studyRole: StudyRole
  hypothesis: CelestialHypothesis
  activityType: ActivityType
  /** The elected moment, and the window the action is committed to. */
  actionWindowStartUtc: string
  actionWindowEndUtc: string
  /** Fact bundle the elected moment was computed from. */
  factBundle: CelestialFactBundle
  factBundleId: string
  factBundleSha256: string
  compilerVersion: string
  ruleRegistryVersion: string
  metric: OutcomeMetric
  comparator: ComparatorPolicy
  analysisPlan: AnalysisPlan
  inclusionCriteria: string[]
  exclusionCriteria: string[]
  /** Target number of repetitions before analysis. */
  sampleSizeTarget: number
  /** Signed attestation that the prohibited uses were read and accepted. */
  prohibitedUseAttestation: boolean
  /** Free-form notes. Deliberately outside the digest; see `registrationCore`. */
  notes?: string
}

export interface ExperimentRegistration {
  experimentId: string
  status: Exclude<ExperimentLifecycle, 'draft'>
  registryVersion: typeof HYPOTHESIS_REGISTRY_VERSION
  /** SHA-256 over the canonical locked payload. */
  registrationSha256: string
  /** Explicit UTC instant at which the lock was taken. */
  registeredAtUtc: string
  draft: ExperimentDraft
}

export interface OutcomeRecord {
  experimentId: string
  /** Rejects a duplicate submission of the same observation. */
  idempotencyKey: string
  /** Normalized value in the metric's declared unit. */
  value: number
  /** When the underlying event occurred. */
  observedAtUtc: string
  /** When the registry pulled it from the system of record. */
  retrievedAtUtc: string
  dataSourceId: string
  /** Digest of the raw payload. The payload itself is deliberately not stored. */
  rawValueSha256: string
  outcomeSha256: string
}

export const ANALYSIS_STATUSES = ['pending', 'inconclusive', 'complete'] as const
export type AnalysisStatus = typeof ANALYSIS_STATUSES[number]

/**
 * Every terminal classification is publishable. `adverse` exists so a result
 * that points the other way has somewhere to go.
 */
export const ANALYSIS_CLASSIFICATIONS = ['positive', 'null', 'inconclusive', 'adverse'] as const
export type AnalysisClassification = typeof ANALYSIS_CLASSIFICATIONS[number]

export interface AnalysisResult {
  planVersion: AnalysisPlan['planVersion']
  status: AnalysisStatus
  classification: AnalysisClassification | null
  observations: number
  successes: number | null
  observedRate: number | null
  targetRate: number
  /** Observed rate minus target rate. Descriptive only. */
  effectSize: number | null
  /**
   * Whether an exact binomial test *could* be run on this data. The test is not
   * run and no p-value is produced in this version.
   */
  exactBinomialEligible: boolean
  /** Why the result is at this status. Always populated. */
  rationale: string
  analysisSha256: string
  computedAtUtc: string
}

export interface ExperimentProvenanceBundle {
  experimentId: string
  registryVersion: typeof HYPOTHESIS_REGISTRY_VERSION
  status: ExperimentLifecycle
  registrationSha256: string | null
  registeredAtUtc: string | null
  factBundleId: string
  factBundleSha256: string
  compilerVersion: string
  ruleRegistryVersion: string
  traditionId: string
  ruleIds: string[]
  passageIds: string[]
  sourceIds: string[]
  comparator: { policyVersion: string; draws: number; seedCommitmentSha256: string }
  analysisPlanVersion: AnalysisPlan['planVersion']
  analysisPlanSha256: string
  outcomeSha256: string[]
  analysisSha256: string | null
  /** Reproduced verbatim on every provenance read. */
  epistemicBoundary: string
}

/**
 * The sentence the product is required to be able to say, and the sentences it
 * is required never to say. Asserted in tests against every surface.
 */
export const REGISTRY_EPISTEMIC_BOUNDARY =
  'This is a pre-registered test of a named celestial-timing hypothesis. Registration and analysis plan were locked before the measured outcome. It does not establish that astrology predicts anything.'

export const COMPARATOR_BOUNDARY =
  'The comparator defines the planned null baseline only. It fixes which alternative moments the elected moment is compared against so the comparison cannot be chosen after the fact. It does not by itself control for confounding.'

/** Pseudonymous participant ids only. A value containing `@` is rejected. */
export const PARTICIPANT_PSEUDONYM_PATTERN = /^pseudo_[a-z0-9]{8,64}$/
export const EXPERIMENT_ID_PATTERN = /^exp_[a-z0-9]{16,48}$/
export const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/
