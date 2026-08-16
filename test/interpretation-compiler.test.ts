import assert from 'node:assert/strict'
import test from 'node:test'

import { validateCelestialFactBundle, type CelestialFactBundle, type CelestialPositionFact } from '../lib/celestial-facts.ts'
import { BLOCKED_TECHNIQUES, CompilerRefusal, auditReport, compileReport } from '../lib/interpretation-compiler.ts'

const DIGEST = `sha256:${'a'.repeat(64)}`

function fact(name: string, longitude: number): CelestialPositionFact {
  return {
    id: `fact-${name.toLowerCase()}`,
    subject: { name, identifiers: { 'naif-id': `${name.length}99` } },
    observerId: 'obs-1',
    reference: {
      origin: 'geocentre', frame: 'ICRF', epoch: 'J2000', equinox: null, timeScale: 'TDB',
      coordinateRepresentation: 'ecliptic-spherical', positionType: 'apparent',
      lightTime: 'applied', stellarAberration: 'applied', gravitationalDeflection: 'applied', atmosphericRefraction: 'not-applicable',
    },
    coordinates: [{ axis: 'longitude', value: longitude, unit: 'degree', precision: 0.0001, uncertainty: 0.0001 }],
    provenance: {
      providerSourceId: 'jpl-horizons-4.98d',
      providerRequestUrl: 'https://ssd.jpl.nasa.gov/api/horizons.api',
      providerRequestParameters: { COMMAND: name },
      providerResponseSha256: DIGEST,
      retrievedAt: '2026-08-16T00:00:00Z',
      limitations: ['Positions are apparent geocentric values for the stated instant.'],
    },
  }
}

function bundle(subjects: [string, number][] = [['Jupiter', 12.5], ['Venus', 88.25], ['Saturn', 200.75], ['Mars', 310.5], ['Sun', 143.0], ['Mercury', 150.25], ['Moon', 22.75]]): CelestialFactBundle {
  return {
    schemaVersion: 'celestial-facts/0.1',
    bundleId: 'cel_test_bundle_0001',
    recordedAt: '2026-08-16T00:00:00Z',
    time: { utcInstant: '1990-03-14T09:25:00Z', ephemerisTimeScale: 'TDB', leapSecondSourceId: 'iers-bulletins-live' },
    observers: [{ id: 'obs-1', latitudeDegrees: 51.4769, longitudeDegrees: -0.0005, horizontalCrs: 'EPSG:4326', elevationMeters: 47, elevationReference: 'ellipsoidal' }],
    facts: subjects.map(([name, longitude]) => fact(name, longitude)),
  }
}

test('the fixture bundle is valid against the fact contract', () => {
  assert.deepEqual(validateCelestialFactBundle(bundle()), [])
})

