'use client'

import { useState } from 'react'
import type { BirthReport } from '@/lib/birth-report'
import s from './astrology.module.css'
import OrbitalMind from './OrbitalMind'
import type { OrbitalCheckIn } from '@/lib/orbital-mind'

type EducationalNote = BirthReport['reading']['educational']['planetary'][number]
const lenses = [
  { planet: 'Sun', title: 'Values & direction', context: 'Begin with what matters to you and the commitments that express it.', action: 'Choose one commitment this week. Write down why it matters to you, and one small action that would bring it closer to your values.' },
  { planet: 'Moon', title: 'Mind & everyday responses', context: 'Make space to notice your responses before deciding what they mean.', action: 'Recall one recent situation that stayed with you. Separate what happened from your interpretation, then consider what you needed in that moment.' },
  { planet: 'Mercury', title: 'Communication & clarity', context: 'Look at how you express yourself, ask questions and reach understanding.', action: 'Choose a conversation or decision that feels unclear. Write one direct question you could ask instead of making an assumption.' },
  { planet: 'Mars', title: 'Effort & initiative', context: 'Consider where to act, where to persist, and where a pause could help.', action: 'Pick one task that needs movement. Define a manageable first step, and decide when you will take it.' },
  { planet: 'Jupiter', title: 'Learning & perspective', context: 'Explore what would help you understand a situation more fully.', action: 'Identify one thing you do not yet know about a current decision. Choose a reliable source or person who could help you check it.' },
  { planet: 'Venus', title: 'Enjoyment & priorities', context: 'Notice what you want, what you appreciate, and what deserves more attention.', action: 'Name something you value or enjoy. Make room for it in a way that respects your commitments and the people involved.' },
  { planet: 'Saturn', title: 'Boundaries & commitments', context: 'Acknowledge practical limits and the responsibilities that need a sustainable pace.', action: 'Review one demanding commitment. Decide what you can realistically do, what support you need, and where a clearer limit would help.' },
] as const

function SourceDetails({ note }: { note: EducationalNote }) {
  return <details className={s.readingSource}>
    <summary>Chart factors & source</summary>
    <p>{note.explanation}</p>
    <p>{note.reflectionBasis}</p>
    {note.sources.map(source => <p key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a> · {source.locator}</p>)}
    <p>{note.rule.qualification}</p>
  </details>
}

