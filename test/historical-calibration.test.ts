import assert from 'node:assert/strict'
import test from 'node:test'

import { buildBirthReport } from '../lib/birth-report.ts'
import {
  HistoricalCalibrationError,
  compileHistoricalCalibration,
  type HistoricalMilestoneInput,
} from '../lib/historical-calibration.ts'
import { computeNatalChart } from '../lib/natal-chart.ts'

const BIRTH_INSTANT = new Date('1992-12-01T02:09:00.000Z')
const COMPILED_AT = new Date('2026-08-17T06:45:00.000Z')
const PLACE = { latitudeDegrees: 48.588, longitudeDegrees: -93.4084 }

const milestones: HistoricalMilestoneInput[] = [
  {
    eventId: 'evt_answer2025', title: 'First paid platform answer', occurredAtUtc: '2025-08-23T08:32:00.000Z',
    uncertaintyMinutes: 0, type: 'client-work', sourceKind: 'platform-record', sourceReference: 'platform response timestamp',
    metric: { metricId: 'monthly_revenue', name: 'Monthly revenue', value: 50, target: 50, unit: 'USD', direction: 'higher-is-better', dataSourceId: 'platform income dashboard' },
  },
  {
    eventId: 'evt_payment2025', title: 'First platform payment', occurredAtUtc: '2025-08-25T11:01:00.000Z',
    uncertaintyMinutes: 0, type: 'revenue', sourceKind: 'platform-record', sourceReference: 'platform payment timestamp',
    metric: { metricId: 'monthly_revenue', name: 'Monthly revenue', value: 50, target: 50, unit: 'USD', direction: 'higher-is-better', dataSourceId: 'platform income dashboard' },
  },
  {
    eventId: 'evt_manuscript2025', title: 'Earliest manuscript metadata', occurredAtUtc: '2025-11-25T15:26:00.000Z',
    uncertaintyMinutes: 0, type: 'creative-work', sourceKind: 'file-metadata', sourceReference: 'manuscript file creation metadata',
  },
  {
    eventId: 'evt_company2025', title: 'Company incorporated', occurredAtUtc: '2025-12-17T12:00:00.000Z',
    uncertaintyMinutes: 1440, type: 'company-formation', sourceKind: 'government-record', sourceReference: 'articles of organization filing date',
  },
]

function compile(events = milestones) {
  const natalChart = computeNatalChart({ instant: BIRTH_INSTANT, ...PLACE })
  return compileHistoricalCalibration({ natalChart, birthInstant: BIRTH_INSTANT, compiledAt: COMPILED_AT, ...PLACE, milestones: events })
}

test('historical milestones compile into reproducible uncertainty-aware state vectors', () => {
  const result = compile()
  assert.equal(result.status, 'exploratory-case-series')
  assert.equal(result.claimEligibility, 'hypothesis-generation-only')
  assert.equal(result.milestones.length, 4)
  assert.ok(result.correspondences.length > 0)
  assert.ok(result.prospectiveCandidates.length > 0)
  assert.match(result.boundary, /do not measure predictive accuracy/i)
  const dateOnly = result.milestones.find((entry) => entry.eventId === 'evt_company2025')!
  assert.equal(dateOnly.sampledFromUtc, '2025-12-17T00:00:00.000Z')
  assert.equal(dateOnly.sampledThroughUtc, '2025-12-18T00:00:00.000Z')
  assert.equal(new Set(dateOnly.stableFeatures.map((feature) => feature.key)).size, dateOnly.stableFeatures.length)
})

test('input order does not alter calibration identity or output', () => {
  const first = compile(milestones)
  const second = compile([...milestones].reverse())
  assert.equal(first.inputSha256, second.inputSha256)
  assert.equal(first.bundleSha256, second.bundleSha256)
  assert.deepEqual(first.milestones, second.milestones)
})

test('calibration reports repetitions without turning selected-event share into probability', () => {
  const result = compile()
  for (const correspondence of result.correspondences) {
    assert.ok(correspondence.occurrences >= 2)
    assert.ok(correspondence.selectedEventShare > 0 && correspondence.selectedEventShare <= 1)
  }
  for (const candidate of result.prospectiveCandidates) {
    assert.equal(candidate.status, 'exploratory-candidate-not-registered')
    assert.equal(candidate.minimumProspectiveObservations, 20)
    assert.match(candidate.statementTemplate, /random-clock baseline/)
  }
})

test('milestones after the compilation moment are rejected', () => {
  assert.throws(() => compile([{ ...milestones[0], occurredAtUtc: '2027-01-01T00:00:00.000Z' }]), HistoricalCalibrationError)
})

test('the birth report keeps calibration optional and embeds it when supplied', () => {
  const base = {
    date: '1992-11-30', time: '20:09', timeZone: 'America/Chicago', ...PLACE,
    timingInstantUtc: COMPILED_AT.toISOString(),
  }
  assert.equal(buildBirthReport(base).historicalCalibration, null)
  const calibrated = buildBirthReport({ ...base, historicalMilestones: milestones })
  assert.equal(calibrated.historicalCalibration?.milestones.length, 4)
  assert.equal(calibrated.historicalCalibration?.timingVersion, calibrated.timing.version)
})