test('a report compiles from facts plus one declared tradition', () => {
  const report = compileReport({ factBundle: bundle(), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  assert.ok(report.modules.length > 0)
  assert.equal(report.traditionId, 'hellenistic-ptolemaic')
  assert.match(report.epistemicBoundary, /no evidence that any of it predicts anything/)
})

test('compilation is deterministic: same input, same report id', () => {
  const first = compileReport({ factBundle: bundle(), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  const second = compileReport({ factBundle: bundle(), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  assert.equal(first.reportId, second.reportId)
  assert.equal(first.provenance.inputSha256, second.provenance.inputSha256)
})

test('different facts produce a different report id', () => {
  const first = compileReport({ factBundle: bundle(), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  const second = compileReport({ factBundle: bundle([['Jupiter', 99.9], ['Venus', 1.5]]), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  assert.notEqual(first.provenance.factBundleSha256, second.provenance.factBundleSha256)
  assert.notEqual(first.reportId, second.reportId)
})

test('every reportModule traces to a rule, a passage, and a source', () => {
  const report = compileReport({ factBundle: bundle(), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  for (const reportModule of report.modules) {
    assert.ok(reportModule.ruleId)
    assert.ok(reportModule.passageIds.length > 0, `${reportModule.id} has no passage`)
    assert.ok(reportModule.sourceIds.length > 0, `${reportModule.id} has no source`)
    assert.ok(reportModule.boundary.length > 0)
  }
  assert.ok(report.provenance.passageIds.length > 0)
  assert.ok(report.provenance.sourceIds.includes('ptolemy-tetrabiblos-ashmand'))
})

test('an invalid fact bundle is refused, not worked around', () => {
  const broken = { ...bundle(), bundleId: 'not-a-valid-id' }
  assert.throws(() => compileReport({ factBundle: broken, traditionId: 'hellenistic-ptolemaic', chartType: 'natal' }), (error: unknown) => {
    assert.ok(error instanceof CompilerRefusal)
    assert.equal(error.stage, 'validate-facts')
    assert.ok(error.issues.length > 0)
    return true
  })
})

test('an unknown tradition is refused', () => {
  assert.throws(() => compileReport({ factBundle: bundle(), traditionId: 'nope', chartType: 'natal' }), /Unknown tradition/)
})

test('a tradition with no published rules is refused, with its reason', () => {
  assert.throws(() => compileReport({ factBundle: bundle(), traditionId: 'horary-lilly', chartType: 'horary' }), (error: unknown) => {
    assert.ok(error instanceof CompilerRefusal)
    assert.equal(error.stage, 'select-rules')
    assert.match(error.issues.join(' '), /unproofread OCR/)
    return true
  })
})

test('a chart type the tradition does not practise is refused', () => {
  assert.throws(() => compileReport({ factBundle: bundle(), traditionId: 'hellenistic-ptolemaic', chartType: 'horary' }), /does not practise/)
})

test('prohibited techniques never reach output, and say why they were withheld', () => {
  const report = compileReport({ factBundle: bundle(), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  for (const reportModule of report.modules) {
    assert.equal(BLOCKED_TECHNIQUES[reportModule.heading], undefined, `${reportModule.heading} must never be reported`)
  }
  const policyExclusions = report.exclusions.filter((exclusion) => exclusion.reason === 'report-policy')
  assert.ok(policyExclusions.length > 0)
  for (const exclusion of policyExclusions) assert.match(exclusion.detail, /withheld from all generated output/)
})

test('medical and personality techniques are specifically withheld', () => {
  const report = compileReport({ factBundle: bundle(), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  const withheld = new Set(report.exclusions.filter((e) => e.reason === 'report-policy').map((e) => e.technique))
  for (const technique of ['bodily injury', 'quality of mind', 'bodily form', 'order of judgement']) {
    assert.ok(withheld.has(technique), `${technique} must be withheld by policy`)
  }
})

test('rules needing an underivable condition are excluded rather than guessed', () => {
  const report = compileReport({ factBundle: bundle(), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  const derivation = report.exclusions.filter((exclusion) => exclusion.reason === 'requires-derivation')
  assert.ok(derivation.length > 0)
  for (const exclusion of derivation) assert.match(exclusion.detail, /needs a derivation the compiler does not perform/)
})

test('a rule whose subjects are absent is excluded on the facts', () => {
  // A bundle with no Jupiter or Venus cannot support the benefic rule.
  const report = compileReport({ factBundle: bundle([['Saturn', 200.75], ['Mars', 310.5]]), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  const unsatisfied = report.exclusions.filter((exclusion) => exclusion.reason === 'condition-unsatisfied')
  assert.ok(unsatisfied.some((exclusion) => exclusion.ruleId === 'ptb-planet-nature-benefic'))
  assert.ok(!report.modules.some((reportModule) => reportModule.ruleId === 'ptb-planet-nature-benefic'))
})

test('every rule is accounted for as either reported or excluded', () => {
  const report = compileReport({ factBundle: bundle(), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  const accounted = new Set([...report.modules.map((m) => m.ruleId), ...report.exclusions.map((e) => e.ruleId)])
  assert.equal(accounted.size, 15, 'no rule may vanish without a recorded outcome')
})

test('narrative is assembled, never rewritten', () => {
  const report = compileReport({ factBundle: bundle(), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  // auditReport enforces reportModule text === rule text; prove it fires when violated.
  const tampered = { ...report, modules: report.modules.map((reportModule, index) => index === 0 ? { ...reportModule, paragraph: 'A claim the compiler invented.' } : reportModule) }
  assert.throws(() => auditReport(tampered), (error: unknown) => {
    assert.ok(error instanceof CompilerRefusal)
    assert.match(error.issues.join(' '), /must not rewrite a claim/)
    return true
  })
})

test('the audit rejects a reportModule with no source passage', () => {
  const report = compileReport({ factBundle: bundle(), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  const tampered = { ...report, modules: report.modules.map((reportModule, index) => index === 0 ? { ...reportModule, passageIds: [] } : reportModule) }
  assert.throws(() => auditReport(tampered), /failed its own audit/)
})

test('disagreements are surfaced, not resolved', () => {
  const report = compileReport({ factBundle: bundle(), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  assert.match(report.conflictPolicy, /never silently resolved/)
  assert.match(report.conflictPolicy, /cross-tradition synthesis is refused/i)
  assert.ok(report.modules.some((reportModule) => reportModule.disagreements.length > 0), 'at least one reportModule should carry a recorded disagreement')
})

test('the report publishes its prohibited uses', () => {
  const report = compileReport({ factBundle: bundle(), traditionId: 'hellenistic-ptolemaic', chartType: 'natal' })
  assert.ok(report.prohibitedUses.length >= 8)
  for (const term of ['medical', 'legal', 'investment']) {
    assert.ok(report.prohibitedUses.some((use) => use.includes(term)))
  }
})
