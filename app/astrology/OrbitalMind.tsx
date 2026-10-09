'use client'
import { useState } from 'react'
import { ORBITAL_BOUNDARY, ORBITAL_LENSES, orbitalSource, type OrbitalCheckIn, type OrbitalLensId } from '@/lib/orbital-mind'
import s from './astrology.module.css'

export default function OrbitalMind({ onAsk }: { onAsk: (checkIn: OrbitalCheckIn) => void }) {
  const [selected, setSelected] = useState<OrbitalLensId | null>(null)
  const [situation, setSituation] = useState('')
  const [outcome, setOutcome] = useState('')
  const lens = ORBITAL_LENSES.find(item => item.id === selected)
  return <section aria-label="Orbital Mind check-in" className={s.orbital}>
    <p className={s.eyebrow}>THE ORBITAL MIND · BY MAYONE MAHA RAJAN</p>
    <h4>What feels stuck?</h4>
    <p>Choose a tension that fits your experience now. Explore both needs, try a small experiment, and notice what happened. No birth details are needed.</p>
    <p className={s.readingBoundary}>{ORBITAL_BOUNDARY}</p>
    <div className={s.orbitalChoices}>{ORBITAL_LENSES.map(item => <button type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setOutcome('') }}><strong>{item.title}</strong><small>{item.functions} · {item.planets}</small></button>)}</div>
    {lens && <div className={s.practicalFocus}>
      <p className={s.eyebrow}>{lens.planets} · A LENS YOU CHOSE</p>
      <h4>Make room for both needs</h4>
      <ul>{lens.needs.map(need => <li key={need}>{need}</li>)}</ul>
      <label>Your situation (optional)<textarea value={situation} maxLength={1000} rows={3} onChange={event => setSituation(event.target.value)} placeholder={lens.question} /></label>
      <h4>One small experiment</h4><p>{lens.experiment}</p>
      <label>What happened? (optional)<textarea value={outcome} maxLength={1000} rows={3} onChange={event => setOutcome(event.target.value)} placeholder="What did you try, what happened, and what might you adjust?" /></label>
      <p className={s.privacy}>These notes stay in this page while it is open. Ask AI prepares a question; sending it shares your notes with Claude.</p>
      <button type="button" className={s.primary} onClick={() => onAsk({ lensId: lens.id, situation, outcome })}>Explore this with AI →</button>
      <details><summary>Book source & interpretation</summary><p>{lens.account}</p><p><a href={orbitalSource(lens.id)}>The Orbital Mind · {lens.locator} ↗</a></p><small>The exercise above is Maha’s adaptation of the source, not a tested treatment.</small></details>
    </div>}
    <details className={s.moreLenses}><summary>How this connects to your chart</summary><p>The planetary names organize the book’s functions. Everyone can explore every function. A placement, aspect or period does not establish which tension you are experiencing. Uranus and Neptune here are book metaphors; this feature adds no bodies or rules to the Jyotisha calculation.</p><p>The companion paper formalizes five proposed motifs and ten testable predictions. It reports no validation of the model. We use it to explain the framework, not to score your mind or forecast a collapse.</p><a href={orbitalSource('theory')}>Read the framework and its limits ↗</a></details>
  </section>
}
