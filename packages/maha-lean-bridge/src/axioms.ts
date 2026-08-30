/**
 * The single axiom policy, shared by CI and offline verification.
 *
 * Both paths must agree on what a sound proof looks like. When they were two
 * implementations they disagreed: CI rejected missing reports and unexpected
 * axioms while the package verifier only looked for `sorryAx`, so a theorem
 * resting on a user-declared axiom passed offline and failed in CI. This module
 * exists so that divergence cannot recur.
 */

/**
 * The only axioms a proof here may rest on.
 *
 * These three are Lean's own. Anything else — most importantly `sorryAx`, but
 * equally an `axiom` someone declared to make a proof go through — means the
 * statement was assumed rather than proved.
 */
export const PERMITTED_AXIOMS: readonly string[] = ['propext', 'Classical.choice', 'Quot.sound']

export interface AxiomReport {
  theorem: string
  /** Empty when Lean reported the theorem depends on no axiom at all. */
  axioms: string[]
  axiomFree: boolean
}

export interface AxiomPolicyResult {
  ok: boolean
  problems: string[]
  reports: AxiomReport[]
  axiomFree: number
  restingOnPermittedAxiomsOnly: number
}

/**
 * Parses `#print axioms` output.
 *
 * Lean emits one of two forms per theorem:
 *
 *   'Name' depends on axioms: [a, b, c]
 *   'Name' does not depend on any axioms
 *
 * The second is the *stronger* result, not a missing one, so it is recognised
 * explicitly rather than falling through to the "no report" branch.
 */
export function parseAxiomReports(output: string): AxiomReport[] {
  const reports: AxiomReport[] = []
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    const axiomFree = /^'([^']+)' does not depend on any axioms/.exec(trimmed)
    if (axiomFree) {
      reports.push({ theorem: axiomFree[1], axioms: [], axiomFree: true })
      continue
    }
    const parsed = /^'([^']+)' depends on axioms: \[([^\]]*)\]/.exec(trimmed)
    if (!parsed) continue
    reports.push({
      theorem: parsed[1],
      axioms: parsed[2].split(',').map((a) => a.trim()).filter(Boolean),
      axiomFree: false,
    })
  }
  return reports
}

/**
 * Applies the policy to Lean's output for an expected set of theorems.
 *
 * Every expected theorem must produce exactly one attributable report. A
 * missing report means the theorem is not in the build; a duplicate means the
 * output cannot be attributed unambiguously, and an ambiguous result must fail
 * rather than be resolved by guessing.
 */
export function evaluateAxiomPolicy(output: string, expected: readonly string[]): AxiomPolicyResult {
  const problems: string[] = []
  const reports = parseAxiomReports(output)
  const counts = new Map<string, number>()
  for (const report of reports) counts.set(report.theorem, (counts.get(report.theorem) ?? 0) + 1)

  // Checked first and independently of attribution: a sorryAx anywhere in the
  // output invalidates the run even if the line could not be parsed.
  if (/\bsorryAx\b/.test(output)) {
    problems.push('A theorem depends on sorryAx: the proof is unfinished.')
  }

  for (const report of reports) {
    const unexpected = report.axioms.filter((axiom) => !PERMITTED_AXIOMS.includes(axiom))
    if (unexpected.length > 0) {
      problems.push(`${report.theorem} depends on ${unexpected.join(', ')}`)
    }
  }

  for (const name of expected) {
    const seen = counts.get(name) ?? 0
    if (seen === 0) problems.push(`${name} produced no axiom report; it may not exist in the build.`)
    else if (seen > 1) problems.push(`${name} produced ${seen} axiom reports; attribution is ambiguous.`)
  }

  const expectedSet = new Set(expected)
  const relevant = reports.filter((report) => expectedSet.has(report.theorem))
  const axiomFree = relevant.filter((report) => report.axiomFree).length

  return {
    ok: problems.length === 0,
    problems,
    reports,
    axiomFree,
    restingOnPermittedAxiomsOnly: relevant.length - axiomFree,
  }
}
