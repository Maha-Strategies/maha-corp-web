import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { summarizeCorpusExposure } from '../lib/celestial-event-corpus/analysis.ts'
import { compileCorpusObservation } from '../lib/celestial-event-corpus/compiler.ts'
import { resolveNatalProfile } from '../lib/celestial-event-corpus/natal-profile.ts'
import { corpusJson } from '../lib/celestial-event-corpus/route-support.ts'
import { generateSystematicSchedule } from '../lib/celestial-event-corpus/sampling.ts'
import {
  CELESTIAL_EVENT_CORPUS_VERSION,
  CORPUS_SAMPLING_PLAN_VERSION,
  CORPUS_EPISTEMIC_BOUNDARY,
  CorpusValidationError,
  corpusDefinitionDigest,
  parseCorpusDefinition,
  type CorpusDefinition,
  type CorpusObservationSubmission,
  type NatalProfileInput,
} from '../lib/celestial-event-corpus/types.ts'

const profile: NatalProfileInput = {
  date: '1992-11-30', time: '20:09', timeZone: 'America/Chicago', latitudeDegrees: 48.588, longitudeDegrees: -93.4084,
}
const natal = resolveNatalProfile(profile)
const definition: CorpusDefinition = {
  corpusId: 'corp_founder202501',
  participantPseudonym: 'pseudo_founder01',
  studyRole: 'exploratory',
  corpusVersion: CELESTIAL_EVENT_CORPUS_VERSION,
  natalProfileSha256: natal.profileSha256,
  samplingPlan: {
    planVersion: CORPUS_SAMPLING_PLAN_VERSION,
    windowStartUtc: '2025-08-01T00:00:00.000Z',
    windowEndUtc: '2026-01-01T00:00:00.000Z',
    anchorUtc: '2025-08-01T12:00:00.000Z',
    cadenceMinutes: 10_080,
    intervalMinutes: 60,
    activityType: 'paid-client-work',
    qualifyingEventDefinition: 'A paid client-work milestone recorded by the declared platform or financial system of record.',
    negativeEvidenceProcedure: 'Query the complete interval in the same platform ledger and retain a digest of the result proving no qualifying event occurred.',
  },
}

function compile(submission: CorpusObservationSubmission) {
  return compileCorpusObservation({
    definition,
    definitionSha256: corpusDefinitionDigest(definition),
    submission,
    natalChart: natal.natalChart,
    birthInstant: natal.birthInstant,
    latitudeDegrees: profile.latitudeDegrees,
    longitudeDegrees: profile.longitudeDegrees,
  })
}

test('a valid corpus fixes a pseudonymous natal digest and systematic denominator plan', () => {
  assert.deepEqual(parseCorpusDefinition(definition), definition)
  assert.match(corpusDefinitionDigest(definition), /^sha256:[a-f0-9]{64}$/)
  assert.notEqual(natal.profileSha256, corpusDefinitionDigest(definition))
})

test('systematic schedule creates candidates, never automatic non-events', () => {
  const candidates = generateSystematicSchedule(definition.samplingPlan)
  assert.ok(candidates.length > 10)
  assert.equal(candidates[0].intervalStartUtc, '2025-08-01T12:00:00.000Z')
  assert.equal(candidates[0].intervalEndUtc, '2025-08-01T13:00:00.000Z')
  assert.ok(candidates.every((candidate) => candidate.status === 'candidate-needs-absence-evidence'))
})

