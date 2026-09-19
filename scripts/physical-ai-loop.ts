/** Local, offline perception–action fixture. No network, no writes, no hardware. */
import { COUNTEREXAMPLES, runLoop, type LoopConfig } from '../lib/physical-ai-loop.ts'

const args = process.argv.slice(2)
const mode = args[0] ?? 'run'
const flag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? Number(args[i + 1]) : undefined }
const overrides: Partial<LoopConfig> = {}
for (const key of ['seed', 'actuationDelaySteps', 'observationNoise', 'monitorThreshold', 'gain', 'steps', 'tolerance'] as const) {
  const value = flag(key)
  if (value !== undefined) overrides[key] = value as never
}

if (mode === 'counterexamples') {
  const latency = COUNTEREXAMPLES.latencyChangesOutcome()
  const monitor = COUNTEREXAMPLES.tightMonitorAddsNuisance()
  console.log(JSON.stringify({
    latency: { withoutDelay: latency.withoutDelay.outcome, withDelay: latency.withDelay.outcome },
    monitor: {
      calibrated: { outcome: monitor.calibrated.outcome, falseInterventions: monitor.calibrated.falseInterventions },
      tooTight: { outcome: monitor.tooTight.outcome, falseInterventions: monitor.tooTight.falseInterventions, interventions: monitor.tooTight.interventions },
    },
  }, null, 2))
} else {
  console.log(JSON.stringify(runLoop(overrides), null, 2))
}
