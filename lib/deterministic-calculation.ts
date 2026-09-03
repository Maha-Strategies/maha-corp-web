import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'

/**
 * A calculation that a reader can check.
 *
 * Eight batches emitted none, because no source supplied variables, units,
 * assumptions and uncertainty together. The requirement stands: the method
 * must come from an inspected passage, every input must be stated, and the
 * arithmetic must recompute to the same receipt on any machine.
 */

export interface CalculationInput {
  symbol: string
  value: number
  unit: string
  meaning: string
}

export interface DeterministicCalculation {
  id: string
  /** The function under study, stated rather than encoded as a numeric input. */
  functionUnderStudy: string
  /** The passage defining the method. Not the caller's own construction. */
  methodSource: { sourceId: string; exactLocator: string; statedMethod: string }
  inputs: readonly CalculationInput[]
  assumptions: readonly string[]
  uncertaintyTreatment: string
  steps: readonly { n: number; value: number }[]
  result: { value: number; unit: string }
  /** Recomputable from inputs alone, so a reader can verify independently. */
  receipt: string
}

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`

/**
 * Newton's rule, as stated at DLMF 3.8.4.
 *
 * The iteration is the source's; the worked values are arithmetic on stated
 * inputs. Nothing here is estimated, and the receipt covers the inputs and
 * every step so a divergent implementation is visible rather than silent.
 */
export function newtonRoot(
  f: (x: number) => number, fPrime: (x: number) => number,
  x0: number, iterations: number,
): { steps: { n: number; value: number }[]; result: number } {
  const steps: { n: number; value: number }[] = [{ n: 0, value: x0 }]
  let x = x0
  for (let n = 1; n <= iterations; n++) {
    const denominator = fPrime(x)
    if (denominator === 0) throw new Error('Newton’s rule is undefined where the derivative vanishes.')
    x = x - f(x) / denominator
    // Rounded to a fixed precision so the receipt is identical everywhere.
    steps.push({ n, value: Number(x.toFixed(12)) })
  }
  return { steps, result: Number(x.toFixed(12)) }
}

export function buildCalculation(
  spec: Omit<DeterministicCalculation, 'receipt' | 'steps' | 'result'>
    & { steps: readonly { n: number; value: number }[]; result: { value: number; unit: string } },
): DeterministicCalculation {
  // The receipt binds method, inputs, assumptions and every step together.
  const receipt = sha({
    method: spec.methodSource, inputs: spec.inputs,
    assumptions: spec.assumptions, steps: spec.steps, result: spec.result,
  })
  return { ...spec, receipt }
}

/** Refuses a calculation missing any of the inputs a reader would need. */
export function assertCalculable(spec: Partial<DeterministicCalculation>): void {
  const missing: string[] = []
  if (!spec.methodSource?.exactLocator) missing.push('method locator')
  if (!spec.inputs?.length) missing.push('inputs')
  if (spec.inputs?.some((i) => !i.unit)) missing.push('units')
  if (!spec.assumptions?.length) missing.push('assumptions')
  if (!spec.uncertaintyTreatment) missing.push('uncertainty treatment')
  if (missing.length > 0) {
    throw new Error(`No calculation may be emitted: missing ${missing.join(', ')}.`)
  }
}
