import type { PolicyNode } from './policy-graph.ts'

/** Browser-safe arithmetic shared with the validated server receipt engine. */
export function calculatePolicyVariables(policy: PolicyNode, scenario: {
  adoptionRate: number; baselineOverrides?: Record<string, number>; impactOverrides?: Record<string, number>
}) {
  if (!Number.isFinite(scenario.adoptionRate) || scenario.adoptionRate < 0 || scenario.adoptionRate > 1) throw new Error('Invalid adoption rate.')
  const baselines = scenario.baselineOverrides ?? {}, impacts = scenario.impactOverrides ?? {}
  const names = new Set(policy.economicVariables.map(v => v.name))
  if (Object.keys(baselines).some(name => !names.has(name))) throw new Error('Unknown baseline variable.')
  if (Object.keys(impacts).some(name => !names.has(name))) throw new Error('Unknown impact variable.')
  return policy.economicVariables.map(v => {
    const baseline = baselines[v.name] ?? v.baselineValue
    const assumedImpact = impacts[v.name] ?? v.projectedImpactDelta
    if (!Number.isFinite(assumedImpact) || assumedImpact < v.confidenceInterval[0] || assumedImpact > v.confidenceInterval[1]) throw new Error('Impact assumption must remain inside supplied bounds.')
    const delta = scenario.adoptionRate * assumedImpact
    const result = { name: v.name, unit: v.unit, baseline, delta, projectedValue: baseline + delta,
      scenarioBounds: v.confidenceInterval.map(bound => baseline + scenario.adoptionRate * bound) }
    if (![baseline, delta, result.projectedValue, ...result.scenarioBounds].every(Number.isFinite)) throw new Error('Scenario arithmetic exceeds finite numeric range.')
    return result
  })
}
