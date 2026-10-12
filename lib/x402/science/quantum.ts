import { requireCondition as check, positive, linearFit, oscillationFit, unique } from './math.ts'
type Input = Record<string, unknown>
export type Rho = { real: number[]; imag: number[] }
const tolerance = 1e-9
export function stateValidity(state: Rho) {
  const [a, b, c, d] = state.real, [ai, bi, ci, di] = state.imag
  const hermitian = Math.abs(ai) <= tolerance && Math.abs(di) <= tolerance && Math.abs(b - c) <= tolerance && Math.abs(bi + ci) <= tolerance
  const traceReal = a + d, traceImag = ai + di
  const minimumEigenvalue = hermitian ? (a + d - Math.sqrt((a - d) ** 2 + 4 * (b * b + bi * bi))) / 2 : null
  const issues: string[] = []
  if (!hermitian) issues.push('not-hermitian')
  if (Math.abs(traceReal - 1) > tolerance || Math.abs(traceImag) > tolerance) issues.push('trace-not-one')
  if (minimumEigenvalue !== null && minimumEigenvalue < -tolerance) issues.push('not-positive-semidefinite')
  return { valid: !issues.length, traceReal, traceImag, hermitian, minimumEigenvalue, tolerance, issues }
}
function validRho(value: unknown): Rho { const s = value as Rho; check(stateValidity(s).valid); return s }
function purity(s: Rho) { return s.real[0] ** 2 + s.real[3] ** 2 + 2 * (s.real[1] ** 2 + s.imag[1] ** 2) }
const clamp = (x: number) => Math.max(0, Math.min(1, x))

