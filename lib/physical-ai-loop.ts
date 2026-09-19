/**
 * A deterministic perception–action fixture.
 *
 * One-dimensional tracking with observation noise, actuation delay, an
 * uncertainty monitor and an intervention path. It exists to make the
 * accounting visible: how latency changes a closed-loop outcome at constant
 * perception quality, how a monitor threshold trades false interventions
 * against missed ones, and what an honest run report contains.
 *
 * It is a simulation. There is no physics, no contact, no hardware and no
 * person in the loop. Nothing it prints is evidence about a real robot's
 * capability or safety, and its numbers are properties of this fixture.
 */

export const FIXTURE_VERSION = 'maha-physical-ai-loop/0.1'

export type LoopConfig = {
  seed: number
  /** Steps of delay between an observation and the action computed from it. */
  actuationDelaySteps: number
  /** Standard deviation of observation noise, in the same units as position. */
  observationNoise: number
  /** Monitor fires when the observation disagrees with the estimate by more than this. */
  monitorThreshold: number
  /** Proportional gain of the controller. */
  gain: number
  steps: number
  /** Distance from the target that counts as success. */
  tolerance: number
  /** Whether an operator is available to intervene when the monitor fires. */
  interventionAvailable: boolean
  /**
   * Optional injected disturbance: the step at which the true state jumps.
   * Without one the scenario contains no anomaly at all, so every monitor
   * firing is by construction a false alarm — which is itself worth seeing.
   */
  anomalyStep?: number
  anomalyMagnitude?: number
}

export const DEFAULT_CONFIG: LoopConfig = {
  seed: 7,
  actuationDelaySteps: 0,
  observationNoise: 0.05,
  monitorThreshold: 1,
  gain: 0.55,
  steps: 40,
  tolerance: 0.05,
  interventionAvailable: true,
}

export type StepRecord = {
  step: number
  truePosition: number
  observation: number
  /** The observation the controller actually used, given the delay. */
  actedOn: number
  command: number
  monitorFired: boolean
  intervened: boolean
}

export type LoopOutcome = 'autonomous-success' | 'assisted-success' | 'failure' | 'aborted'

export type LoopReport = {
  version: string
  config: LoopConfig
  outcome: LoopOutcome
  steps: number
  finalError: number
  interventions: number
  monitorFirings: number
  /** Firings attributable to the injected disturbance, if one was injected. */
  trueInterventions: number
  /** Firings with no disturbance to explain them: nuisance alarms. */
  falseInterventions: number
  /** The last recorded step, kept whatever the outcome. */
  lastStep: StepRecord | null
  limitations: string[]
}

