import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { canonicalCelestialFactBundle } from '../lib/celestial-facts.ts'
import { AnalysisUnavailable, runAnalysis } from '../lib/celestial-hypotheses/analysis.ts'
import { canonicalJson, digestOf, isExplicitUtcInstant } from '../lib/celestial-hypotheses/canonical.ts'
import { comparatorSeedCommitment, generateComparators } from '../lib/celestial-hypotheses/comparator.ts'
import { OutcomeRejected, buildOutcomeRecord, horizonComplete } from '../lib/celestial-hypotheses/outcomes.ts'
import * as outcomeModule from '../lib/celestial-hypotheses/outcomes.ts'
import { buildProvenanceBundle, publicView } from '../lib/celestial-hypotheses/provenance.ts'
import { RegistrationRejected, parseExperimentDraft, registerExperiment, registrationDigest, validateDraft } from '../lib/celestial-hypotheses/registration.ts'
import { buildStructuredVerdict, structuredVerdictDigest } from '../lib/celestial-hypotheses/verdict.ts'
import {
  REGISTRY_EPISTEMIC_BOUNDARY,
  type ExperimentDraft,
  type OutcomeRecord,
} from '../lib/celestial-hypotheses/types.ts'
import { buildLocalFactBundle } from '../lib/local-fact-bundle.ts'
import { ASTROLOGY_VERSION } from '../lib/astrology-version.ts'

const NOW = () => new Date('2026-09-01T00:00:00Z')

function validDraft(overrides: Partial<ExperimentDraft> = {}): ExperimentDraft {
  const factBundle = buildLocalFactBundle({
    instant: new Date('2026-09-02T05:00:00Z'),
    latitudeDegrees: 23.1765,
    longitudeDegrees: 75.7885,
    elevationMeters: 494,
  })
  const draft = {
    experimentId: 'exp_a1b2c3d4e5f60718',
    participantPseudonym: 'pseudo_7fa91c22',
    studyRole: 'confirmatory',
    hypothesis: {
      statement: 'Software releases begun during the Bava karana complete without rollback at a higher rate than the historical baseline.',
      traditionId: 'vedic-jyotisha',
      ruleIds: ['bs-muhurta-bava-favourable'],
      ruleProvenance: 'restates-source',
      ruleEmpiricalStatus: 'unvalidated-tradition',
    },
    activityType: 'software-release',
    actionWindowStartUtc: '2026-09-02T04:00:00Z',
    actionWindowEndUtc: '2026-09-02T06:00:00Z',
    factBundle,
    factBundleId: factBundle.bundleId,
    factBundleSha256: digestOf(factBundle),
    compilerVersion: 'interpretation-compiler/0.1',
    ruleRegistryVersion: ASTROLOGY_VERSION,
    metric: {
      metricId: 'rollback_free_release',
      name: 'Releases completing without rollback',
      kind: 'binary',
      unit: 'releases',
      direction: 'higher-is-better',
      horizonHours: 72,
      measurementProcedure: 'Read the deployment record from the CI system and mark 1 when no rollback job ran within the horizon.',
      source: 'instrumented',
      dataSourceId: 'github-actions',
    },
    comparator: {
      policyVersion: 'comparator/1',
      feasibleWindowStartUtc: '2026-09-01T00:00:00Z',
      feasibleWindowEndUtc: '2026-10-01T00:00:00Z',
      draws: 8,
      matching: { sameWeekday: true, localHourBand: [9, 17], timeZone: 'Asia/Kolkata', geographyId: 'in-south', sameActivityType: true },
      exclusions: [{ startUtc: '2026-09-10T00:00:00Z', endUtc: '2026-09-12T00:00:00Z', reason: 'Declared change freeze.' }],
      seed: 'seed-2026-09-registry-trial',
    },
    analysisPlan: {
      planVersion: 'binary-outcome/1',
      metricId: 'rollback_free_release',
      targetRate: 0.8,
      minimumObservations: 20,
      stoppingRule: 'Analyse once at exactly 20 observations and not before, regardless of interim counts.',
      multiplicityPolicy: 'One pre-declared comparison against a single metric; no subgroup analysis is planned.',
    },
    inclusionCriteria: ['Production releases of the primary web application.'],
    exclusionCriteria: ['Hotfixes released outside the declared window.'],
    sampleSizeTarget: 20,
    prohibitedUseAttestation: true,
    ...overrides,
  } as ExperimentDraft
  draft.verdict = overrides.verdict ?? buildStructuredVerdict({
    activityType: draft.activityType,
    traditionId: draft.hypothesis.traditionId,
    applicableRuleIds: draft.hypothesis.ruleIds,
    factBundleId: draft.factBundleId,
    factBundleSha256: draft.factBundleSha256,
    ruleRegistryVersion: draft.ruleRegistryVersion,
    metricId: draft.metric.metricId,
    metricDirection: draft.metric.direction,
    targetRate: draft.analysisPlan.targetRate,
  })
  return draft
}

