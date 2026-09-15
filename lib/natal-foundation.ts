import { computeNatalChart, ZODIAC_SIGNS, type NatalChart, type NatalChartInput } from './natal-chart.ts'
import { computeNatalTiming } from './natal-timing.ts'
import { calculationDigest } from './x402/celestial-products.ts'

export const NATAL_FOUNDATION_VERSION = 'lahiri-d1-d9/0.1' as const

/** Standard continuous ninth-harmonic mapping, not nine times the in-sign degree. */
export function navamsaPosition(longitude: number) {
  if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360) throw new Error('invalid_sidereal_longitude')
  const mapped = (longitude * 9) % 360
  return { longitude: mapped, sign: ZODIAC_SIGNS[Math.floor(mapped / 30)], degreeInSign: mapped % 30 }
}

export function computeNavamsa(chart: NatalChart) {
  const ascendant = navamsaPosition(chart.ascendant.sidereal.longitude)
  const ascendantIndex = Math.floor(ascendant.longitude / 30)
  return {
    chart: 'D9' as const,
    convention: 'sidereal-longitude-times-nine-modulo-360; whole-sign houses from D9 ascendant',
    ascendant,
    placements: chart.placements.map(point => {
      const position = navamsaPosition(point.sidereal.longitude)
      return { name: point.name, ...position,
        house: (Math.floor(position.longitude / 30) - ascendantIndex + 12) % 12 + 1 }
    }),
    boundary: 'A divisional-chart coordinate under a declared convention, not an independently observed sky position or a marriage prediction.',
  }
}

export function buildNatalFoundation(input: NatalChartInput, uncertaintyMinutes: number, referenceInstant: Date) {
  if (!Number.isFinite(uncertaintyMinutes) || uncertaintyMinutes < 0 || uncertaintyMinutes > 120) throw new Error('invalid_uncertainty')
  if (!Number.isFinite(referenceInstant.getTime()) || referenceInstant.getTime() < input.instant.getTime() + uncertaintyMinutes * 60000) {
    throw new Error('reference_must_follow_birth_interval')
  }
  const d1 = computeNatalChart(input)
  const d9 = computeNavamsa(d1)
  // At most 49 samples, with <=5 minute spacing and both endpoints plus nominal.
  // This is explicitly NOT an interval proof, including when all samples agree.
  const steps = uncertaintyMinutes === 0 ? 0 : Math.max(2, Math.ceil(uncertaintyMinutes / 2.5 / 2) * 2)
  const offsets = steps === 0 ? [0] : Array.from({ length: steps + 1 }, (_, i) => -uncertaintyMinutes + 2 * uncertaintyMinutes * i / steps)
  const samples = offsets.map(offsetMinutes => {
    const chart = offsetMinutes === 0 ? d1 : computeNatalChart({ ...input, instant: new Date(input.instant.getTime() + offsetMinutes * 60000) })
    const divisional = computeNavamsa(chart)
    return { offsetMinutes, d1Ascendant: chart.ascendant.sidereal.sign,
      d9Ascendant: divisional.ascendant.sign,
      factors: chart.placements.map(point => ({ name: point.name, d1Sign: point.sidereal.sign,
        d1House: point.wholeSignHouse, nakshatra: point.nakshatra.name,
        d9Sign: divisional.placements.find(p => p.name === point.name)!.sign,
        d9House: divisional.placements.find(p => p.name === point.name)!.house })) }
  })
  const alternatives = [...new Map(samples.map(sample => [JSON.stringify([sample.d1Ascendant, sample.d9Ascendant, sample.factors]), sample])).values()]
  const timing = computeNatalTiming({ natalChart: d1, birthInstant: input.instant, referenceInstant,
    latitudeDegrees: input.latitudeDegrees, longitudeDegrees: input.longitudeDegrees })
  const periodAlternatives = [...new Set([offsets[0], 0, offsets.at(-1)!])].map(offset => {
    const birthInstant = new Date(input.instant.getTime() + offset * 60000)
    const chart = offset === 0 ? d1 : computeNatalChart({ ...input, instant: birthInstant })
    const computed = offset === 0 ? timing : computeNatalTiming({ natalChart: chart, birthInstant, referenceInstant,
      latitudeDegrees: input.latitudeDegrees, longitudeDegrees: input.longitudeDegrees })
    return { offsetMinutes: offset, mahadasha: computed.vimshottari.activeMahadasha,
      antardasha: computed.vimshottari.activeAntardasha, nextTransition: computed.vimshottari.nextTransition }
  })
  const payload = {
    version: NATAL_FOUNDATION_VERSION, d1, d9, timing,
    conventions: { zodiac: 'Lahiri sidereal', d1Houses: 'whole-sign', d9Houses: 'whole-sign from D9 ascendant',
      nodes: d1.nodeModel, dasha: 'Vimshottari; actual nakshatra stay-time birth balance; 365.2425-day year',
      aspects: 'Timing contacts are geometric; not automatically classical graha-drishti or D9 aspects.' },
    sensitivity: { uncertaintyMinutes, samples, alternatives, periodAlternatives,
      observedChange: alternatives.length > 1, intervalStabilityProven: false as const,
      status: uncertaintyMinutes === 0 ? 'declared-exact' : alternatives.length > 1 ? 'alternatives-observed' : 'sampled-agreement-only',
      explanation: 'Alternatives describe sampled instants, not exhaustive time windows. Nonzero uncertainty withholds unconditional interpretation even when samples agree. Period dates are nominal and convention-dependent.' },
    upcoming: [30, 90].map(days => {
      const instant = new Date(referenceInstant.getTime() + days * 86400000)
      const chart = computeNatalChart({ ...input, instant })
      return { daysAfterReference: days, instantUtc: instant.toISOString(),
        placements: chart.placements.filter(p => ['Jupiter', 'Saturn', 'Rahu'].includes(p.name)).map(p => ({ name: p.name, sign: p.sidereal.sign,
          degreeInSign: p.sidereal.degreeInSign, nominalD1House: (Math.floor(p.sidereal.longitude / 30) - Math.floor(d1.ascendant.sidereal.longitude / 30) + 12) % 12 + 1 })),
        interpretation: 'Geometry snapshot only; not an ingress date or event forecast.' }
    }),
  }
  return { ...payload, receiptDigest: calculationDigest(payload) }
}

export type NatalFoundation = ReturnType<typeof buildNatalFoundation>
