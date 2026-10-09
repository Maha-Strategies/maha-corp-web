import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBirthReport } from '../lib/birth-report.ts'
import { ZODIAC_SIGNS, type NatalChart } from '../lib/natal-chart.ts'
import { aspectOffsets, computeChartAspects, houseForSign } from '../lib/natal-aspects.ts'
import { detectClassicalYogas } from '../lib/yogas.ts'
import { corporateSynastry, fiveYearPeriods, slowPlanetIngresses, transitOverlay } from '../lib/astrology-strategy.ts'
const report=buildBirthReport({date:'2000-01-01',time:'12:00',timeZone:'Asia/Colombo',latitudeDegrees:6.9271,longitudeDegrees:79.8612,birthTimeUncertaintyMinutes:0,timingInstantUtc:'2026-10-01T12:00:00.000Z'})
// Construct a geometry fixture, not a claimed astronomical birth chart.
function cancer(): NatalChart {
 const c=structuredClone(report.natalChart); c.ascendant.sidereal.sign='Cancer'
 c.placements.find(p=>p.name==='Jupiter')!.sidereal.sign='Leo'; c.placements.find(p=>p.name==='Moon')!.sidereal.sign='Aquarius'
 for(const p of c.placements) p.wholeSignHouse=houseForSign(p.sidereal.sign,'Cancer')
 return c
}
test('Cancer lagna, Jupiter in Leo maps its inclusive 5/7/9 to 6/8/10 and Moon in Aquarius',()=>{
 const rays=computeChartAspects(cancer()).filter(a=>a.sourcePlanet==='Jupiter')
 assert.deepEqual(rays.map(a=>[a.sourceHouse,a.aspectDegree,a.targetHouse,a.targetSign]),[[2,5,6,'Sagittarius'],[2,7,8,'Aquarius'],[2,9,10,'Aries']]); assert.ok(rays[1].targetPlanets.includes('Moon'))
 assert.deepEqual(aspectOffsets('Mars'),[4,7,8]);assert.deepEqual(aspectOffsets('Saturn'),[3,7,10]);assert.deepEqual(aspectOffsets('Rahu',false),[])
 for(const sign of ZODIAC_SIGNS) assert.equal(houseForSign(sign,sign),1)
 assert.equal(houseForSign('Aries','Pisces'),2)
})
test('all formation screens disclose qualifications and never authorize an interpretation',()=>{
 const ys=detectClassicalYogas(report.natalChart); assert.ok(ys.some(y=>y.family==='Viparīta')); assert.equal(ys.filter(y=>y.family==='Pancha Mahapurusha').length,5)
 assert.equal(new Set(ys.map(y=>y.id)).size,ys.length)
 for(const y of ys){assert.equal(y.interpretationActivated,false);assert.equal(y.status,'geometric-candidate');assert.ok(y.qualifications.length>=3);assert.ok(y.source.locator)}
 assert.ok(ys.filter(y=>['Dhana','Rāja'].includes(y.family)).every(y=>new Set(y.planets).size===2))
})
test('dual overlays reverse house counts and expose no validated harmony score',()=>{
 const a=report.natalChart,b=cancer(),ab=corporateSynastry(a,b,'corporate'),ba=corporateSynastry(b,a,'partner')
 assert.equal(ab.lagna.forward,ba.lagna.reverse);assert.equal(ab.lagna.reverse,ba.lagna.forward)
 assert.deepEqual(ab.secondaryInFounder,ba.founderInSecondary);assert.equal(ab.moons.harmonyScore,null)
 assert.ok(ab.moons.forwardCount>=1&&ab.moons.forwardCount<=27);assert.match(ab.moons.qualification,/No validated/)
})
test('five-year period subdivisions are contiguous, clipped and never extend beyond the supported cycle',()=>{
 const schedule=fiveYearPeriods(report);assert.equal(schedule.completeHorizon,true);assert.equal(schedule.rows[0].startUtc,schedule.startUtc);assert.equal(schedule.rows.at(-1)!.endUtc,schedule.endUtc)
 for(let i=1;i<schedule.rows.length;i++) assert.equal(schedule.rows[i-1].endUtc,schedule.rows[i].startUtc)
 const end=report.timing.vimshottari.mahadashas.at(-1)!.endUtc;const beyond=fiveYearPeriods(report,end);assert.equal(beyond.completeHorizon,false);assert.deepEqual(beyond.rows,[])
})
test('transit geometry maps every point to natal houses and rejects unsupported dates',()=>{
 const t=transitOverlay(cancer(),'2026-10-01T12:00:00.000Z');for(const p of t.placements)assert.equal(p.natalHouse,houseForSign(p.sidereal.sign,'Cancer'))
 assert.throws(()=>transitOverlay(cancer(),'1700-01-01T00:00:00Z'))
 const crossings=slowPlanetIngresses('2026-10-01T12:00:00Z','2026-11-01T12:00:00Z');assert.ok(crossings.some(r=>r.planet==='Jupiter'&&r.from==='Cancer'&&r.to==='Leo'));assert.ok(crossings.every(r=>r.from!==r.to))
})