function registered(draft = validDraft()) {
  return registerExperiment(draft, { now: NOW })
}

// ---------------------------------------------------------------- canonicalisation

test('canonical JSON matches the existing fact-bundle canonicalisation', () => {
  // The registry's digests only mean the same thing as the fact layer's if the
  // two canonicalisers agree. Asserted rather than assumed.
  const bundle = {
    schemaVersion: 'celestial-facts/0.1', bundleId: 'cel_x', recordedAt: '2026-01-01T00:00:00Z',
    time: { utcInstant: '2026-01-01T00:00:00Z', ephemerisTimeScale: 'TT', leapSecondSourceId: 'iers-bulletins-live' },
    observers: [], facts: [],
  } as unknown as Parameters<typeof canonicalCelestialFactBundle>[0]
  assert.equal(canonicalJson(bundle), canonicalCelestialFactBundle(bundle))
})

test('canonical JSON is key-order independent', () => {
  assert.equal(digestOf({ b: 1, a: { d: 2, c: 3 } }), digestOf({ a: { c: 3, d: 2 }, b: 1 }))
})

test('only explicitly-UTC instants are accepted', () => {
  assert.ok(isExplicitUtcInstant('2026-09-02T04:00:00Z'))
  assert.ok(!isExplicitUtcInstant('2026-09-02T04:00:00+05:30'))
  assert.ok(!isExplicitUtcInstant('2026-09-02T04:00:00'))
})

// ---------------------------------------------------------------- registration digest

test('the registration digest is deterministic', () => {
  assert.equal(registrationDigest(validDraft()), registrationDigest(validDraft()))
  assert.equal(registered().registrationSha256, registered().registrationSha256)
})

test('changing any locked field changes the digest', () => {
  const baseline = registrationDigest(validDraft())
  const mutations: Partial<ExperimentDraft>[] = [
    { activityType: 'content-publication' },
    { actionWindowStartUtc: '2026-09-02T05:00:00Z' },
    { sampleSizeTarget: 21 },
    { factBundleSha256: `sha256:${'b'.repeat(64)}` },
    { compilerVersion: 'interpretation-compiler/0.2' },
    { inclusionCriteria: ['Something else entirely.'] },
    { metric: { ...validDraft().metric, horizonHours: 96 } },
    { comparator: { ...validDraft().comparator, draws: 9 } },
    { analysisPlan: { ...validDraft().analysisPlan, targetRate: 0.7 } },
    { verdict: { ...validDraft().verdict, classification: 'unfavorable' } },
  ]
  for (const mutation of mutations) {
    assert.notEqual(registrationDigest(validDraft(mutation)), baseline, `${Object.keys(mutation)[0]} must be inside the seal`)
  }
})

test('notes sit outside the seal so a registration can be annotated', () => {
  assert.equal(registrationDigest(validDraft({ notes: 'Added after the fact.' })), registrationDigest(validDraft()))
})

