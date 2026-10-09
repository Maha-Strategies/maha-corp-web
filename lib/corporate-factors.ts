import { computeNatalChart, ZODIAC_SIGNS, type NatalChart, type ChartPointName, type ZodiacSign } from './natal-chart.ts'
import { navamsaPosition } from './natal-foundation.ts'
import { dignity, classicalFullAspect, SIGN_LORDS } from './corporate-classical.ts'

export const CORPORATE_FACTOR_VERSION = 'corporate-factors/2.0'
export type Predicate =
  | { kind: 'sign'; chart: 'D1' | 'D9'; point: ChartPointName; sign: ZodiacSign }
  | { kind: 'house'; chart: 'D1' | 'D9'; point: ChartPointName; house: number }
  | { kind: 'own-sign'; chart: 'D1' | 'D9'; point: ChartPointName }
  | { kind: 'dignity'; chart: 'D1' | 'D9'; point: ChartPointName; category: 'exalted' | 'debilitated' | 'moolatrikonaSign' }
  | { kind: 'vargottama'; chart: 'D1'; point: ChartPointName }
  | { kind: 'classical-aspect'; chart: 'D1'; first: ChartPointName; second: ChartPointName; profile: 'iyer-II.13-directed-full-15deg/1.0' }
  | { kind: 'nakshatra'; chart: 'D1'; point: ChartPointName; names: string[] }
  | { kind: 'conjunction' | 'aspect'; chart: 'D1'; first: ChartPointName; second: ChartPointName; angle: number; orb: number; convention: 'geometric-degrees-not-graha-drishti' }
export type FactorResult = { predicate: Predicate; satisfied: boolean; observed: string; state: 'point-in-time' | 'proven-stable' | 'alternatives-observed' | 'interval-unproven'; alternatives: { instantUtc: string; satisfied: boolean; observed: string }[]; proof: string | null }

export function evaluatePredicate(chart: NatalChart, p: Predicate): { satisfied: boolean; observed: string } {
  if (!['D1', 'D9'].includes(p.chart) || (p.chart === 'D9' && !['sign', 'house', 'own-sign', 'dignity'].includes(p.kind))) throw new Error('unsupported-chart')
  const point = (name: ChartPointName) => name === 'Ascendant' ? chart.ascendant : chart.placements.find(x => x.name === name)
  if (p.kind === 'classical-aspect') {
    if (p.profile !== 'iyer-II.13-directed-full-15deg/1.0' || p.first === p.second) throw new Error('invalid-classical-profile')
    const a = point(p.first), b = point(p.second)
    if (!a || !b || ['Rahu', 'Ketu', 'Ascendant'].includes(p.second)) return { satisfied: false, observed: 'Unsupported classical target' }
    const result = classicalFullAspect(p.first, a.sidereal.longitude, b.sidereal.longitude)
    return { satisfied: result.matchedTargets.length > 0, observed: `${p.first} → ${p.second}: ${result.directedDegrees.toFixed(4)}° directed separation under ${p.profile}` }
  }
  if (p.kind === 'conjunction' || p.kind === 'aspect') {
    if (p.convention !== 'geometric-degrees-not-graha-drishti' || p.first === p.second || !Number.isFinite(p.angle) || !Number.isFinite(p.orb) || p.angle < 0 || p.angle > 180 || p.orb < 0 || p.orb > 10 || (p.kind === 'conjunction' && p.angle !== 0)) throw new Error('invalid-aspect-convention')
    const a = point(p.first), b = point(p.second)
    if (!a || !b) return { satisfied: false, observed: 'Required chart point absent' }
    const diff = Math.abs(a.sidereal.longitude - b.sidereal.longitude)
    const separation = Math.min(diff, 360 - diff)
    return { satisfied: Math.abs(separation - p.angle) <= p.orb, observed: `${p.first}–${p.second}: ${separation.toFixed(6)}° separation; target ${p.angle}° ±${p.orb}°, geometric convention only` }
  }
  if (!('point' in p)) throw new Error('unsupported-predicate')
  const a = point(p.point)
  if (!a) return { satisfied: false, observed: `Missing ${p.point}` }
  const position = p.chart === 'D9' ? navamsaPosition(a.sidereal.longitude) : a.sidereal
  const house = p.chart === 'D9' ? (ZODIAC_SIGNS.indexOf(position.sign) - ZODIAC_SIGNS.indexOf(navamsaPosition(chart.ascendant.sidereal.longitude).sign) + 12) % 12 + 1 : a.wholeSignHouse
  if (p.kind === 'vargottama') return { satisfied: a.sidereal.sign === navamsaPosition(a.sidereal.longitude).sign, observed: `${p.point}: D1 ${a.sidereal.sign}; D9 ${navamsaPosition(a.sidereal.longitude).sign}; sign repetition only` }
  if (p.kind === 'dignity') return { satisfied: dignity(p.point, position.sign)[p.category], observed: `${p.chart} ${p.point} in ${position.sign}: ${p.category}; categorical profile, not a strength score` }
  if (p.kind === 'sign') return { satisfied: position.sign === p.sign, observed: `${p.chart} ${p.point}: ${position.sign} ${position.degreeInSign.toFixed(4)}°` }
  if (p.kind === 'house') {
    if (!Number.isInteger(p.house) || p.house < 1 || p.house > 12) throw new Error('invalid-house')
    return { satisfied: house === p.house, observed: `${p.chart} ${p.point}: whole-sign house ${house}` }
  }
  if (p.kind === 'nakshatra') return { satisfied: p.names.includes(a.nakshatra.name), observed: `${p.point}: ${a.nakshatra.name}` }
  if (p.kind === 'own-sign') {
    const ruler = SIGN_LORDS[ZODIAC_SIGNS.indexOf(position.sign)]
    return { satisfied: ruler === p.point, observed: `${p.chart} ${p.point} in ${position.sign}; declared sign ruler ${ruler ?? 'unknown'}. Own-sign classification only, not a strength score.` }
  }
  throw new Error('unsupported-predicate')
}