/** Deterministic PRNG: mulberry32, so a seed reproduces a run exactly. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box–Muller from two uniforms, so noise is reproducible with the seed. */
function gaussian(next: () => number): number {
  const u = Math.max(next(), Number.EPSILON)
  const v = next()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function validate(config: LoopConfig): void {
  const numbers: [keyof LoopConfig, number][] = [
    ['actuationDelaySteps', config.actuationDelaySteps],
    ['observationNoise', config.observationNoise],
    ['monitorThreshold', config.monitorThreshold],
    ['gain', config.gain],
    ['steps', config.steps],
    ['tolerance', config.tolerance],
  ]
  for (const [field, value] of numbers) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be a finite number.`)
    if (value < 0) throw new Error(`${field} must not be negative.`)
  }
  if (!Number.isInteger(config.actuationDelaySteps)) throw new Error('actuationDelaySteps must be a whole number of steps.')
  if (config.steps < 1) throw new Error('steps must be at least 1.')
  if (config.gain <= 0) throw new Error('gain must be greater than zero, or the controller never acts.')
  if (config.tolerance <= 0) throw new Error('tolerance must be greater than zero.')
}

/**
 * Run the loop. The target is 0; the system starts at 1 and the controller
 * drives it toward the target using an observation that is `delay` steps old.
 */
export function runLoop(overrides: Partial<LoopConfig> = {}): LoopReport {
  const config = { ...DEFAULT_CONFIG, ...overrides }
  validate(config)
  const next = rng(config.seed)
  const history: StepRecord[] = []
  const observations: number[] = []
  let position = 1
  let estimate = 1
  let interventions = 0
  let monitorFirings = 0
  let trueInterventions = 0
  let falseInterventions = 0
  let aborted = false
  const anomalyStep = config.anomalyStep
  const anomalyMagnitude = config.anomalyMagnitude ?? 0
  // A firing counts as true only in the two steps after the disturbance; any
  // other firing had nothing in the scenario to detect.
  const explainedBy = (step: number) => anomalyStep !== undefined && step >= anomalyStep && step <= anomalyStep + 2

  for (let step = 0; step < config.steps; step += 1) {
    if (anomalyStep !== undefined && step === anomalyStep) position += anomalyMagnitude
    const observation = position + gaussian(next) * config.observationNoise
    observations.push(observation)
    // The controller sees an observation `delay` steps old; before that it has
    // nothing newer than its starting estimate.
    const index = observations.length - 1 - config.actuationDelaySteps
    const actedOn = index >= 0 ? observations[index] : 1

    // A trivial monitor: disagreement between the freshest observation and the
    // running estimate. It cannot see the true state, which is the point.
    const disagreement = Math.abs(observation - estimate)
    const monitorFired = disagreement > config.monitorThreshold
    if (monitorFired) {
      monitorFirings += 1
      if (explainedBy(step)) trueInterventions += 1
      else falseInterventions += 1
    }

    let intervened = false
    if (monitorFired && config.interventionAvailable) {
      // The operator halts motion for this step and re-seeds the estimate.
      intervened = true
      interventions += 1
      estimate = observation
      history.push({ step, truePosition: position, observation, actedOn, command: 0, monitorFired, intervened })
      continue
    }
    if (monitorFired && !config.interventionAvailable) {
      // No operator: the run stops rather than continuing into an unmonitored state.
      aborted = true
      history.push({ step, truePosition: position, observation, actedOn, command: 0, monitorFired, intervened })
      break
    }

    const command = -config.gain * actedOn
    position += command
    estimate = observation
    history.push({ step, truePosition: position, observation, actedOn, command, monitorFired, intervened })
    if (Math.abs(position) <= config.tolerance && step >= config.actuationDelaySteps) break
  }

  const finalError = Math.abs(position)
  const succeeded = !aborted && finalError <= config.tolerance
  const outcome: LoopOutcome = aborted
    ? 'aborted'
    : succeeded
      ? interventions > 0 ? 'assisted-success' : 'autonomous-success'
      : 'failure'

  return {
    version: FIXTURE_VERSION,
    config,
    outcome,
    steps: history.length,
    finalError,
    interventions,
    monitorFirings,
    trueInterventions,
    falseInterventions,
    lastStep: history.at(-1) ?? null,
    limitations: [
      'Synthetic one-dimensional simulation: no physics, contact, hardware or person.',
      'The monitor compares observations with a running estimate; it cannot see the true state.',
      'An assisted success is never reported as autonomous, and an aborted run is never reported as a success.',
      'These numbers describe this fixture only, and are not evidence about any robot.',
    ],
  }
}

/** The two shipped counterexamples, so the failure cases are runnable too. */
export const COUNTEREXAMPLES = {
  /**
   * Same controller, same noise, same seed, monitor held off in both arms so
   * that nothing rescues the delayed run: only the loop delay differs.
   */
  latencyChangesOutcome: () => ({
    withoutDelay: runLoop({ actuationDelaySteps: 0, monitorThreshold: 5 }),
    withDelay: runLoop({ actuationDelaySteps: 3, monitorThreshold: 5 }),
  }),
  /** A threshold tightened past the noise floor buys nuisance, not safety. */
  tightMonitorAddsNuisance: () => ({
    calibrated: runLoop({ monitorThreshold: 1 }),
    tooTight: runLoop({ monitorThreshold: 0.02 }),
  }),
  /** With a real disturbance, a firing has something to explain. */
  monitorCatchesDisturbance: () => ({
    withDisturbance: runLoop({ monitorThreshold: 0.35, anomalyStep: 3, anomalyMagnitude: 2 }),
    withoutDisturbance: runLoop({ monitorThreshold: 0.35 }),
  }),
}