test('unknown draft fields are inside the seal rather than silently ignored', () => {
  const extended = { ...validDraft(), undeclaredAnalysisChoice: 'look only at favourable weekdays' } as ExperimentDraft
  assert.notEqual(registrationDigest(extended), registrationDigest(validDraft()))
})

// ---------------------------------------------------------------- registration gate

test('a well-formed confirmatory draft registers', () => {
  const registration = registered()
  assert.equal(registration.status, 'registered')
  assert.equal(registration.registeredAtUtc, '2026-09-01T00:00:00.000Z')
  assert.match(registration.registrationSha256, /^sha256:[a-f0-9]{64}$/)
})

test('the registration locks a deterministic categorical verdict, not a vague score', () => {
  const draft = validDraft()
  assert.equal(draft.verdict.classification, 'favorable')
  assert.equal(draft.verdict.prediction.relationToTarget, 'meets-or-exceeds-target')
  assert.equal(draft.verdict.empiricalCalibrationStatus, 'unvalidated')
  assert.ok(!('score' in draft.verdict))
  assert.ok(!('confidence' in draft.verdict))
  assert.match(structuredVerdictDigest(draft.verdict), /^sha256:[a-f0-9]{64}$/)
})

test('the verdict abstains when a selected rule retains an unresolved source variant', () => {
  const draft = validDraft({
    hypothesis: {
      ...validDraft().hypothesis,
      statement: 'Software releases begun during Vishti miss the rollback-free target rate declared before outcomes are known.',
      ruleIds: ['bs-muhurta-vishti-prohibition'],
    },
  })
  assert.equal(draft.verdict.classification, 'abstain-unresolved-variant')
  assert.deepEqual(draft.verdict.unresolvedVariantGroupIds, ['vishti-scope'])
  assert.equal(draft.verdict.prediction.relationToTarget, 'no-prediction')
})

test('registration refuses a hand-edited verdict even when its fields are well formed', () => {
  const draft = validDraft()
  const issues = validateDraft({
    ...draft,
    verdict: { ...draft.verdict, classification: 'unfavorable' },
  })
  assert.ok(issues.some((issue) => issue.includes('must exactly match')))
})

test('registration refuses an unknown tradition', () => {
  const issues = validateDraft(validDraft({ hypothesis: { ...validDraft().hypothesis, traditionId: 'not-a-tradition' } }))
  assert.ok(issues.some((issue) => issue.includes('Unknown tradition')))
})

test('registration refuses rules from more than one tradition', () => {
  const issues = validateDraft(validDraft({
    hypothesis: { ...validDraft().hypothesis, ruleIds: ['bs-muhurta-bava-favourable', 'ptb-planet-nature-benefic'] },
  }))
  assert.ok(issues.some((issue) => issue.includes('is not a rule of tradition')))
})

test('registration refuses a rule whose technique is withheld by policy', () => {
  const issues = validateDraft(validDraft({
    hypothesis: { ...validDraft().hypothesis, traditionId: 'hellenistic-ptolemaic', ruleIds: ['ptb-body-saturn'] },
  }))
  assert.ok(issues.some((issue) => issue.includes('withheld from all output')))
})

test('registration refuses a subjective KPI', () => {
  for (const name of ['Overall success', 'How lucky the launch felt', 'Team satisfaction']) {
    const issues = validateDraft(validDraft({ metric: { ...validDraft().metric, name } }))
    assert.ok(issues.some((issue) => issue.includes('subjective')), `${name} must be refused`)
  }
})

test('registration refuses a self-reported outcome', () => {
  const issues = validateDraft(validDraft({ metric: { ...validDraft().metric, source: 'self-reported' } }))
  assert.ok(issues.some((issue) => issue.includes('cannot be blinded')))
})

test('registration refuses a missing comparator policy', () => {
  const issues = validateDraft(validDraft({ comparator: undefined as unknown as ExperimentDraft['comparator'] }))
  assert.ok(issues.some((issue) => issue.includes('no declared null baseline')))
})