// Interval enclosure of the IMPLEMENTED mean-node/Lahiri polynomials, not an
// assertion about true nodes or ephemeris accuracy. No sampled derivative bound.
type Interval = [number, number]
const pad = ([a, b]: Interval): Interval => [a - 1e-8, b + 1e-8]
const add = (a: Interval, b: Interval): Interval => pad([a[0] + b[0], a[1] + b[1]])
const multiply = (a: Interval, b: Interval): Interval => {
  const v = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]]
  return pad([Math.min(...v), Math.max(...v)])
}
export function meanNodeSignEnclosure(start: Date, end: Date, ketu = false, harmonic: 1 | 9 = 1) {
  const epoch = Date.UTC(2000, 0, 1, 12), century = 36525 * 86400000
  const t: Interval = [(start.getTime() - epoch) / century, (end.getTime() - epoch) / century]
  if (!t.every(Number.isFinite) || t[0] > t[1] || t[0] < -4 || t[1] > 1) return null
  // Horner coefficients for meanNodeLongitude minus lahiriAyanamsa.
  let bound: Interval = [1 / 450000, 1 / 450000]
  for (const coefficient of [0.0020708 - 1.1054348 / 3600, -1934.136261 - 5028.796195 / 3600, 125.04452 - 23.85297 + (ketu ? 180 : 0)]) bound = add(multiply(bound, t), [coefficient, coefficient])
  bound = multiply(bound, [harmonic, harmonic])
  const lower = Math.floor(bound[0] / 30), upper = Math.floor(bound[1] / 30)
  return { bounds: bound, sign: lower === upper ? ZODIAC_SIGNS[((lower % 12) + 12) % 12] : null, proof: 'Horner interval enclosure of versioned mean-node minus Lahiri polynomial; padded arithmetic, restricted to 1600–2100; no observational/true-node accuracy claim.' }
}

export function assessFactor(p: Predicate, samples: NatalChart[], start: Date, end: Date): FactorResult {
  const alternatives = samples.map(chart => ({ instantUtc: chart.instantUtc, ...evaluatePredicate(chart, p) }))
  const nominal = alternatives[Math.floor(alternatives.length / 2)]
  if (start.getTime() === end.getTime()) return { predicate: p, ...nominal, state: 'point-in-time', alternatives, proof: 'Conditional on the declared instant, location and calculation conventions—not event authentication.' }
  if (p.kind === 'sign' && (p.point === 'Rahu' || p.point === 'Ketu')) {
    const enclosure = meanNodeSignEnclosure(start, end, p.point === 'Ketu', p.chart === 'D9' ? 9 : 1)
    if (enclosure?.sign) return { predicate: p, satisfied: enclosure.sign === p.sign, observed: `${p.point}: ${enclosure.sign} throughout the declared interval`, state: 'proven-stable', alternatives, proof: enclosure.proof }
  }
  // A convention identity holds continuously without estimating ascendant speed.
  if (p.kind === 'house' && p.point === 'Ascendant' && p.house === 1) return { predicate: p, ...nominal, state: 'proven-stable', alternatives, proof: 'Whole-sign first house is defined from the ascendant sign; this does not fix which sign it is.' }
  const values = new Set(alternatives.map(a => a.satisfied))
  return { predicate: p, ...nominal, state: values.size > 1 ? 'alternatives-observed' : 'interval-unproven', alternatives, proof: null }
}

export function corporateSamples(chart: NatalChart, start: Date, end: Date, latitudeDegrees: number, longitudeDegrees: number) {
  if (start.getTime() === end.getTime()) return [chart]
  // Bounded work even for date-only inputs. Samples are alternatives, never a proof.
  return Array.from({ length: 9 }, (_, i) => i === 4 ? chart : computeNatalChart({ instant: new Date(start.getTime() + (end.getTime() - start.getTime()) * i / 8), latitudeDegrees, longitudeDegrees }))
}
