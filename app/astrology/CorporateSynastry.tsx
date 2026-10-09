'use client'
import { useState } from 'react'
import type { BirthReport } from '@/lib/birth-report'
import type { corporateSynastry } from '@/lib/astrology-strategy'
import { computeBirthReport } from '@/app/knowledge/birth/actions'
import BirthplaceFields from './BirthplaceFields'
import { chartInput, type PlatformRequest, type Secondary } from './ExecutiveAccess'
import s from './astrology.module.css'
export type Synastry = ReturnType<typeof corporateSynastry>
export default function CorporateSynastry({ report, timeZones, request, example, demo, onSecondary }: { report: BirthReport; timeZones: string[]; request: PlatformRequest; example: boolean; demo?: Synastry; onSecondary: (secondary: Secondary) => void }) {
  const [kind, setKind] = useState<'corporate' | 'partner'>('corporate'), [live, setLive] = useState<Synastry>(), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const result = example ? demo : live
  async function compare(data: FormData) {
    setBusy(true); setError('')
    try {
      const state = await computeBirthReport({status:'idle'},data); if (state.status !== 'ok') throw new Error(state.status === 'error' ? state.message : 'Complete the second chart.')
      const label=String(data.get('label')||'Second chart'), secondary={kind,label,chart:chartInput(state.report)}
      const response=await request({operation:'synastry',chart:chartInput(report),secondary}); setLive(response.synastry as Synastry); onSecondary(response.secondary as Secondary)
    } catch(e) { setError((e as Error).message) } finally {setBusy(false)}
  }
  return <section className={s.reading}><p className={s.eyebrow}>DUAL-CHART WORKSPACE</p><h3>Founder ↔ entity, or person ↔ person.</h3><p>Compare house alignment and bidirectional aspect geometry. An entity uses its declared incorporation or launch instant. These comparisons establish no compatibility score, revenue forecast or suitability assessment.</p>{example && <p className={s.chatContext}>Fictional founder–entity preview. Calculate your chart and connect Executive access to compare another event or person.</p>}
    <form action={compare}><fieldset className={s.fields} disabled={example||busy}><label>Second chart type<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="corporate">Corporate inception / launch</option><option value="partner">Partner / co-founder</option></select></label><label>Chart label<input name="label" maxLength={80} required placeholder="Company or person"/></label><div className={s.fieldPair}><label>Date<input name="date" type="date" min="1800-01-01" max="2100-12-31" required/></label><label>Local time<input name="time" type="time" required/></label></div><label>Time uncertainty (± minutes)<input name="birthTimeUncertaintyMinutes" type="number" min="0" max="120" defaultValue="0" required/></label><BirthplaceFields timeZones={timeZones}/><input type="hidden" name="timingInstantUtc" value={report.timing.referenceInstantUtc.slice(0,16)}/><button className={s.primary}>{busy?'Comparing…':'Compare charts'}</button></fieldset></form>{error&&<p role="alert">{error}</p>}
    {result&&<><h4>Lagna configuration: {result.lagna.configuration}</h4><p>Secondary ascendant in founder H{result.lagna.forward}; founder ascendant in secondary H{result.lagna.reverse}.</p><div className={s.tableWrap}><table><caption>House alignment</caption><thead><tr><th>Secondary house</th><th>Sign</th><th>Founder house</th></tr></thead><tbody>{result.houseAlignment.map(h=><tr key={h.secondaryHouse}><td>{h.secondaryHouse}</td><td>{h.secondarySign}</td><td>{h.founderHouse}</td></tr>)}</tbody></table></div>{[['Secondary in founder',result.secondaryInFounder],['Founder in secondary',result.founderInSecondary]].map(([title,rows])=><div className={s.tableWrap} key={String(title)}><table><caption>{String(title)}</caption><thead><tr><th>Planet</th><th>Source sign / house</th><th>Target house</th></tr></thead><tbody>{(rows as Synastry['secondaryInFounder']).map(p=><tr key={p.planet}><td>{p.planet}</td><td>{p.sourceSign} · H{p.sourceHouse}</td><td>{p.targetHouse}</td></tr>)}</tbody></table></div>)}<h4>Moon nakshatra distances</h4><p>{result.moons.founderNakshatra} ↔ {result.moons.secondaryNakshatra} · inclusive counts {result.moons.forwardCount} / {result.moons.reverseCount}.</p><p>{result.moons.qualification}</p>{[['Secondary → founder',result.secondaryAspectsFounder],['Founder → secondary',result.founderAspectsSecondary]].map(([title,rows])=><details className={s.disclosure} key={String(title)}><summary>{String(title)} aspect contacts</summary>{(rows as Synastry['secondaryAspectsFounder']).filter(a=>a.targetPlanets.length).map((a,i)=><p key={i}>{a.sourcePlanet} H{a.sourceHouse} → {a.aspectDegree} → H{a.targetHouse} {a.targetPlanets.join(', ')}{a.convention==='disputed-nodal-trinal'?' (disputed nodal convention)':''}</p>)}</details>)}<p>{result.boundary}</p></>}
  </section>
}