test('registration refuses a comparator with both or neither seed form', () => {
  const both = validateDraft(validDraft({ comparator: { ...validDraft().comparator, seedCommitmentSha256: `sha256:${'c'.repeat(64)}` } }))
  assert.ok(both.some((issue) => issue.includes('exactly one of seed')))
  const neither = validateDraft(validDraft({ comparator: { ...validDraft().comparator, seed: undefined } }))
  assert.ok(neither.some((issue) => issue.includes('exactly one of seed')))
})

test('registration refuses an analysis plan without a declared version, stopping rule, or multiplicity policy', () => {
  const unversioned = validateDraft(validDraft({ analysisPlan: { ...validDraft().analysisPlan, planVersion: 'freeform' as never } }))
  assert.ok(unversioned.some((issue) => issue.includes('declared version')))
  const noStopping = validateDraft(validDraft({ analysisPlan: { ...validDraft().analysisPlan, stoppingRule: 'when ready' } }))
  assert.ok(noStopping.some((issue) => issue.includes('stopping rule')))
  const noMultiplicity = validateDraft(validDraft({ analysisPlan: { ...validDraft().analysisPlan, multiplicityPolicy: 'none' } }))
  assert.ok(noMultiplicity.some((issue) => issue.includes('multiplicityPolicy')))
})

test('registration refuses a non-UTC timestamp', () => {
  const issues = validateDraft(validDraft({ actionWindowStartUtc: '2026-09-02T04:00:00+05:30' }))
  assert.ok(issues.some((issue) => issue.includes('explicit UTC instant')))
})

test('registration refuses an identifying participant id', () => {
  for (const identifier of ['mayone@example.com', 'user-1', 'pseudo_Has_Capitals']) {
    const issues = validateDraft(validDraft({ participantPseudonym: identifier }))
    assert.ok(issues.some((issue) => issue.includes('participantPseudonym')), `${identifier} must be refused`)
  }
})

test('registration refuses a missing prohibited-use attestation', () => {
  const issues = validateDraft(validDraft({ prohibitedUseAttestation: false }))
  assert.ok(issues.some((issue) => issue.includes('prohibitedUseAttestation')))
})

test('registration refuses a non-confirmatory study role in this version', () => {
  const issues = validateDraft(validDraft({ studyRole: 'exploratory' }))
  assert.ok(issues.some((issue) => issue.includes('confirmatory registrations only')))
})

test('registration refuses raising a rule above unvalidated-tradition', () => {
  const issues = validateDraft(validDraft({
    hypothesis: { ...validDraft().hypothesis, ruleEmpiricalStatus: 'established' as never },
  }))
  assert.ok(issues.some((issue) => issue.includes('unvalidated-tradition')))
})

test('registration refuses to lock after the action already began', () => {
  assert.throws(
    () => registerExperiment(validDraft(), { now: () => new Date('2026-09-02T05:00:00Z') }),
    (error: unknown) => error instanceof RegistrationRejected
      && error.issues.some((issue) => issue.includes('actionWindowStartUtc must be after registeredAtUtc')),
  )
})

test('registration verifies the committed fact bundle and its digest', () => {
  const changedBundle = structuredClone(validDraft().factBundle)
  changedBundle.observers[0].latitudeDegrees += 1
  const issues = validateDraft(validDraft({ factBundle: changedBundle }))
  assert.ok(issues.some((issue) => issue.includes('factBundleSha256 must match')))
})

test('malformed JSON is refused before domain validation or persistence', () => {
  const parsed = parseExperimentDraft({ experimentId: 'exp_a1b2c3d4e5f60718', hypothesis: 7 })
  assert.equal(parsed.ok, false)
  if (!parsed.ok) assert.ok(parsed.issues.some((issue) => issue.includes('hypothesis must be an object')))
})

test('binary-outcome/1 fixes one sample size and one stopping point', () => {
  const issues = validateDraft(validDraft({ sampleSizeTarget: 21 }))
  assert.ok(issues.some((issue) => issue.includes('must equal analysisPlan.minimumObservations')))
})

