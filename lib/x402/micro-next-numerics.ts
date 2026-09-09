export type Q = { n: bigint; d: bigint }
const abs = (x: bigint) => x < BigInt(0) ? -x : x
export function q(n: bigint, d = BigInt(1)): Q {
  if (!d || abs(n).toString(2).length > 4096 || abs(d).toString(2).length > 4096) throw new Error('arithmetic-bound')
  if (d < BigInt(0)) { n = -n; d = -d }
  let a = abs(n), b = d
  while (b) { const r = a % b; a = b; b = r }
  return { n: n / a, d: d / a }
}
export const decimal = (x: string): Q => {
  if (!/^-?(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/.test(x)) throw new Error('decimal-required')
  const places = x.includes('.') ? x.length - x.indexOf('.') - 1 : 0
  return q(BigInt(x.replace('.', '')), BigInt(10) ** BigInt(places))
}
export const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d)
export const neg = (a: Q) => q(-a.n, a.d)
export const sub = (a: Q, b: Q) => add(a, neg(b))
export const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d)
export const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n)
export const cmp = (a: Q, b: Q) => a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0
export const wire = (v: Q) => ({ numerator: v.n.toString(), denominator: v.d.toString() })
const zero = () => q(BigInt(0))
const dot = (a: Q[], b: Q[]) => a.reduce((sum, x, i) => add(sum, mul(x, b[i])), zero())

const units: Record<string, { family: string; scale: Q; offset: Q }> = Object.fromEntries([
  ['m', 'length', '1', '0'], ['cm', 'length', '0.01', '0'], ['mm', 'length', '0.001', '0'], ['km', 'length', '1000', '0'],
  ['kg', 'mass', '1', '0'], ['g', 'mass', '0.001', '0'], ['s', 'time', '1', '0'], ['min', 'time', '60', '0'], ['h', 'time', '3600', '0'],
  ['K', 'temperature', '1', '0'], ['degC', 'temperature', '1', '273.15'],
].map(([name, family, scale, offset]) => [name, { family, scale: decimal(scale), offset: decimal(offset) }]))
units.degF = { family: 'temperature', scale: q(BigInt(5), BigInt(9)), offset: sub(decimal('273.15'), q(BigInt(160), BigInt(9))) }

export function convert(input: Record<string, unknown>) {
  const from = units[input.from as string], to = units[input.to as string], value = decimal(input.value as string), u = decimal(input.standardUncertainty as string)
  if (!from || !to || from.family !== to.family || u.n < BigInt(0)) throw new Error('unsupported-conversion')
  const scale = div(from.scale, to.scale)
  const offset = input.quantity === 'difference' ? zero() : div(sub(from.offset, to.offset), to.scale)
  return { value: wire(add(mul(value, scale), offset)), standardUncertainty: wire(mul(u, scale)), scale: wire(scale), offset: wire(offset), from: input.from, to: input.to, quantity: input.quantity, physicalValidityVerified: false }
}

export function linear(matrix: string[][], rhs: string[]) {
  const rows = matrix.length, cols = matrix[0].length
  if (rhs.length !== rows || matrix.some(r => r.length !== cols)) throw new Error('ragged-system')
  const original = matrix.map(r => r.map(decimal)), b = rhs.map(decimal)
  const work = original.map((r, i) => [...r, b[i]]), pivots: number[] = []
  let rank = 0
  for (let col = 0; col < cols && rank < rows; col++) {
    const pivot = work.findIndex((r, i) => i >= rank && r[col].n !== BigInt(0))
    if (pivot < 0) continue
    ;[work[rank], work[pivot]] = [work[pivot], work[rank]]
    const divisor = work[rank][col]
    work[rank] = work[rank].map(x => div(x, divisor))
    for (let i = 0; i < rows; i++) if (i !== rank) { const factor = work[i][col]; work[i] = work[i].map((x, j) => sub(x, mul(factor, work[rank][j]))) }
    pivots.push(col); rank++
  }
  const free = Array.from({ length: cols }, (_, i) => i).filter(i => !pivots.includes(i))
  const inconsistent = work.some(r => r.slice(0, cols).every(x => x.n === BigInt(0)) && r[cols].n !== BigInt(0))
  if (inconsistent) return { state: 'inconsistent', rank, pivotColumns: pivots, freeColumns: free, particular: [], nullspace: [], exactResidualVerified: false, conditioningAssessed: false }
  const particular = Array.from({ length: cols }, zero)
  pivots.forEach((col, row) => { particular[col] = work[row][cols] })
  const basis = free.map(col => { const v = Array.from({ length: cols }, zero); v[col] = q(BigInt(1)); pivots.forEach((p, r) => { v[p] = neg(work[r][col]) }); return v })
  if (original.some((r, i) => cmp(dot(r, particular), b[i]) !== 0) || basis.some(v => original.some(r => dot(r, v).n !== BigInt(0)))) throw new Error('residual-refused')
  return { state: free.length ? 'underdetermined' : 'unique', rank, pivotColumns: pivots, freeColumns: free, particular: particular.map(wire), nullspace: basis.map(v => v.map(wire)), exactResidualVerified: true, conditioningAssessed: false }
}

