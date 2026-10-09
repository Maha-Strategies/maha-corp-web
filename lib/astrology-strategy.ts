import { SiderealTime } from 'astronomy-engine'
import { computeNatalChart, ZODIAC_SIGNS, meanNodeLongitude, type NatalChart } from './natal-chart.ts'
import { classicalEclipticLongitude } from './ephemeris.ts'
import { lahiriAyanamsa } from './panchanga.ts'
import type { BirthReport } from './birth-report.ts'
import { VIMSHOTTARI_LORDS, VIMSHOTTARI_YEARS } from './natal-timing.ts'
import { computeAspectOverlay, dignity, houseForSign, houseLordships } from './natal-aspects.ts'
import { detectClassicalYogas } from './yogas.ts'
export function transitOverlay(natal: NatalChart, instantUtc: string) {
  const instant = new Date(instantUtc)
  if (!Number.isFinite(instant.getTime()) || instant.getUTCFullYear() < 1800 || instant.getUTCFullYear() > 2100) throw new Error('unsupported_transit_date')
  const transiting = computeNatalChart({ instant, latitudeDegrees: 0, longitudeDegrees: 0 })
  return { instantUtc: instant.toISOString(), placements: transiting.placements.map(p => ({ ...p, natalHouse: houseForSign(p.sidereal.sign, natal.ascendant.sidereal.sign), dignity: dignity(p, transiting) })), aspects: computeAspectOverlay(transiting, natal), boundary: 'Transit signs and natal-house mapping are calculations. Whole-sign dṛṣṭi and dignity are declared traditional conventions, not measured effects or probabilities.' }
}
export function corporateSynastry(founder: NatalChart, secondary: NatalChart, kind: 'corporate' | 'partner') {
  const matrix = (source: NatalChart, target: NatalChart) => source.placements.map(p => ({ planet: p.name, sourceSign: p.sidereal.sign, sourceHouse: p.wholeSignHouse, targetHouse: houseForSign(p.sidereal.sign, target.ascendant.sidereal.sign) }))
  const fMoon = founder.placements.find(p => p.name === 'Moon')!, eMoon = secondary.placements.find(p => p.name === 'Moon')!
  const lagnaForward = houseForSign(secondary.ascendant.sidereal.sign, founder.ascendant.sidereal.sign), lagnaReverse = houseForSign(founder.ascendant.sidereal.sign, secondary.ascendant.sidereal.sign)
  return { kind, secondaryInFounder: matrix(secondary, founder), founderInSecondary: matrix(founder, secondary), secondaryAspectsFounder: computeAspectOverlay(secondary, founder), founderAspectsSecondary: computeAspectOverlay(founder, secondary),
    houseAlignment: secondary.houses.map(h => ({ secondaryHouse: h.number, secondarySign: h.sign, founderHouse: houseForSign(h.sign, founder.ascendant.sidereal.sign) })),
    lagna: { forward: lagnaForward, reverse: lagnaReverse, configuration: lagnaForward === 7 ? '1–7 axis' : [5, 9].includes(lagnaForward) ? '5–9 trine' : [6, 8].includes(lagnaForward) ? '6–8 configuration (traditionally called shadashtaka)' : `${lagnaForward}–${lagnaReverse} sign relationship` },
    moons: { founderNakshatra: fMoon.nakshatra.name, secondaryNakshatra: eMoon.nakshatra.name, forwardCount: (eMoon.nakshatra.index - fMoon.nakshatra.index + 27) % 27 + 1, reverseCount: (fMoon.nakshatra.index - eMoon.nakshatra.index + 27) % 27 + 1, harmonyScore: null, qualification: kind === 'corporate' ? 'No validated corporate nakshatra compatibility metric or natal-to-entity doctrine is activated.' : 'Nakshatra distances only; no reviewed compatibility score is activated.' },
    boundary: 'Structural overlays only. No revenue, suitability, employee selection, lending or partnership outcome is established. Incorporation time is a declared event anchor, not a biological birth.' }
}
export function strategicGeometry(report: BirthReport) { return { lordships: houseLordships(report.natalChart), aspects: computeAspectOverlay(report.natalChart, report.natalChart), yogaFormations: detectClassicalYogas(report.natalChart), dignities: report.natalChart.placements.map(p => ({ planet: p.name, ...dignity(p, report.natalChart) })) } }
export function baselineProofs(report: BirthReport) {
  const d = (Date.parse(report.instantUtc) - Date.UTC(2000, 0, 1, 12)) / 86400000, t = d / 36525
  const norm = (x: number) => (x % 360 + 360) % 360
  return { gmstDegrees: norm(280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - t * t * t / 38710000), apparentSiderealDegrees: SiderealTime(new Date(report.instantUtc)) * 15, ramcDegrees: norm(SiderealTime(new Date(report.instantUtc)) * 15 + report.longitudeDegrees), ayanamsaDegrees: report.natalChart.ayanamsa.degrees, note: 'GMST uses the conventional Meeus mean-sidereal polynomial. RAMC uses local apparent sidereal time, as does the existing ascendant engine. These are different quantities.', panchanga: report.panchanga }
}
export function fiveYearPeriods(report: BirthReport, startUtc = report.timing.referenceInstantUtc) {
  const start = Date.parse(startUtc), endDate = new Date(start); endDate.setUTCFullYear(endDate.getUTCFullYear() + 5); const end = endDate.getTime()
  const rows: { maha: string; bhukti: string; pratyantar: string; startUtc: string; endUtc: string }[] = []
  for (const maha of report.timing.vimshottari.mahadashas) {
    const ms = Date.parse(maha.startUtc), me = Date.parse(maha.endUtc)
    if (me <= start || ms >= end) continue
    let subStart = ms
    const order = VIMSHOTTARI_LORDS.indexOf(maha.lord)
    for (let a = 0; a < 9; a++) {
      const bhukti = VIMSHOTTARI_LORDS[(order + a) % 9], subEnd = a === 8 ? me : subStart + (me - ms) * VIMSHOTTARI_YEARS[bhukti] / 120
      let pStart = subStart
      const pOrder = VIMSHOTTARI_LORDS.indexOf(bhukti)
      for (let b = 0; b < 9; b++) {
        const pratyantar = VIMSHOTTARI_LORDS[(pOrder + b) % 9], pEnd = b === 8 ? subEnd : pStart + (subEnd - subStart) * VIMSHOTTARI_YEARS[pratyantar] / 120
        if (pEnd > start && pStart < end) rows.push({ maha: maha.lord, bhukti, pratyantar, startUtc: new Date(Math.max(start, pStart)).toISOString(), endUtc: new Date(Math.min(end, pEnd)).toISOString() })
        pStart = pEnd
      }
      subStart = subEnd
    }
  }
  return { startUtc, endUtc: endDate.toISOString(), rows, completeHorizon: rows.length > 0 && Date.parse(rows.at(-1)!.endUtc) >= end - 1, boundary: 'Nominal proportional period subdivisions; clipped to the five-year horizon and supported first 120-year cycle. Not dates of events.' }
}
export function slowPlanetIngresses(startUtc: string, endUtc: string) {
  const start = Date.parse(startUtc), end = Date.parse(endUtc), day = 86400000
  if (!Number.isFinite(start + end) || end <= start || end - start > 1830 * day) throw new Error('invalid_ingress_horizon')
  const rows: { planet: string; from: string; to: string; instantUtc: string }[] = []
  for (const planet of ['Jupiter', 'Saturn', 'Rahu', 'Ketu'] as const) {
    const signAt = (ms: number) => {
      const date = new Date(ms), trop = planet === 'Rahu' || planet === 'Ketu' ? meanNodeLongitude(date) + (planet === 'Ketu' ? 180 : 0) : classicalEclipticLongitude(planet, date)
      return Math.floor(((trop - lahiriAyanamsa(date)) % 360 + 360) % 360 / 30)
    }
    let previous = signAt(start), previousMs = start
    for (let ms = Math.min(start + day, end); previousMs < end; ms = Math.min(ms + day, end)) {
      const current = signAt(ms)
      if (current !== previous) {
        let lo = previousMs, hi = ms
        while (hi - lo > 60000) { const mid = (lo + hi) / 2; if (signAt(mid) === previous) lo = mid; else hi = mid }
        rows.push({ planet, from: ZODIAC_SIGNS[previous], to: ZODIAC_SIGNS[current], instantUtc: new Date(Math.round(hi)).toISOString() })
      }
      previous = current; previousMs = ms
    }
  }
  return rows.sort((a, b) => a.instantUtc.localeCompare(b.instantUtc))
}