test('registerExperiment throws with every reason at once', () => {
  assert.throws(() => registerExperiment(validDraft({ prohibitedUseAttestation: false, sampleSizeTarget: 0 })), (error: unknown) => {
    assert.ok(error instanceof RegistrationRejected)
    assert.ok(error.issues.length >= 2)
    return true
  })
})

// ---------------------------------------------------------------- comparator

test('comparator generation is deterministic for a seed', () => {
  const policy = validDraft().comparator
  const first = generateComparators({ policy, electedMomentUtc: '2026-09-02T04:30:00Z' })
  const second = generateComparators({ policy, electedMomentUtc: '2026-09-02T04:30:00Z' })
  assert.deepEqual(first.draws, second.draws)
  assert.equal(first.draws.length, policy.draws)
})

test('a different seed yields a different comparator set', () => {
  const policy = validDraft().comparator
  const other = generateComparators({ policy: { ...policy, seed: 'a-different-seed' }, electedMomentUtc: '2026-09-02T04:30:00Z' })
  const base = generateComparators({ policy, electedMomentUtc: '2026-09-02T04:30:00Z' })
  assert.notDeepEqual(other.draws, base.draws)
})

test('comparators respect weekday, local-hour band, and exclusions', () => {
  const policy = validDraft().comparator
  const set = generateComparators({ policy, electedMomentUtc: '2026-09-02T04:30:00Z' })
  const electedWeekday = new Intl.DateTimeFormat('en-US', { timeZone: policy.matching.timeZone, weekday: 'short' }).format(new Date('2026-09-02T04:30:00Z'))
  for (const draw of set.draws) {
    const instant = new Date(draw.instantUtc)
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: policy.matching.timeZone, hour12: false, weekday: 'short', hour: '2-digit' }).formatToParts(instant)
    assert.equal(parts.find((part) => part.type === 'weekday')?.value, electedWeekday)
    const hour = Number(parts.find((part) => part.type === 'hour')?.value) % 24
    assert.ok(hour >= 9 && hour <= 17, `${draw.instantUtc} is outside the declared band`)
    for (const exclusion of policy.exclusions) {
      assert.ok(instant < new Date(exclusion.startUtc) || instant >= new Date(exclusion.endUtc), 'a draw fell inside an excluded interval')
    }
  }
})

test('an unsatisfiable comparator reports a shortfall rather than silently returning fewer', () => {
  const policy = validDraft().comparator
  const set = generateComparators({
    policy: { ...policy, draws: 50, feasibleWindowStartUtc: '2026-09-01T00:00:00Z', feasibleWindowEndUtc: '2026-09-02T00:00:00Z' },
    electedMomentUtc: '2026-09-02T04:30:00Z',
  })
  assert.ok(set.shortfallReason, 'a shortfall must be stated')
  assert.match(set.shortfallReason, /satisfied the declared constraints/)
})

test('the comparator states that it is not a causal control', () => {
  const set = generateComparators({ policy: validDraft().comparator, electedMomentUtc: '2026-09-02T04:30:00Z' })
  assert.match(set.boundary, /does not by itself control for confounding/)
})

test('a revealed seed must match its commitment', () => {
  const policy = { ...validDraft().comparator, seed: undefined, seedCommitmentSha256: `sha256:${'d'.repeat(64)}` }
  assert.throws(
    () => generateComparators({ policy, electedMomentUtc: '2026-09-02T04:30:00Z', revealedSeed: 'wrong-seed' }),
    /does not match the registered commitment/,
  )
})

// ---------------------------------------------------------------- outcomes

function submission(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: 'release-2026-09-02-001',
    value: 1,
    observedAtUtc: '2026-09-05T12:00:00Z',
    retrievedAtUtc: '2026-09-05T12:05:00Z',
    dataSourceId: 'github-actions',
    rawPayload: { workflowRun: 42, conclusion: 'success' },
    ...overrides,
  }
}