export default function GeneralReading({ report, onAskOrbital }: { report: BirthReport; onAskOrbital: (checkIn: OrbitalCheckIn) => void }) {
  const [topic, setTopic] = useState<'Overall' | 'Work' | 'Relationships' | 'Orbital Mind'>('Overall')
  const [focus, setFocus] = useState<string>('Sun')
  const chart = report.natalChart
  const educational = report.reading.educational
  const uncertain = report.foundation.sensitivity.uncertaintyMinutes > 0
  const planet = (name: string) => chart.placements.find(point => point.name === name)
  const moon = planet('Moon'), sun = planet('Sun')
  const ruler = chart.houses.find(house => house.number === 1)?.ruler
  const rulerPoint = ruler && planet(ruler)
  const focusLens = lenses.find(lens => lens.planet === focus)!
  const focusNote = educational.planetary.find(note => note.id === `planet-${focus}`)
  const selectedNote = educational.sections.find(note => note.id === (topic === 'Work' ? 'work' : 'relationships'))

  function lensCard(lens: typeof lenses[number]) {
    const note = educational.planetary.find(note => note.id === `planet-${lens.planet}`)
    const point = planet(lens.planet)
    if (!note || !point) return null
    return <article key={lens.planet} className={s.lensCard}>
      <p className={s.eyebrow}>{lens.planet} · {point.sidereal.sign} · house {point.wholeSignHouse}</p>
      <h4>{lens.title}</h4>
      <p>{lens.context}</p>
      <blockquote>{note.reflection}</blockquote>
      {!uncertain && note.status === 'educational-reflection' && <button type="button" className={s.focusButton} onClick={() => setFocus(lens.planet)} aria-pressed={focus === lens.planet}>Use this as my focus {focus === lens.planet ? '✓' : '→'}</button>}
      <SourceDetails note={note} />
    </article>
  }

  return <div className={s.reading}>
    <p className={s.eyebrow}>THE BIGGER PICTURE</p>
    <h3>{topic === 'Orbital Mind' ? 'Your inner system, in context.' : 'Your overall reading.'}</h3>
    <div hidden={topic === 'Orbital Mind'}>
    <p>Start with your values, everyday responses and ways of communicating. Then explore where you put your effort, what you want to learn, and which commitments deserve your attention.</p>
    <div className={s.readingSummary} aria-label="Reading chart overview">
      {[
        ['Rising sign', chart.ascendant.sidereal.sign],
        ['Sun', sun?.sidereal.sign],
        ['Moon', moon?.sidereal.sign],
      ].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value ?? 'Unavailable'}</strong></div>)}
    </div>
    {rulerPoint && <p className={s.rulerSummary}>{chart.ascendant.sidereal.sign} rises in this chart. Its traditional ruler, {ruler}, is in {rulerPoint.sidereal.sign}, house {rulerPoint.wholeSignHouse}. This gives you a starting point for exploring the chart’s structure.</p>}
    <p className={s.readingBoundary}>The placements are calculated. The questions use traditional planetary symbolism as a starting point for reflection; they don’t establish your personality or future.</p>
    {uncertain && <div role="note" className={s.uncertaintyNote}><strong>Birth-time uncertainty: ±{report.foundation.sensitivity.uncertaintyMinutes} minutes</strong><p>These are nominal chart positions. Chart-based personal reflection is withheld while the birth-time range remains unresolved. Explore the sampled alternatives in the Chart view.</p></div>}
    </div>
    <nav className={s.readingTopics} aria-label="Reading topics">{(['Overall', 'Orbital Mind', 'Work', 'Relationships'] as const).map(name => <button type="button" key={name} aria-pressed={topic === name} onClick={() => setTopic(name)}>{name}</button>)}</nav>
    <div hidden={topic !== 'Orbital Mind'}><OrbitalMind onAsk={onAskOrbital} /></div>
    {topic === 'Orbital Mind' ? null : topic === 'Overall' ? <>
      <h4>Start with yourself</h4>
      <p>Use these three lenses to notice what fits your experience. You can leave aside anything that doesn’t feel useful.</p>
      <div className={s.lensGrid}>{lenses.slice(0, 3).map(lensCard)}</div>
      <details className={s.moreLenses}><summary>Explore effort, learning, enjoyment & boundaries</summary><div className={s.lensGrid}>{lenses.slice(3).map(lensCard)}</div></details>
      {!uncertain && focusNote?.status === 'educational-reflection' && <section className={s.practicalFocus} aria-label="Practical reflection">
        <p className={s.eyebrow}>PUT IT INTO PRACTICE</p>
        <h4>One focus for this week</h4>
        <label>Choose an area<select value={focus} onChange={event => setFocus(event.target.value)}>{lenses.filter(lens => educational.planetary.some(note => note.id === `planet-${lens.planet}`)).map(lens => <option key={lens.planet} value={lens.planet}>{lens.title}</option>)}</select></label>
        <p className={s.focusQuestion}>{focusNote.reflection}</p>
        <p>{focusLens.action}</p>
        <small>This exercise is Maha’s optional suggestion. Your chosen focus is not a ranking of planets or a forecast.</small>
      </section>}
    </> : selectedNote ? <article className={s.lifeArea}>
      <p className={s.eyebrow}>OPTIONAL LIFE AREA</p>
      <h4>{topic === 'Work' ? 'Work & vocation' : 'Relationships & connection'}</h4>
      <p>{topic === 'Work' ? 'Consider the work you want to do, the skills it calls for, and the priorities you want it to serve.' : 'Use this lens when you want to reflect on respect, communication and what you value in your connections.'}</p>
      <blockquote>{selectedNote.reflection}</blockquote>
      <SourceDetails note={selectedNote} />
    </article> : <p>This topic is not available for this chart.</p>}
    {report.reading.modules.length > 0 && <details className={s.moreLenses}><summary>Additional classical calendar notes</summary>{report.reading.modules.map(note => <article key={note.ruleId}><h4>{note.heading}</h4><p>{note.interpretation}</p><p>{note.qualifications}</p>{note.sources.map(source => <p key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a> · {source.locator}</p>)}</article>)}</details>}
  </div>
}
