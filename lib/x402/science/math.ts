/** Bounded, double-precision research calculations. Never reads files or networks. */
export function requireCondition(ok: unknown): asserts ok {
  if (!ok) throw new Error('unsupported_science_input')
}
export function positive(x: number): number { requireCondition(Number.isFinite(x) && x > 1e-12); return x }
export function finite(x: number): number { requireCondition(Number.isFinite(x)); return x }
export const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
export function unique(a: unknown[]): boolean { return new Set(a).size === a.length }
export function increasing(a: number[]): boolean { return a.every((v, i) => i === 0 || v > a[i - 1]) }
export function paired(x: number[], y: number[], minimum = 3) {
  requireCondition(x.length === y.length && x.length >= minimum && unique(x))
}
export function linearFit(x: number[], y: number[]) {
  paired(x, y)
  const xm = mean(x), ym = mean(y)
  const xx = x.reduce((s, v) => s + (v - xm) ** 2, 0)
  requireCondition(xx > 1e-24)
  const slope = finite(x.reduce((s, v, i) => s + (v - xm) * (y[i] - ym), 0) / xx)
  const intercept = finite(ym - slope * xm)
  const residuals = x.map((v, i) => y[i] - (intercept + slope * v))
  const sse = residuals.reduce((s, v) => s + v * v, 0)
  const total = y.reduce((s, v) => s + (v - ym) ** 2, 0)
  const residualStandardError = Math.sqrt(sse / (x.length - 2))
  return { slope, intercept, rSquared: total === 0 ? null : 1 - sse / total, residuals, residualStandardError,
    slopeStandardError: residualStandardError / Math.sqrt(xx), degreesOfFreedom: x.length - 2 }
}
export function weightedQuantile(values: number[], weights: number[], fraction: number) {
  requireCondition(values.length === weights.length && weights.every(w => w >= 0))
  const total = positive(weights.reduce((s, v) => s + v, 0))
  const rows = values.map((v, i) => ({ v, w: weights[i] })).sort((a, b) => a.v - b.v)
  let sum = 0
  for (const row of rows) { sum += row.w; if (row.w > 0 && sum >= total * fraction) return row.v }
  return rows[rows.length - 1].v
}
export function matchedPeaks(observed: number[], reference: number[], tolerance: number) {
  positive(tolerance)
  requireCondition(unique(observed) && unique(reference))
  // Greedy nearest unused reference; deterministic tie-break by input index. Not an optimal assignment.
  const used = new Set<number>()
  return observed.map((value, observedIndex) => {
    const candidates = reference.map((v, i) => ({ i, delta: value - v })).filter(r => !used.has(r.i) && Math.abs(r.delta) <= tolerance)
      .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta) || a.i - b.i)
    const best = candidates[0]
    if (best) used.add(best.i)
    return { observedIndex, referenceIndex: best?.i ?? null, delta: best?.delta ?? null }
  })
}
export function solve3(matrix: number[][], rhs: number[]): number[] | null {
  const m = matrix.map((r, i) => [...r, rhs[i]])
  const scale = Math.max(...matrix.flat().map(Math.abs))
  for (let j = 0; j < 3; j++) {
    let pivot = j
    for (let k = j + 1; k < 3; k++) if (Math.abs(m[k][j]) > Math.abs(m[pivot][j])) pivot = k
    if (Math.abs(m[pivot][j]) <= scale * 1e-12) return null
    ;[m[j], m[pivot]] = [m[pivot], m[j]]
    const divisor = m[j][j]
    for (let k = j; k < 4; k++) m[j][k] /= divisor
    for (let i = 0; i < 3; i++) if (i !== j) { const factor = m[i][j]; for (let k = j; k < 4; k++) m[i][k] -= factor * m[j][k] }
  }
  return m.map(r => finite(r[3]))
}
export function oscillationFit(times: number[], signal: number[], frequencyRange: number[], decayRange: number[]) {
  paired(times, signal, 8); requireCondition(increasing(times))
  requireCondition(frequencyRange[0] > 0 && frequencyRange[1] > frequencyRange[0] && decayRange[0] > 0 && decayRange[1] > decayRange[0])
  const maximumStep = Math.max(...times.slice(1).map((t, i) => t - times[i]))
  requireCondition(frequencyRange[1] < 0.5 / maximumStep)
  const candidates: { frequency: number; decay: number; coefficients: number[]; sse: number; residuals: number[]; edge: boolean }[] = []
  for (let f = 0; f <= 20; f++) for (let d = 0; d <= 20; d++) {
    const frequency = frequencyRange[0] + f * (frequencyRange[1] - frequencyRange[0]) / 20
    const decay = decayRange[0] + d * (decayRange[1] - decayRange[0]) / 20
    const rows = times.map(t => [1, Math.exp(-t / decay) * Math.cos(2 * Math.PI * frequency * t), Math.exp(-t / decay) * Math.sin(2 * Math.PI * frequency * t)])
    const m = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => rows.reduce((s, r) => s + r[i] * r[j], 0)))
    const b = Array.from({ length: 3 }, (_, i) => rows.reduce((s, r, k) => s + r[i] * signal[k], 0))
    const coefficients = solve3(m, b)
    if (!coefficients) continue
    const residuals = rows.map((r, k) => signal[k] - r.reduce((s, v, i) => s + v * coefficients[i], 0))
    candidates.push({ frequency, decay, coefficients, residuals, sse: residuals.reduce((s, v) => s + v * v, 0), edge: f === 0 || f === 20 || d === 0 || d === 20 })
  }
  candidates.sort((a, b) => a.sse - b.sse)
  requireCondition(candidates.length > 1)
  const best = candidates[0]
  return { frequency: best.frequency, decay: best.decay, offset: best.coefficients[0], amplitude: Math.hypot(best.coefficients[1], best.coefficients[2]),
    phaseRadians: Math.atan2(-best.coefficients[2], best.coefficients[1]), residuals: best.residuals,
    residualStandardError: Math.sqrt(best.sse / (times.length - 5)), boundaryHit: best.edge,
    frequencyResolution: (frequencyRange[1] - frequencyRange[0]) / 20, decayResolution: (decayRange[1] - decayRange[0]) / 20,
    parameterConfidenceInterval: null, evaluatedModels: candidates.length }
}