test('an outcome digest covers the value and its source provenance', () => {
  const record = buildOutcomeRecord(registered(), submission())
  assert.match(record.outcomeSha256, /^sha256:[a-f0-9]{64}$/)
  assert.match(record.rawValueSha256, /^sha256:[a-f0-9]{64}$/)
  assert.notEqual(
    buildOutcomeRecord(registered(), submission({ value: 0 })).outcomeSha256,
    record.outcomeSha256,
  )
})

test('the raw payload is hashed and never carried on the record', () => {
  const record = buildOutcomeRecord(registered(), submission()) as unknown as Record<string, unknown>
  assert.equal(record.rawPayload, undefined)
  assert.ok(!JSON.stringify(record).includes('workflowRun'))
})

test('an outcome preceding the registration is refused', () => {
  assert.throws(() => buildOutcomeRecord(registered(), submission({ observedAtUtc: '2026-08-01T00:00:00Z' })), (error: unknown) => {
    assert.ok(error instanceof OutcomeRejected)
    assert.ok(error.issues.some((issue) => issue.includes('precedes the registration')))
    return true
  })
})

test('an outcome must match the declared metric shape and system of record', () => {
  assert.throws(() => buildOutcomeRecord(registered(), submission({ value: 7 })), (error: unknown) =>
    error instanceof OutcomeRejected && error.issues.some((issue) => issue.includes('binary metric accepts only 0 or 1')))
  assert.throws(() => buildOutcomeRecord(registered(), submission({ dataSourceId: 'elsewhere' })), (error: unknown) =>
    error instanceof OutcomeRejected && error.issues.some((issue) => issue.includes('does not match the registered system of record')))
})

test('an outcome record exposes no mutation path', () => {
  // The type carries no setter and the module exports no update or delete.
  const exports = Object.keys(outcomeModule).join(' ')
  assert.ok(!/update|delete|remove|edit/i.test(exports), `outcomes module exports a mutation path: ${exports}`)
})

test('outcome chronology follows registration, action, observation, then retrieval', () => {
  const registration = registered()
  const beforeAction = submission({ observedAtUtc: '2026-09-02T03:00:00Z', retrievedAtUtc: '2026-09-02T03:05:00Z' })
  assert.throws(() => buildOutcomeRecord(registration, beforeAction), (error: unknown) =>
    error instanceof OutcomeRejected && error.issues.some((issue) => issue.includes('precedes the declared action window')))

  const retrievedFirst = submission({ observedAtUtc: '2026-09-05T12:00:00Z', retrievedAtUtc: '2026-09-05T11:00:00Z' })
  assert.throws(() => buildOutcomeRecord(registration, retrievedFirst), (error: unknown) =>
    error instanceof OutcomeRejected && error.issues.some((issue) => issue.includes('at or after observedAtUtc')))

  assert.throws(
    () => buildOutcomeRecord(registration, submission(), { now: () => new Date('2026-09-05T11:00:00Z') }),
    (error: unknown) => error instanceof OutcomeRejected && error.issues.some((issue) => issue.includes('future relative')),
  )
})

// ---------------------------------------------------------------- analysis

function outcomes(count: number, successes: number): OutcomeRecord[] {
  return Array.from({ length: count }, (_unused, index) => ({
    experimentId: 'exp_a1b2c3d4e5f60718',
    idempotencyKey: `key-${index}`,
    value: index < successes ? 1 : 0,
    observedAtUtc: '2026-09-05T12:00:00Z',
    retrievedAtUtc: '2026-09-05T12:05:00Z',
    dataSourceId: 'github-actions',
    rawValueSha256: `sha256:${'e'.repeat(64)}`,
    outcomeSha256: `sha256:${String(index).padStart(64, '0')}`,
  }))
}

