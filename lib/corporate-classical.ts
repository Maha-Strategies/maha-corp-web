import { computeNavamsa } from './natal-foundation.ts'
import { ZODIAC_SIGNS, type NatalChart, type ChartPointName, type ZodiacSign } from './natal-chart.ts'

export const CLASSICAL_PROFILE_VERSION = 'iyer-categorical-corporate/1.0'
const BASE = 'https://chestofbooks.com/new-age/astrology/Brihat-Jataka/'
// Primary-text translation, inspected at these locators on 2026-09-19.
// Paraphrases only. Transcription inspection is not practitioner approval.
export const CORPORATE_CLASSICAL_SOURCES = [
  { id: 'bj-i6-navamsa', locator: 'Bṛhat Jātaka I.6, translation and notes', url: BASE + 'Chapter-I-Definitions-And-Elementary-Zodiacal-Principles.html', summary: 'Nine divisions per sign; the named division sequence defines Navāṃśa coordinates.', boundary: 'Coordinate convention only; no corporate or marriage outcome follows.' },
  { id: 'bj-i13-dignity', locator: 'Bṛhat Jātaka I.13', url: BASE + 'Definitions-And-Elementary-Zodiacal-Principles-Part-3.html', summary: 'Exaltation signs and opposite debilitation signs for seven classical planets.', boundary: 'The transcription disagrees on Mars’s exact peak degree between verse and table; no peak-degree calculation is admitted.' },
  { id: 'bj-i14-vargottama', locator: 'Bṛhat Jātaka I.14 and notes', url: BASE + 'Definitions-And-Elementary-Zodiacal-Principles-Part-3.html', summary: 'Vargottama divisions repeat the containing sign; the verse also names mūlatrikoṇa signs.', boundary: 'Mūlatrikoṇa is sign-level here; no degree subdivision, strength score or favorable corporate outcome is inferred.' },
  { id: 'bj-ii13-directed', locator: 'Bṛhat Jātaka II.13, followed by Iyer’s notes', url: BASE + 'Definitions-And-Elementary-Planetary-Principles-Continued.html', summary: 'Full aspects use directed separations and special targets for Mars, Jupiter and Saturn; the notes extend targets by fifteen degrees.', boundary: 'Iyer-directed-full-aspects only, not a universal aspect school, fractional strength, D9 doctrine or nodal aspect rule.' },
  { id: 'bj-ii19-own-navamsa', locator: 'Bṛhat Jātaka II.19 and notes referencing I.6', url: BASE + 'Definitions-And-Elementary-Planetary-Principles-Continued.html', summary: 'Own Navāṃśa is among the text’s positional-strength categories.', boundary: 'A named traditional category is not measured organizational capability or shadbala.' },
] as const
export const CLASSICAL_POINTS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const
type ClassicalPoint = typeof CLASSICAL_POINTS[number]
const EXALT: Record<ClassicalPoint, ZodiacSign> = { Sun: 'Aries', Moon: 'Taurus', Mars: 'Capricorn', Mercury: 'Virgo', Jupiter: 'Cancer', Venus: 'Pisces', Saturn: 'Libra' }
const MOOLA: Record<ClassicalPoint, ZodiacSign> = { Sun: 'Leo', Moon: 'Taurus', Mars: 'Aries', Mercury: 'Virgo', Jupiter: 'Sagittarius', Venus: 'Libra', Saturn: 'Aquarius' }
export const SIGN_LORDS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'] as const
export function dignity(point: ChartPointName, sign: ZodiacSign) {
  if (!(CLASSICAL_POINTS as readonly string[]).includes(point)) return { supported: false, ownSign: false, exalted: false, debilitated: false, moolatrikonaSign: false }
  const p = point as ClassicalPoint
  return { supported: true, ownSign: SIGN_LORDS[ZODIAC_SIGNS.indexOf(sign)] === p, exalted: EXALT[p] === sign, debilitated: ZODIAC_SIGNS[(ZODIAC_SIGNS.indexOf(EXALT[p]) + 6) % 12] === sign, moolatrikonaSign: MOOLA[p] === sign }
}
export function classicalFullAspect(first: ChartPointName, from: number, to: number) {
  if (![from, to].every(v => Number.isFinite(v) && v >= 0 && v < 360)) throw new Error('invalid-longitude')
  const supported = (CLASSICAL_POINTS as readonly string[]).includes(first)
  const targets = !supported ? [] : first === 'Mars' ? [90, 180, 210] : first === 'Jupiter' ? [120, 180, 240] : first === 'Saturn' ? [60, 180, 270] : [180]
  const directedDegrees = (to - from + 360) % 360
  return { profile: 'iyer-II.13-directed-full-15deg/1.0', supported, directedDegrees, targets, matchedTargets: targets.filter(t => Math.abs(directedDegrees - t) <= 15), boundary: 'Full-target membership only; no fractional strength or nodal aspects.' }
}
export function classicalCalculation(chart: NatalChart) {
  const d9 = computeNavamsa(chart)
  return { version: CLASSICAL_PROFILE_VERSION, d9,
    dignity: chart.placements.map(p => ({ point: p.name, d1: dignity(p.name, p.sidereal.sign), d9: dignity(p.name, d9.placements.find(d => d.name === p.name)!.sign), vargottama: p.sidereal.sign === d9.placements.find(d => d.name === p.name)!.sign })),
    aspects: chart.placements.flatMap(a => chart.placements.filter(b => b.name !== a.name && (CLASSICAL_POINTS as readonly string[]).includes(b.name)).map(b => ({ from: a.name, to: b.name, ...classicalFullAspect(a.name, a.sidereal.longitude, b.sidereal.longitude) })).filter(a => a.supported && a.matchedTargets.length)),
    sources: CORPORATE_CLASSICAL_SOURCES, reviewStatus: 'source-inspected-calculation-profile; practitioner-review-pending',
    boundary: 'Representative-instant categories only. D9 coordinates are not a second physical sky. No corporate prediction or approved synthesis is implied.' }
}