type Generator = { pauli: string; sign: string }
const pauliMultiplication: Record<string, [string, number]> = {
  XX: ['I', 0], YY: ['I', 0], ZZ: ['I', 0], XY: ['Z', 1], YX: ['Z', 3], YZ: ['X', 1], ZY: ['X', 3], ZX: ['Y', 1], XZ: ['Y', 3],
}
function multiply(a: { p: string; phase: number }, b: { p: string; phase: number }) {
  let phase = a.phase + b.phase, p = ''
  for (let k = 0; k < a.p.length; k++) {
    if (a.p[k] === 'I') p += b.p[k]
    else if (b.p[k] === 'I') p += a.p[k]
    else { const r = pauliMultiplication[a.p[k] + b.p[k]]; p += r[0]; phase += r[1] }
  }
  return { p, phase: phase % 4 }
}
function stabilizers(generators: Generator[]) {
  const n = generators[0].pauli.length
  check(generators.every(g => g.pauli.length === n))
  const issues: string[] = []
  for (let a = 0; a < generators.length; a++) for (let b = a + 1; b < generators.length; b++) {
    let anti = 0
    for (let j = 0; j < n; j++) if (generators[a].pauli[j] !== 'I' && generators[b].pauli[j] !== 'I' && generators[a].pauli[j] !== generators[b].pauli[j]) anti++
    if (anti % 2) issues.push(`anticommuting:${a}:${b}`)
  }
  const commuting = !issues.length
  if (!commuting) return { commuting, consistent: false, independentGenerators: 0, logicalQubits: n, issues, method: 'phase-aware-Pauli-GF2-elimination; rank withheld when noncommuting' }
  const pivots = new Map<number, { p: string; phase: number }>()
  for (const g of generators) {
    let row = { p: g.pauli, phase: g.sign === '-' ? 2 : 0 }
    for (let j = 0; j < 2 * n; j++) {
      const letter = row.p[j % n], bit = j < n ? letter === 'X' || letter === 'Y' : letter === 'Z' || letter === 'Y'
      if (!bit) continue
      const pivot = pivots.get(j)
      if (pivot) row = multiply(row, pivot)
      else { pivots.set(j, row); break }
    }
    if (/^I+$/.test(row.p) && row.phase !== 0) issues.push('dependent-generators-imply-negative-identity')
  }
  return { commuting, consistent: !issues.length, independentGenerators: pivots.size, logicalQubits: n - pivots.size, issues, method: 'phase-aware-Pauli-GF2-elimination' }
}
export function quantumProduct(id: string, i: Input): Record<string, unknown> {
  switch (id) {
    case 'quantum-measurement-uncertainty': {
      const counts = i.counts as number[], shots = counts.reduce((s, c) => s + c, 0); positive(shots)
      const probabilities = counts.map(c => c / shots), z = 1.959963984540054
      const intervals = probabilities.map(p => { const denom = 1 + z * z / shots, center = (p + z * z / (2 * shots)) / denom,
        half = z * Math.sqrt(p * (1 - p) / shots + z * z / (4 * shots * shots)) / denom
        return { lower: clamp(center - half), upper: clamp(center + half) } })
      return { shots, probabilities, intervals, coverage: '95% marginal per outcome; not simultaneous multinomial coverage', method: 'Wilson-score-binomial' }
    }
    case 'quantum-state-validity': return stateValidity(i.state as Rho)
    case 'quantum-observable-expectations': {
      const s = validRho(i.state)
      return { X: 2 * s.real[1] + 0, Y: -2 * s.imag[1] + 0, Z: s.real[0] - s.real[3] + 0, convention: 'single-qubit computational basis [0,1]; Pauli Y=[[0,-i],[i,0]]' }
    }
    case 'quantum-state-fidelity-purity': {
      const a = validRho(i.state), b = validRho(i.reference)
      const det = (s: Rho) => Math.max(0, s.real[0] * s.real[3] - s.real[1] ** 2 - s.imag[1] ** 2)
      const traceProduct = a.real[0] * b.real[0] + a.real[3] * b.real[3] + 2 * (a.real[1] * b.real[1] + a.imag[1] * b.imag[1])
      return { fidelity: clamp(traceProduct + 2 * Math.sqrt(det(a) * det(b))), purity: clamp(purity(a)), referencePurity: clamp(purity(b)), convention: 'squared Uhlmann fidelity; Tr(rho*sigma)+2*sqrt(det(rho)*det(sigma)); purity Tr(rho^2)' }
    }
    case 'quantum-coherence-budget': {
      const t = i.durationSeconds as number, t1 = positive(i.T1Seconds as number), t2 = positive(i.T2Seconds as number)
      const physicalT2Constraint = t2 <= 2 * t1 * (1 + 1e-9)
      const rate = 1 / t2 - 1 / (2 * t1)
      return { relaxationSurvival: Math.exp(-t / t1), coherenceFraction: Math.exp(-t / t2), pureDephasingSeconds: physicalT2Constraint && rate > 1e-12 ? 1 / rate : null, physicalT2Constraint, model: 'Markovian-exponential; no device performance prediction' }
    }
    case 'quantum-readout-calibration': {
      const a = i.pZeroGivenZero as number, b = i.pZeroGivenOne as number, determinant = a - b
      check(Math.abs(determinant) >= 1e-6)
      const correctedZeroFraction = ((i.observedZeroFraction as number) - b) / determinant
      return { correctedZeroFraction, physical: correctedZeroFraction >= 0 && correctedZeroFraction <= 1, determinant, inverseSensitivity: 1 / Math.abs(determinant), correctedClipped: false, convention: 'rows observed, columns true; unregularized single-qubit inversion; calibration uncertainty not estimated' }
    }
    case 'quantum-circuit-lint': {
      const n = i.qubits as number, operations = i.operations as { gate: string; targets: number[]; angleRadians: number }[]
      const issues: string[] = [], layers = Array(n).fill(0), measured = new Set<number>()
      operations.forEach((o, k) => {
        const arity = ['CX', 'CZ'].includes(o.gate) ? 2 : 1
        if (o.targets.length !== arity || !unique(o.targets) || o.targets.some(q => q >= n)) { issues.push(`invalid-targets:${k}`); return }
        if (!['RX', 'RY', 'RZ'].includes(o.gate) && o.angleRadians !== 0) issues.push(`unexpected-angle:${k}`)
        if (o.targets.some(q => measured.has(q))) issues.push(`operation-after-measurement:${k}`)
        const depth = 1 + Math.max(...o.targets.map(q => layers[q])); o.targets.forEach(q => { layers[q] = depth })
        if (o.gate === 'MEASURE') o.targets.forEach(q => measured.add(q))
      })
      return { valid: !issues.length, issues, operationCount: operations.length, depth: Math.max(1, ...layers), simulated: false }
    }
    case 'quantum-randomized-benchmarking-fit': {
      const x = i.lengths as number[], y = i.survival as number[], offset = i.offset as number
      check(y.every(v => v > offset)); const transformedFit = linearFit(x, y.map(v => Math.log(v - offset)))
      const p = Math.exp(transformedFit.slope), A = Math.exp(transformedFit.intercept)
      return { decayPerClifford: p, errorPerClifford: (1 - p) * ((i.dimension as number) - 1) / (i.dimension as number), physicalDecay: p > 0 && p <= 1,
        transformedFit, residuals: x.map((v, k) => y[k] - (A * p ** v + offset)), method: 'fixed-offset log-linear unweighted RB; offset assumed, not fitted; not error per native gate' }
    }
    case 'quantum-rabi-ramsey-analysis': return { ...oscillationFit(i.timesSeconds as number[], i.signal as number[], i.frequencyRangeHz as number[], i.decayRangeSeconds as number[]), kind: i.kind, method: '21x21 frequency-decay grid; linear offset/sine/cosine amplitudes; resolution and boundary diagnostic, not a confidence interval' }
    case 'quantum-stabilizer-consistency': return stabilizers(i.generators as Generator[])
    case 'quantum-surface-code-resource-scenario': {
      const d = i.distance as number, p = i.physicalError as number, threshold = positive(i.threshold as number)
      check(d % 2 === 1 && p < threshold && (i.prefactor as number) > 0 && (i.prefactor as number) <= 1)
      const errorPerLogicalCycle = (i.prefactor as number) * (p / threshold) ** ((d + 1) / 2)
      return { physicalQubits: (i.logicalQubits as number) * (2 * d * d - 1), errorPerLogicalCycle, unionBoundFailure: Math.min(1, errorPerLogicalCycle * (i.logicalQubits as number) * (i.cycles as number)),
        assumptions: ['rotated patches: 2*d^2-1 physical qubits per logical qubit', 'no routing, factory or spare-qubit overhead', 'caller-supplied threshold and prefactor; phenomenological scaling below threshold', 'union bound, not empirical logical error rate'] }
    }
    case 'quantum-benchmark-comparability': {
      const a = i.baseline as Input, b = i.candidate as Input
      const mismatches = ['protocolVersion', 'workload', 'metric', 'noiseModel', 'shots', 'qubits', 'compilationPolicy', 'overheadIncluded'].filter(k => a[k] !== b[k])
      return { comparableDeclarations: !mismatches.length, mismatches, independentProtocolValidation: false }
    }
    case 'quantum-architecture-requirements': {
      const options = i.options as { id: string; qubits: number; connectivity: string; gateSeconds: number; source: string }[]
      check(unique(options.map(o => o.id))); positive(i.maximumGateSeconds as number)
      const order = ['line', 'grid', 'all-to-all']
      return { assessments: options.map(o => { positive(o.gateSeconds); const gaps: string[] = []
        if (o.qubits < (i.requiredQubits as number)) gaps.push('insufficient-qubits')
        if (order.indexOf(o.connectivity) < order.indexOf(i.requiredConnectivity as string)) gaps.push('connectivity-model-insufficient')
        if (o.gateSeconds > (i.maximumGateSeconds as number)) gaps.push('gate-duration-exceeds-limit')
        return { id: o.id, meetsDeclaredConstraints: !gaps.length, gaps }
      }), factualCapabilitiesVerified: false }
    }
    default: throw new Error('unsupported_quantum_product')
  }
}