test('analysis stays pending before the declared horizon', () => {
  const result = runAnalysis({ registration: registered(), outcomes: outcomes(20, 18), now: new Date('2026-09-02T07:00:00Z') })
  assert.equal(result.status, 'pending')
  assert.equal(result.classification, null)
  assert.match(result.rationale, /horizon .* has not elapsed/)
})

test('analysis stays pending below the declared minimum observations', () => {
  const result = runAnalysis({ registration: registered(), outcomes: outcomes(5, 5), now: new Date('2026-10-01T00:00:00Z') })
  assert.equal(result.status, 'pending')
  assert.match(result.rationale, /fixed sample 20/)
})

test('analysis refuses observations beyond the fixed stopping point', () => {
  assert.throws(
    () => runAnalysis({ registration: registered(), outcomes: outcomes(21, 21), now: new Date('2026-10-01T00:00:00Z') }),
    AnalysisUnavailable,
  )
})

test('no p-value is produced anywhere in an analysis result', () => {
  const result = runAnalysis({ registration: registered(), outcomes: outcomes(20, 18), now: new Date('2026-10-01T00:00:00Z') })
  const keys = Object.keys(result).join(' ').toLowerCase()
  for (const forbidden of ['p-value', 'pvalue', 'p_value', 'confidence']) {
    assert.ok(!keys.includes(forbidden), `analysis result exposes a ${forbidden} field`)
  }
  assert.match(result.rationale, /no significance test/)
  assert.equal(typeof result.exactBinomialEligible, 'boolean')
})

test('a result beyond the horizon is classified and always publishable', () => {
  const positive = runAnalysis({ registration: registered(), outcomes: outcomes(20, 20), now: new Date('2026-10-01T00:00:00Z') })
  assert.equal(positive.status, 'complete')
  assert.equal(positive.classification, 'positive')

  const adverse = runAnalysis({ registration: registered(), outcomes: outcomes(20, 4), now: new Date('2026-10-01T00:00:00Z') })
  assert.equal(adverse.classification, 'adverse')

  const nullResult = runAnalysis({ registration: registered(), outcomes: outcomes(20, 16), now: new Date('2026-10-01T00:00:00Z') })
  assert.equal(nullResult.classification, 'null')

  // There is no state that discards an experiment.
  for (const result of [positive, adverse, nullResult]) {
    assert.ok(['positive', 'null', 'inconclusive', 'adverse'].includes(result.classification ?? ''))
  }
})

test('the analysis digest changes when the numbers change', () => {
  const first = runAnalysis({ registration: registered(), outcomes: outcomes(20, 18), now: new Date('2026-10-01T00:00:00Z') })
  const second = runAnalysis({ registration: registered(), outcomes: outcomes(20, 17), now: new Date('2026-10-01T00:00:00Z') })
  assert.notEqual(first.analysisSha256, second.analysisSha256)
})

test('the horizon helper matches the declared metric', () => {
  assert.ok(!horizonComplete(registered(), new Date('2026-09-04T00:00:00Z')))
  assert.ok(horizonComplete(registered(), new Date('2026-09-05T07:00:00Z')))
})

// ---------------------------------------------------------------- provenance and privacy

test('the provenance bundle carries every required hash and the source chain', () => {
  const registration = registered()
  const records = [buildOutcomeRecord(registration, submission())]
  const analysis = runAnalysis({ registration, outcomes: outcomes(20, 18), now: new Date('2026-10-01T00:00:00Z') })
  const bundle = buildProvenanceBundle({ registration, outcomes: records, analysis })

  assert.equal(bundle.registrationSha256, registration.registrationSha256)
  assert.equal(bundle.registeredAtUtc, registration.registeredAtUtc)
  assert.equal(bundle.factBundleSha256, registration.draft.factBundleSha256)
  assert.equal(bundle.compilerVersion, 'interpretation-compiler/0.1')
  assert.equal(bundle.ruleRegistryVersion, ASTROLOGY_VERSION)
  assert.deepEqual(bundle.ruleIds, ['bs-muhurta-bava-favourable'])
  assert.ok(bundle.passageIds.length > 0, 'the rule must resolve to a transcribed passage')
  assert.ok(bundle.sourceIds.includes('brihat-samhita-iyer'))
  assert.match(bundle.comparator.seedCommitmentSha256, /^sha256:[a-f0-9]{64}$/)
  assert.match(bundle.analysisPlanSha256, /^sha256:[a-f0-9]{64}$/)
  assert.deepEqual(bundle.outcomeSha256, records.map((record) => record.outcomeSha256))
  assert.equal(bundle.analysisSha256, analysis.analysisSha256)
  assert.equal(bundle.epistemicBoundary, REGISTRY_EPISTEMIC_BOUNDARY)
})

