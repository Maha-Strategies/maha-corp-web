import { digestOf } from '../celestial-hypotheses/canonical.ts'
import type { CorpusSamplingPlan, CorpusScheduleCandidate } from './types.ts'

export function generateSystematicSchedule(plan: CorpusSamplingPlan): CorpusScheduleCandidate[] {
  const candidates: CorpusScheduleCandidate[] = []
  const endMs = Date.parse(plan.windowEndUtc)
  const durationMs = plan.intervalMinutes * 60_000
  const cadenceMs = plan.cadenceMinutes * 60_000
  for (let startMs = Date.parse(plan.anchorUtc); startMs + durationMs <= endMs; startMs += cadenceMs) {
    const intervalStartUtc = new Date(startMs).toISOString()
    const intervalEndUtc = new Date(startMs + durationMs).toISOString()
    candidates.push({
      candidateId: `candidate_${digestOf({ planVersion: plan.planVersion, intervalStartUtc, intervalEndUtc }).slice(7, 23)}`,
      intervalStartUtc,
      intervalEndUtc,
      selectionMethod: 'systematic-clock',
      status: 'candidate-needs-absence-evidence',
    })
    if (candidates.length > 10_000) throw new Error('Sampling plan exceeds the 10,000-candidate safety limit.')
  }
  return candidates
}

