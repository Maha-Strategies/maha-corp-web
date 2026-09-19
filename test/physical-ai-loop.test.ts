import { test } from 'node:test'
import assert from 'node:assert/strict'

import { COUNTEREXAMPLES, DEFAULT_CONFIG, FIXTURE_VERSION, runLoop } from '../lib/physical-ai-loop.ts'

/**
 * The fixture exists to make a claim checkable, so the tests assert the
 * claims the articles make — not a snapshot of whatever it printed. Every
 * number below was measured from this fixture, and the article text was
 * written to match the measurement rather than the other way round.
 */

test('a run is reproducible from its seed', () => {
  const first = runLoop({ seed: 21 })
  const second = runLoop({ seed: 21 })
  assert.deepEqual(first, second)
  assert.equal(first.version, FIXTURE_VERSION)
  // A different seed is a different run, so the determinism is real rather
  // than the noise being ignored.
  assert.notDeepEqual(runLoop({ seed: 22 }).lastStep, first.lastStep)
})

test('counterexample 1: latency alone flips the outcome at constant perception quality', () => {
  const { withoutDelay, withDelay } = COUNTEREXAMPLES.latencyChangesOutcome()
  // Same seed, same noise, same gain, monitor held off in both arms.
  assert.equal(withoutDelay.config.seed, withDelay.config.seed)
  assert.equal(withoutDelay.config.observationNoise, withDelay.config.observationNoise)
  assert.equal(withoutDelay.config.gain, withDelay.config.gain)
  assert.equal(withoutDelay.config.monitorThreshold, withDelay.config.monitorThreshold)
  assert.notEqual(withoutDelay.config.actuationDelaySteps, withDelay.config.actuationDelaySteps)
  // Nothing rescued the delayed arm: no monitor firing, no intervention.
  assert.equal(withDelay.interventions, 0)
  assert.equal(withDelay.monitorFirings, 0)

  assert.equal(withoutDelay.outcome, 'autonomous-success')
  assert.equal(withDelay.outcome, 'failure')
  assert.ok(withoutDelay.finalError <= withoutDelay.config.tolerance)
  assert.ok(withDelay.finalError > 1, `delayed run diverged to ${withDelay.finalError}`)
})

test('counterexample 2: a threshold below the noise floor buys nuisance, not safety', () => {
  const { calibrated, tooTight } = COUNTEREXAMPLES.tightMonitorAddsNuisance()
  assert.ok(tooTight.config.monitorThreshold < calibrated.config.monitorThreshold)
  // Neither scenario contains a disturbance, so every firing is a false alarm.
  assert.equal(calibrated.config.anomalyStep, undefined)
  assert.equal(tooTight.config.anomalyStep, undefined)

  assert.equal(calibrated.outcome, 'autonomous-success')
  assert.equal(calibrated.monitorFirings, 0)
  assert.equal(calibrated.falseInterventions, 0)

  assert.equal(tooTight.outcome, 'assisted-success')
  assert.ok(tooTight.interventions > 10, 'the tight threshold interrupts repeatedly')
  assert.equal(tooTight.falseInterventions, tooTight.monitorFirings, 'with no disturbance, every firing is a false alarm')
  assert.equal(tooTight.trueInterventions, 0)
})

test('counterexample 3: with a real disturbance a firing has something to explain', () => {
  const { withDisturbance, withoutDisturbance } = COUNTEREXAMPLES.monitorCatchesDisturbance()
  assert.equal(withDisturbance.config.anomalyStep, 3)
  assert.ok((withDisturbance.config.anomalyMagnitude ?? 0) > 0)
  assert.ok(withDisturbance.trueInterventions >= 1, 'the injected jump was detected')
  // The same monitor on the undisturbed scenario has nothing true to find.
  assert.equal(withoutDisturbance.trueInterventions, 0)
  assert.ok(
    withDisturbance.trueInterventions > withoutDisturbance.trueInterventions,
    'the disturbance, not the threshold, is what produced the true detections',
  )
})

test('an assisted success is never reported as autonomous', () => {
  const assisted = runLoop({ monitorThreshold: 0.02 })
  assert.ok(assisted.interventions > 0)
  assert.notEqual(assisted.outcome, 'autonomous-success')
  const autonomous = runLoop({})
  assert.equal(autonomous.interventions, 0)
  assert.equal(autonomous.outcome, 'autonomous-success')
})

test('with no operator available the run aborts rather than continuing unmonitored', () => {
  const aborted = runLoop({ monitorThreshold: 0.02, interventionAvailable: false })
  assert.equal(aborted.outcome, 'aborted')
  assert.ok(aborted.monitorFirings > 0)
  assert.equal(aborted.interventions, 0)
  // An abort is never dressed up as a success, even if the error was small.
  assert.notEqual(aborted.outcome, 'assisted-success')
  assert.notEqual(aborted.outcome, 'autonomous-success')
})

test('every report carries the limits of what it can mean', () => {
  const report = runLoop({})
  assert.ok(report.limitations.length >= 4)
  const text = report.limitations.join(' ')
  assert.match(text, /simulation/i)
  assert.match(text, /not evidence about any robot/i)
  assert.match(text, /cannot see the true state/i)
  // The configuration travels with the result, so a number cannot be quoted
  // without the conditions that produced it.
  assert.deepEqual(report.config, { ...DEFAULT_CONFIG })
})

test('it refuses a configuration that cannot mean anything', () => {
  const refusals: [string, () => unknown][] = [
    ['negative noise', () => runLoop({ observationNoise: -0.1 })],
    ['negative delay', () => runLoop({ actuationDelaySteps: -1 })],
    ['fractional delay', () => runLoop({ actuationDelaySteps: 1.5 })],
    ['zero gain', () => runLoop({ gain: 0 })],
    ['zero tolerance', () => runLoop({ tolerance: 0 })],
    ['zero steps', () => runLoop({ steps: 0 })],
    ['non-finite gain', () => runLoop({ gain: Number.POSITIVE_INFINITY })],
  ]
  for (const [name, call] of refusals) {
    assert.throws(call, /must/, `${name} should be refused`)
  }
})
