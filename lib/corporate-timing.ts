import { computeNatalTiming } from './natal-timing.ts'
import { computeNatalChart, type NatalChart } from './natal-chart.ts'

export function corporateTiming(chart: NatalChart, start: Date, end: Date, latitudeDegrees: number, longitudeDegrees: number, referenceUtc?: string) {
  if (!referenceUtc) return { status: 'not-requested' as const, explanation: 'Choose a reference date to calculate periods and transit contacts; no hidden current-time default.', snapshots: [], alternatives: [], interactions: [] }
  const reference = new Date(referenceUtc)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(referenceUtc) || !Number.isFinite(reference.getTime()) || reference.toISOString().replace('.000Z', 'Z') !== referenceUtc.replace('.000Z', 'Z') || reference < end || reference.getTime() - start.getTime() > 99 * 365.2425 * 86400000) throw new Error('Timing reference must be a real UTC date, follow the entire formation interval and fall within 99 years.')
  const nominal = new Date(chart.instantUtc)
  const compute = (c: NatalChart, birthInstant: Date, referenceInstant: Date) => computeNatalTiming({ natalChart: c, birthInstant, referenceInstant, latitudeDegrees, longitudeDegrees })
  const snapshots = [0, 30, 90].map(days => ({ days, ...compute(chart, nominal, new Date(reference.getTime() + days * 86400000)) }))
  const alternatives = [...new Set([start.toISOString(), chart.instantUtc, end.toISOString()])].map(instantUtc => {
    const birthInstant = new Date(instantUtc)
    const c = instantUtc === chart.instantUtc ? chart : computeNatalChart({ instant: birthInstant, latitudeDegrees, longitudeDegrees })
    const t = compute(c, birthInstant, reference)
    return { instantUtc, major: t.vimshottari.activeMahadasha, sub: t.vimshottari.activeAntardasha, next: t.vimshottari.nextTransition }
  })
  const interactions = snapshots.flatMap(s => s.transits.contacts.filter(c => [s.vimshottari.activeMahadasha.lord, s.vimshottari.activeAntardasha.lord].includes(c.natalPoint as typeof s.vimshottari.activeMahadasha.lord)).map(c => ({ referenceUtc: s.referenceInstantUtc, majorLord: s.vimshottari.activeMahadasha.lord, subLord: s.vimshottari.activeAntardasha.lord, contact: c, explanation: 'Geometric contact to a point also named as a period lord. This is an overlap of calculated factors, not a prediction or validated corporate timing technique.' })))
  return { status: 'calculation-only' as const, version: 'corporate-timing/1.0', snapshots, alternatives, interactions,
    explanation: 'Exploratory transfer of natal Vimshottari to a formation event, not approved corporate doctrine. Actual nakshatra stay-time balance; 365.2425-day year. Sampled alternatives are not interval proof. +30/+90-day contacts are snapshots, not an exhaustive ingress, station or retrograde-event search.' }
}