test('the provenance bundle exposes the seed commitment and never the seed', () => {
  const registration = registered()
  const bundle = buildProvenanceBundle({ registration, outcomes: [], analysis: null })
  assert.equal(bundle.comparator.seedCommitmentSha256, comparatorSeedCommitment(registration.draft.comparator))
  assert.ok(!JSON.stringify(bundle).includes('seed-2026-09-registry-trial'))
})

test('the public projection leaks no participant identity or raw telemetry', () => {
  const registration = registered()
  const records = [buildOutcomeRecord(registration, submission())]
  const bundle = buildProvenanceBundle({ registration, outcomes: records, analysis: null })
  const serialized = JSON.stringify(publicView(bundle, registration))

  assert.ok(!serialized.includes('pseudo_7fa91c22'), 'the participant pseudonym must not appear in the public view')
  assert.ok(!serialized.includes('workflowRun'), 'no raw telemetry may appear')
  assert.ok(!serialized.includes('seed-2026-09-registry-trial'), 'the seed must not appear')
  assert.ok(!/idempotencyKey|idempotency_key/.test(serialized), 'idempotency keys are internal')
  // The scientific content survives.
  assert.ok(serialized.includes('bs-muhurta-bava-favourable'))
  assert.ok(serialized.includes(REGISTRY_EPISTEMIC_BOUNDARY))
})

// ---------------------------------------------------------------- epistemic guardrail

test('no surface claims an astrological rule is empirically validated', () => {
  const registration = registered()
  const analysis = runAnalysis({ registration, outcomes: outcomes(20, 20), now: new Date('2026-10-01T00:00:00Z') })
  const bundle = buildProvenanceBundle({ registration, outcomes: [], analysis })
  const surfaces = [
    JSON.stringify(registration),
    JSON.stringify(analysis),
    JSON.stringify(bundle),
    JSON.stringify(publicView(bundle, registration)),
  ].join(' ').toLowerCase()

  for (const forbidden of [/proves/, /\bproven\b/, /validates astrology/, /scientifically supported/, /empirically validated/, /astrology works/]) {
    assert.ok(!forbidden.test(surfaces), `a surface claims: ${forbidden}`)
  }
  assert.ok(surfaces.includes('unvalidated-tradition'))
  assert.ok(surfaces.includes('does not establish that astrology predicts anything'))
})

test('the migration enforces lock and append-only chronology at the database boundary', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260816000100_celestial_hypothesis_registry.sql', import.meta.url), 'utf8')
  assert.match(migration, /action window must begin after registration/)
  assert.match(migration, /retrieved before it was observed/)
  assert.match(migration, /registration digest does not match the reviewed draft/)
  assert.match(migration, /has reached its fixed sample size/)
  assert.match(migration, /revoke update, delete, truncate on table public\.celestial_hypothesis_outcomes from service_role/)
  assert.match(migration, /revoke delete, truncate on table public\.celestial_hypothesis_experiments from service_role/)
})

test('the required product claim is stated verbatim', () => {
  assert.equal(
    REGISTRY_EPISTEMIC_BOUNDARY,
    'This is a pre-registered test of a named celestial-timing hypothesis. Registration and analysis plan were locked before the measured outcome. It does not establish that astrology predicts anything.',
  )
})
