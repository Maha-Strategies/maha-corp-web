import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { BirthReport } from '../birth-report.ts'
import { baselineProofs, corporateSynastry, fiveYearPeriods, slowPlanetIngresses, strategicGeometry } from '../astrology-strategy.ts'
import { PARASHARI_SOURCE } from '../natal-aspects.ts'
const execute = promisify(execFile)
function wheelSvg(points: { name: string; longitude: number }[], ascendantSignIndex: number, label: string) {
  const xy = (degree: number, radius: number) => ({ x: (180 + Math.cos((degree - 90) * Math.PI / 180) * radius).toFixed(2), y: (180 + Math.sin((degree - 90) * Math.PI / 180) * radius).toFixed(2) })
  const signs = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
  const sectors = signs.map((sign, i) => { const a = xy(i * 30, 170), b = xy(i * 30, 70), l = xy(i * 30 + 15, 151); return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#ccc2b4"/><text x="${l.x}" y="${l.y}" text-anchor="middle" font-size="8">${sign.slice(0,3)} H${(i-ascendantSignIndex+12)%12+1}</text>` }).join('')
  const occupied: {x: number; y: number}[] = []
  const bodies = points.map((p, i) => {
    let radius = 87 + (i % 3) * 19, degree = p.longitude, l = xy(degree, radius)
    for (let attempt = 0; attempt < 30 && occupied.some(q => Math.hypot(q.x - Number(l.x), q.y - Number(l.y)) < 24); attempt++) { radius += 19; if (radius > 128) { radius = 87; degree += 8 }; l = xy(degree, radius) }
    occupied.push({x: Number(l.x), y: Number(l.y)})
    const exact = xy(p.longitude, 133)
    return `<line x1="${exact.x}" y1="${exact.y}" x2="${l.x}" y2="${l.y}" stroke="#b8a386" stroke-width="0.5"/><circle cx="${exact.x}" cy="${exact.y}" r="1.5" fill="#947957"/><circle cx="${l.x}" cy="${l.y}" r="11" fill="#faf6ee" stroke="#947957"/><text x="${l.x}" y="${Number(l.y)+3}" text-anchor="middle" font-size="8">${p.name==='Ascendant'?'As':p.name.slice(0,2)}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360"><g fill="#443827" font-family="Arial"><circle cx="180" cy="180" r="170" fill="none" stroke="#947957"/><circle cx="180" cy="180" r="137" fill="none" stroke="#ccc2b4"/><circle cx="180" cy="180" r="70" fill="none" stroke="#ccc2b4"/>${sectors}${bodies}<text x="180" y="182" text-anchor="middle" font-size="28">${label}</text><text x="180" y="202" text-anchor="middle" font-size="8">Lahiri / whole sign</text></g></svg>`
}
export function executiveDossierData(report: BirthReport, secondary?: { report: BirthReport; kind: 'corporate' | 'partner'; label: string }) {
  const periods = fiveYearPeriods(report), strategic = strategicGeometry(report)
  return { version: 'executive-jyotisha-dossier/1', title: 'Strategic Epistemic Jyotisha', instantUtc: report.instantUtc, reference: report.timing.referenceInstantUtc, latitude: report.latitudeDegrees, longitude: report.longitudeDegrees, uncertainty: report.foundation.sensitivity.uncertaintyMinutes, receipt: report.foundation.receiptDigest,
    d1Wheel: wheelSvg([report.natalChart.ascendant, ...report.natalChart.placements].map(p => ({ name: p.name, longitude: p.sidereal.longitude })), Math.floor(report.natalChart.ascendant.sidereal.longitude / 30), 'D1'),
    d9Wheel: wheelSvg([{ name: 'Ascendant', ...report.foundation.d9.ascendant }, ...report.foundation.d9.placements], Math.floor(report.foundation.d9.ascendant.longitude / 30), 'D9'),
    baseline: baselineProofs(report), d1: [report.natalChart.ascendant, ...report.natalChart.placements].map(p => ({ name: p.name, sign: p.sidereal.sign, degree: p.sidereal.degreeInSign.toFixed(4), house: p.wholeSignHouse, nakshatra: p.nakshatra.name, motion: p.motion })), d9: [{ name: 'Ascendant', ...report.foundation.d9.ascendant, house: 1 }, ...report.foundation.d9.placements], lordships: strategic.lordships, aspects: strategic.aspects, yogas: strategic.yogaFormations, periods, ingresses: slowPlanetIngresses(periods.startUtc, periods.endUtc), synastry: secondary ? { label: secondary.label, ...corporateSynastry(report.natalChart, secondary.report.natalChart, secondary.kind) } : null,
    sources: [PARASHARI_SOURCE, ...report.timing.vimshottari.sourceReferences, ...report.reading.educational.planetary.flatMap(p => p.sources).filter((p, i, a) => a.findIndex(q => q.id === p.id) === i)],
    directives: [
      { title: 'Operational experiments', text: 'Use a selected symbolic window as a review date. Define a reversible experiment, its owner, an observable success criterion and a stop rule. The timing convention supplies no success probability.' },
      { title: 'Pricing and positioning', text: 'Test a pricing hypothesis against customer interviews, willingness to pay, delivery cost and conversion evidence. Chart geometry cannot establish pricing leverage or demand.' },
      { title: 'Capital and risk', text: 'Evaluate liquidity, downside scenarios, obligations and professional financial advice independently of the chart. Never trade, invest or allocate capital on astrological grounds.' },
      { title: 'Founder and entity alignment', text: 'Use structural overlays to formulate discussion questions about roles, responsibilities and operating constraints. They establish no compatibility score, capability or revenue expectation.' },
    ], boundary: 'Calculated geometry, declared timing conventions, unreviewed formation screens and optional strategic planning are separate layers. No financial, medical, legal, personality or deterministic outcome claim is made. Nonzero time uncertainty does not permit unconditional personal interpretation.' }
}
export async function generateExecutiveDossier(report: BirthReport, secondary?: { report: BirthReport; kind: 'corporate' | 'partner'; label: string }) {
  const directory = await mkdtemp(join(tmpdir(), 'maha-jyotisha-'))
  try {
    const template = await readFile(join(process.cwd(), 'lib/dossier/executive-astrology-dossier.typ'), 'utf8')
    await writeFile(join(directory, 'report.typ'), template, { mode: 0o600 })
    await writeFile(join(directory, 'data.json'), JSON.stringify(executiveDossierData(report, secondary)), { mode: 0o600 })
    await execute(process.env.TYPST_BINARY || 'typst', ['compile', '--root', directory, '--input', 'data=data.json', join(directory, 'report.typ'), join(directory, 'dossier.pdf')], { timeout: 45000, maxBuffer: 65536 })
    return await readFile(join(directory, 'dossier.pdf'))
  } finally { await rm(directory, { recursive: true, force: true }) }
}