export function bisect(input: Record<string, unknown>) {
  const coefficients = (input.coefficientsAscending as string[]).map(decimal)
  if (coefficients.at(-1)!.n === BigInt(0)) throw new Error('noncanonical-degree')
  const f = (x: Q) => coefficients.reduceRight((sum, c) => add(mul(sum, x), c), zero())
  let lo = decimal(input.lower as string), hi = decimal(input.upper as string), flo = f(lo)
  const tolerance = decimal(input.tolerance as string)
  if (cmp(lo, hi) >= 0 || tolerance.n <= BigInt(0)) throw new Error('invalid-bracket')
  const result = (state: string, iterations: number) => ({ state, bracket: { lower: wire(lo), upper: wire(hi) }, iterations, uniquenessEstablished: false, method: 'rational-polynomial-bisection' })
  if (flo.n === BigInt(0)) { hi = lo; return result('exact-root', 0) }
  if (f(hi).n === BigInt(0)) { lo = hi; return result('exact-root', 0) }
  if ((flo.n > BigInt(0)) === (f(hi).n > BigInt(0))) throw new Error('no-sign-changing-bracket')
  let iterations = 0
  while (cmp(sub(hi, lo), tolerance) > 0 && iterations < (input.maxIterations as number)) {
    const mid = div(add(lo, hi), q(BigInt(2))), fm = f(mid); iterations++
    if (fm.n === BigInt(0)) { lo = mid; hi = mid; return result('exact-root', iterations) }
    if ((fm.n > BigInt(0)) === (flo.n > BigInt(0))) { lo = mid; flo = fm } else hi = mid
  }
  return result(cmp(sub(hi, lo), tolerance) <= 0 ? 'tolerance-reached' : 'iteration-limit', iterations)
}

export function covariance(input: Record<string, unknown>) {
  const c = (input.sensitivities as string[]).map(decimal), raw = input.covariance as string[][], n = c.length
  if (raw.length !== n || raw.some(r => r.length !== n) || !(input.outputUnit as string).trim()) throw new Error('covariance-shape')
  const C = raw.map(r => r.map(decimal)), work = C.map(r => [...r])
  if (C.some((r, i) => r.some((x, j) => cmp(x, C[j][i]) !== 0))) throw new Error('covariance-not-symmetric')
  // Exact Schur-complement PSD check: a zero pivot requires its remaining row to vanish.
  for (let k = 0; k < n; k++) {
    const pivot = work[k][k]
    if (pivot.n < BigInt(0)) throw new Error('covariance-not-psd')
    if (!pivot.n) { if (work[k].slice(k + 1).some(x => x.n !== BigInt(0))) throw new Error('covariance-not-psd'); continue }
    for (let i = k + 1; i < n; i++) for (let j = k + 1; j < n; j++) work[i][j] = sub(work[i][j], div(mul(work[i][k], work[k][j]), pivot))
  }
  const variance = dot(c, C.map(r => dot(r, c))), scale = BigInt(1000000000)
  const integer = variance.n * scale * scale / variance.d
  let lo = BigInt(0), hi = integer + BigInt(1)
  while (hi - lo > BigInt(1)) { const mid = (lo + hi) / BigInt(2); if (mid * mid <= integer) lo = mid; else hi = mid }
  const exact = lo * lo * variance.d === variance.n * scale * scale
  return { variance: wire(variance), standardUncertainty: { lower: wire(q(lo, scale)), upper: wire(q(exact ? lo : lo + BigInt(1), scale)) }, covariancePositiveSemidefinite: true, outputUnit: input.outputUnit, model: 'first-order-sensitivity-propagation', inputEstimatesVerified: false }
}
