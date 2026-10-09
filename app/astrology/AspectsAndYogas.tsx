'use client'
import { useState } from 'react'
import type { strategicGeometry } from '@/lib/astrology-strategy'
import s from './astrology.module.css'
export type Strategy = ReturnType<typeof strategicGeometry>
export default function AspectsAndYogas({ data, load, example }: { data?: Strategy; load: () => Promise<Strategy>; example: boolean }) {
  const [live, setLive] = useState<Strategy>(), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const result = live ?? data
  return <section className={s.reading}><p className={s.eyebrow}>RELATIONAL GEOMETRY</p><h3>Aspects & classical formation screens.</h3><p>Whole-sign dṛṣṭi uses inclusive sign counts. Mars: 4/7/8; Jupiter: 5/7/9; Saturn: 3/7/10. Nodal 5/7/9 is a disputed convention. A geometric match does not certify a complete classical yoga or its claimed outcomes.</p>{example && <p className={s.chatContext}>Fictional Executive preview. Personal calculations require verified Executive access or a current pass.</p>}
    {!example && <button className={s.download} disabled={busy} onClick={async () => { setBusy(true); setError(''); try { setLive(await load()) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }}>Calculate relational matrix</button>}
    {error && <p role="alert">{error}</p>}
    {result && <><div className={s.tableWrap}><table><caption>House lordships</caption><thead><tr><th>House</th><th>Sign</th><th>Lord</th><th>Lord placement</th></tr></thead><tbody>{result.lordships.map(h => <tr key={h.house}><td>{h.house}</td><td>{h.sign}</td><td>{h.lord}</td><td>{h.lordSign} · house {h.lordPlacementHouse}</td></tr>)}</tbody></table></div><div className={s.tableWrap}><table><caption>Aspect vectors</caption><thead><tr><th>Source</th><th>Inclusive aspect</th><th>Target</th><th>Natal occupants</th></tr></thead><tbody>{result.aspects.map((a, i) => <tr key={i}><td>{a.sourcePlanet} · H{a.sourceHouse}</td><td>{a.aspectDegree}{a.convention === 'disputed-nodal-trinal' ? ' · disputed' : ''}</td><td>{a.targetSign} · H{a.targetHouse}</td><td>{a.targetPlanets.join(', ') || '—'}</td></tr>)}</tbody></table></div><h4>Yoga matrix · screening only</h4>{result.yogaFormations.map(y => <details className={s.disclosure} key={y.id}><summary>{y.name} · {y.detected ? 'Geometry matched' : 'Not matched'}</summary><p>{y.planets.join(' + ')} · {y.criteria}</p>{y.qualifications.map(q => <p key={q}>{q}</p>)}<a href={y.source.url} target="_blank" rel="noreferrer">{y.source.title}</a><p>{y.source.locator} · Interpretation withheld pending passage review.</p></details>)}</>}
  </section>
}