test('milestones and evidence-backed non-events compile into the same state-vector schema', () => {
  const milestone = compile({
    observationId: 'obs_milestone20250823', kind: 'milestone', selectionMethod: 'observed-event',
    intervalStartUtc: '2025-08-23T08:32:00.000Z', intervalEndUtc: '2025-08-23T08:33:00.000Z',
    sourceKind: 'platform-record', dataSourceId: 'platform-ledger', evidencePayload: { privateReceipt: 'must-not-persist' },
  })
  const nonEvent = compile({
    observationId: 'obs_nonevent20250801', kind: 'non-event', selectionMethod: 'systematic-clock',
    intervalStartUtc: '2025-08-01T12:00:00.000Z', intervalEndUtc: '2025-08-01T13:00:00.000Z',
    sourceKind: 'platform-query', dataSourceId: 'platform-ledger', evidencePayload: {
      queryWindowStartUtc: '2025-08-01T12:00:00.000Z', queryWindowEndUtc: '2025-08-01T13:00:00.000Z',
      qualifyingEventCount: 0, retrievedAtUtc: '2025-08-02T00:00:00.000Z', sourceQueryId: 'weekly-platform-query-001',
      rawResult: { privateQueryResult: 'must-not-persist' },
    },
  })
  assert.match(milestone.observationSha256, /^sha256:[a-f0-9]{64}$/)
  assert.match(nonEvent.celestialState.stateVectorSha256, /^sha256:[a-f0-9]{64}$/)
  assert.ok(milestone.celestialState.stableFeatures.length > 0)
  assert.ok(nonEvent.celestialState.stableFeatures.length > 0)
  assert.doesNotMatch(JSON.stringify([milestone, nonEvent]), /must-not-persist/)

  const summary = summarizeCorpusExposure([milestone, nonEvent])
  assert.equal(summary.milestones, 1)
  assert.equal(summary.nonEvents, 1)
  assert.equal(summary.corpusBaselineMilestoneRate, 0.5)
  assert.ok(summary.featureExposures.length > 0)
  assert.match(summary.boundary, /descriptive, not causal or confirmatory/i)
})

test('a negative interval that is not selected by the locked clock is rejected', () => {
  assert.throws(() => compile({
    observationId: 'obs_badnegative001', kind: 'non-event', selectionMethod: 'systematic-clock',
    intervalStartUtc: '2025-08-01T12:01:00.000Z', intervalEndUtc: '2025-08-01T13:01:00.000Z',
    sourceKind: 'platform-query', dataSourceId: 'platform-ledger', evidencePayload: {
      queryWindowStartUtc: '2025-08-01T12:01:00.000Z', queryWindowEndUtc: '2025-08-01T13:01:00.000Z',
      qualifyingEventCount: 0, retrievedAtUtc: '2025-08-02T00:00:00.000Z', sourceQueryId: 'misaligned-query', rawResult: {},
    },
  }), CorpusValidationError)
})

test('an empty payload cannot masquerade as proof of a non-event', () => {
  assert.throws(() => compile({
    observationId: 'obs_emptyevidence01', kind: 'non-event', selectionMethod: 'systematic-clock',
    intervalStartUtc: '2025-08-01T12:00:00.000Z', intervalEndUtc: '2025-08-01T13:00:00.000Z',
    sourceKind: 'platform-query', dataSourceId: 'platform-ledger', evidencePayload: {},
  }), /zero-count|query bounds|qualifyingEventCount/i)
})

test('the database makes definitions lockable and observations append-only', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260817000100_celestial_event_corpus.sql', import.meta.url), 'utf8')
  assert.match(migration, /must be locked before observations are appended/)
  assert.match(migration, /does not carry the locked corpus definition digest/)
  assert.match(migration, /non-event interval is not aligned to the locked systematic clock/)
  assert.match(migration, /revoke update, delete, truncate on table public\.celestial_event_observations from service_role/)
  assert.match(migration, /revoke delete, truncate on table public\.celestial_event_corpora from service_role/)
})

test('every corpus route is private and exposes no edit or delete handler', async () => {
  const routes = [
    '../app/api/v1/celestial-corpus/corpora/route.ts',
    '../app/api/v1/celestial-corpus/corpora/[corpusId]/lock/route.ts',
    '../app/api/v1/celestial-corpus/corpora/[corpusId]/schedule/route.ts',
    '../app/api/v1/celestial-corpus/corpora/[corpusId]/observations/route.ts',
  ]
  for (const route of routes) {
    const source = await readFile(new URL(route, import.meta.url), 'utf8')
    assert.match(source, /export const dynamic = 'force-dynamic'/)
    assert.match(source, /openGate\(request/)
    assert.doesNotMatch(source, /export (async )?function (PATCH|PUT|DELETE)\b/)
  }
})

test('corpus responses carry the exploratory boundary rather than a confirmatory claim', async () => {
  const payload = await corpusJson({ ok: true }, 200).json() as { epistemicBoundary: string }
  assert.equal(payload.epistemicBoundary, CORPUS_EPISTEMIC_BOUNDARY)
  assert.match(payload.epistemicBoundary, /do not establish causation or predictive performance/)
})
