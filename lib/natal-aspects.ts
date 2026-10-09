import { ZODIAC_SIGNS, type NatalChart, type NatalChartPoint, type ZodiacSign } from './natal-chart.ts'
export const PARASHARI_SOURCE = { title: 'Bṛhat Parāśara Horā Śāstra', url: 'https://vedic-astro.s3.amazonaws.com/books/bhrihat_parasara_hora_shastra.pdf', locator: 'Chapter 26, verses 3–5; Chapter 3, verses 49–58', status: 'calculation-convention; edition not cleared in passage registry' }
export interface PlanetaryAspect {
  sourcePlanet: string; sourceHouse: number; aspectDegree: number; targetHouse: number; targetSign: ZodiacSign; targetPlanets: string[]
  convention: 'parashari-whole-sign' | 'disputed-nodal-trinal'; qualification: string
}
export function houseForSign(sign: ZodiacSign, ascendant: ZodiacSign) { return (ZODIAC_SIGNS.indexOf(sign) - ZODIAC_SIGNS.indexOf(ascendant) + 12) % 12 + 1 }
export function aspectOffsets(name: string, nodes = true): number[] {
  if (['Rahu', 'Ketu'].includes(name)) return nodes ? [5, 7, 9] : []
  return name === 'Mars' ? [4, 7, 8] : name === 'Jupiter' ? [5, 7, 9] : name === 'Saturn' ? [3, 7, 10] : name === 'Ascendant' ? [] : [7]
}
export function computeAspectOverlay(source: NatalChart, target: NatalChart, nodes = true): PlanetaryAspect[] {
  return source.placements.flatMap(point => aspectOffsets(point.name, nodes).map(offset => {
    const sign = ZODIAC_SIGNS[(ZODIAC_SIGNS.indexOf(point.sidereal.sign) + offset - 1) % 12]
    return { sourcePlanet: point.name, sourceHouse: houseForSign(point.sidereal.sign, target.ascendant.sidereal.sign), aspectDegree: offset,
      targetHouse: houseForSign(sign, target.ascendant.sidereal.sign), targetSign: sign, targetPlanets: target.placements.filter(p => p.sidereal.sign === sign).map(p => p.name),
      convention: ['Rahu', 'Ketu'].includes(point.name) ? 'disputed-nodal-trinal' as const : 'parashari-whole-sign' as const,
      qualification: ['Rahu', 'Ketu'].includes(point.name) ? 'Requested nodal 5/7/9 convention; schools disagree; not a reviewed doctrine.' : 'Inclusive sign count, not a degree orb or an empirical influence.' }
  }))
}
export function computeChartAspects(natalChart: NatalChart): PlanetaryAspect[] { return computeAspectOverlay(natalChart, natalChart) }
export function houseLordships(chart: NatalChart) { return chart.houses.map(h => ({ house: h.number, sign: h.sign, lord: h.ruler, lordPlacementHouse: h.rulerHouse, lordSign: h.rulerSign })) }
const own: Record<string, ZodiacSign[]> = { Sun: ['Leo'], Moon: ['Cancer'], Mars: ['Aries', 'Scorpio'], Mercury: ['Gemini', 'Virgo'], Jupiter: ['Sagittarius', 'Pisces'], Venus: ['Taurus', 'Libra'], Saturn: ['Capricorn', 'Aquarius'] }
const exalted: Record<string, ZodiacSign> = { Sun: 'Aries', Moon: 'Taurus', Mars: 'Capricorn', Mercury: 'Virgo', Jupiter: 'Cancer', Venus: 'Pisces', Saturn: 'Libra' }
const friends: Record<string, string[]> = { Sun: ['Moon', 'Mars', 'Jupiter'], Moon: ['Sun', 'Mercury'], Mars: ['Sun', 'Moon', 'Jupiter'], Mercury: ['Sun', 'Venus'], Jupiter: ['Sun', 'Moon', 'Mars'], Venus: ['Mercury', 'Saturn'], Saturn: ['Mercury', 'Venus'] }
const enemies: Record<string, string[]> = { Sun: ['Venus', 'Saturn'], Moon: [], Mars: ['Mercury'], Mercury: ['Moon'], Jupiter: ['Mercury', 'Venus'], Venus: ['Sun', 'Moon'], Saturn: ['Sun', 'Moon', 'Mars'] }
export function dignity(point: NatalChartPoint, chart: NatalChart) {
  const ruler = chart.houses.find(h => h.sign === point.sidereal.sign)?.ruler
  const exalt = exalted[point.name]
  const fall = exalt && ZODIAC_SIGNS[(ZODIAC_SIGNS.indexOf(exalt) + 6) % 12]
  const status = !exalt ? 'Unassigned (nodes)' : point.sidereal.sign === exalt ? 'Exalted' : point.sidereal.sign === fall ? 'Debilitated' : own[point.name].includes(point.sidereal.sign) ? 'Own sign' : friends[point.name].includes(ruler ?? '') ? 'Friendly sign' : enemies[point.name].includes(ruler ?? '') ? 'Enemy sign' : 'Neutral sign'
  const rulerPoint = chart.placements.find(p => p.name === ruler)
  const relative = rulerPoint ? (rulerPoint.wholeSignHouse - point.wholeSignHouse + 12) % 12 + 1 : null
  return { status, motion: point.motion, signLord: ruler, naturalRelationship: ruler === point.name ? 'self' : friends[point.name]?.includes(ruler ?? '') ? 'friend' : enemies[point.name]?.includes(ruler ?? '') ? 'enemy' : 'neutral', temporaryRelationship: relative === null || !exalt ? 'unassigned' : [2, 3, 4, 10, 11, 12].includes(relative) ? 'friend' : 'enemy', qualification: 'Sign-level declared traditional dignity; not a quantitative strength or performance assessment.' }
}
