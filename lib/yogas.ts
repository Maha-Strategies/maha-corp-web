import { ASTROLOGY_RULES } from './astrology-traditions.ts'
import type { NatalChart } from './natal-chart.ts'
import { computeChartAspects, dignity, PARASHARI_SOURCE } from './natal-aspects.ts'
export interface YogaFormation { id: string; name: string; family: string; planets: string[]; criteria: string; detected: boolean; status: 'geometric-candidate'; qualifications: string[]; source: {title: string; url: string; locator: string}; registeredRuleIds: string[]; interpretationActivated: false }
export function detectClassicalYogas(chart: NatalChart): YogaFormation[] {
  const aspects = computeChartAspects(chart).filter(a => a.convention === 'parashari-whole-sign')
  const lord = (house: number) => chart.houses.find(h => h.number === house)!.ruler
  const point = (name: string) => chart.placements.find(p => p.name === name)!
  const relation = (a: string, b: string) => a !== b && (point(a).sidereal.sign === point(b).sidereal.sign || (aspects.some(v => v.sourcePlanet === a && v.targetPlanets.includes(b)) && aspects.some(v => v.sourcePlanet === b && v.targetPlanets.includes(a))))
  const result: YogaFormation[] = []
  function add(id: string, name: string, family: string, planets: string[], criteria: string, detected: boolean, locator: string, extra: string[] = []) {
    result.push({ id, name, family, planets, criteria, detected, status: 'geometric-candidate', qualifications: ['No event, wealth or capability is established.', 'Only the listed D1 conditions are tested; no Shadbala strength is estimated.', 'Textual formalization and practitioner review remain required before interpretation.', ...extra], source: { title: PARASHARI_SOURCE.title, url: PARASHARI_SOURCE.url, locator }, registeredRuleIds: ASTROLOGY_RULES.filter(rule => rule.chartTypes.includes('natal') && rule.id === id).map(rule => rule.id), interpretationActivated: false })
  }
  const seen = new Set<string>()
  for (const k of [1, 4, 7, 10]) for (const t of [1, 5, 9]) {
    const a = lord(k), b = lord(t), pair = [a, b].sort().join('-')
    if (a === b || seen.has(pair)) continue
    seen.add(pair)
    add(`raja-${pair}`, 'Rāja lord association', 'Rāja', [a, b], `Distinct lords of kendra ${k} and trikona ${t}: same sign or reciprocal non-nodal whole-sign aspects.`, relation(a, b), 'Chapter 41, verse 28; sign-level screening adaptation')
  }
  const wealth = [1, 2, 5, 9, 11], dhanSeen = new Set<string>()
  for (let i = 0; i < wealth.length; i++) for (const h of wealth.slice(i + 1)) {
    const a = lord(wealth[i]), b = lord(h), pair = [a, b].sort().join('-')
    if (a === b || dhanSeen.has(pair)) continue
    dhanSeen.add(pair)
    add(`dhana-${pair}`, 'Dhana association screen', 'Dhana', [a, b], `Distinct lords of houses ${wealth[i]} and ${h}: same sign or reciprocal aspects.`, relation(a, b), 'Chapter 41, combinations for wealth; exact generic pair rule not verified', ['The requested generic 1/2/5/9/11 association is a specification-defined screen, not a verified classical yoga rule.'])
  }
  const j = point('Jupiter'), m = point('Moon'), fromMoon = (j.wholeSignHouse - m.wholeSignHouse + 12) % 12 + 1
  add('gaja-kesari', 'Gaja-Kesari preliminary geometry', 'Gaja-Kesari', ['Jupiter', 'Moon'], 'Jupiter in 1/4/7/10 from Moon (7th includes Jupiter’s opposition to Moon).', [1, 4, 7, 10].includes(fromMoon), 'Chapter 36, verses 3–4', ['The inspected edition also specifies benefic association/aspect and exclusions for debilitation, combustion and inimical sign. This screen does not certify the complete yoga.'])
  for (const [planet, name] of [['Mars', 'Ruchaka'], ['Mercury', 'Bhadra'], ['Jupiter', 'Hamsa'], ['Venus', 'Malavya'], ['Saturn', 'Shasha']]) {
    const p = point(planet), d = dignity(p, chart)
    add(`mahapurusha-${planet}`, `${name} formation`, 'Pancha Mahapurusha', [planet], 'Own/exaltation sign in a D1 kendra (1/4/7/10).', [1, 4, 7, 10].includes(p.wholeSignHouse) && ['Exalted', 'Own sign'].includes(d.status), 'Five great-person formations; precise edition locator pending verification', ['No full condition set, cancellation, combustion qualification or source passage is activated.'])
  }
  for (const [h, name] of [[6, 'Harsha'], [8, 'Sarala'], [12, 'Vimala']] as const) {
    const p = point(lord(h))
    add(`viparita-${name}`, `${name} preliminary placement`, 'Viparīta', [p.name], `Lord of ${h} occupies 6/8/12.`, [6, 8, 12].includes(p.wholeSignHouse), 'Viparīta family attribution and exact name/exception passages pending verification', ['Associations, exclusivity and lineage-specific exceptions are not certified; this is placement screening only.'])
  }
  return result
}
