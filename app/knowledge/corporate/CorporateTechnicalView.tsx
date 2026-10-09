import type { CorporateLayers } from '@/lib/corporate-synthesis'
const summary = 'cursor-pointer rounded text-violet-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300'
function labels(value: { ownSign: boolean; exalted: boolean; debilitated: boolean; moolatrikonaSign: boolean; supported: boolean }) {
  if (!value.supported) return 'No dignity profile for this point'
  return [value.ownSign && 'own sign', value.exalted && 'exaltation sign', value.debilitated && 'debilitation sign', value.moolatrikonaSign && 'mūlatrikoṇa sign'].filter(Boolean).join(', ') || 'None of these categories; not a weakness verdict'
}
export default function CorporateTechnicalView({ layers }: { layers: CorporateLayers }) {
  const { advanced, timing } = layers
  return <section aria-label="Divisional and timing calculations" className="mt-6 min-w-0 space-y-6 text-sm leading-6 text-zinc-300">
    <section className="border border-zinc-700 p-5"><h3 className="text-xl font-semibold text-white">D9 and dignity: calculated categories</h3><p className="mt-2">{advanced.boundary}</p><p>Review: {advanced.reviewStatus}</p>
      <p className="mt-3">D9 ascendant: {advanced.d9.ascendant.sign} {advanced.d9.ascendant.degreeInSign.toFixed(2)}°. Houses are counted from this D9 ascendant, not D1.</p>
      <ul className="mt-4 space-y-4">{advanced.d9.placements.map(p => {
        const d = advanced.dignity.find(v => v.point === p.name)!
        const factors = advanced.d9Factors.find(v => v.point === p.name)!
        return <li key={p.name}><h4 className="font-semibold text-white">{p.name}: D9 {p.sign}, house {p.house}</h4><p>D1: {labels(d.d1)}. D9: {labels(d.d9)}.</p><p>{d.vargottama ? 'D1/D9 sign repetition (vargottama).' : 'D1 and D9 signs differ; this is not automatically a conflict.'}</p><details><summary className={summary}>Inspect {p.name} divisional uncertainty</summary>{[factors.sign, factors.house].map((f, i) => <div key={i}><p>{f.state}: {f.proof ?? 'No continuous interval proof.'}</p><ul>{f.alternatives.map(a => <li key={a.instantUtc}>{a.instantUtc}: {a.observed}</li>)}</ul></div>)}</details></li>
      })}</ul>
      <details className="mt-4"><summary className={summary}>Classical full aspects: Iyer II.13</summary><p className="mt-2">Directed longitude profile with ±15° target membership; separate from geometric timing contacts. Nodal aspects, fractional strength and D9 aspect interpretations are not included.</p><ul>{advanced.aspects.map(a => <li key={`${a.from}-${a.to}`}>{a.from} → {a.to}: {a.directedDegrees.toFixed(2)}°; target {a.matchedTargets.join(', ')}°.</li>)}</ul></details>
      <details className="mt-4"><summary className={summary}>Sources, locators and qualifications</summary>{advanced.sources.map(s => <div key={s.id} className="mt-3"><a className="underline focus-visible:outline focus-visible:outline-2" href={s.url}>{s.locator}</a><p>{s.summary}</p><p className="text-amber-200">{s.boundary}</p></div>)}</details>
    </section>
    <section className="border border-zinc-700 p-5"><h3 className="text-xl font-semibold text-white">Periods and transit interactions</h3><p className="mt-2">{timing.explanation}</p>
      {timing.snapshots.map(s => <article className="mt-4" key={s.days}><h4 className="font-semibold text-white">{s.referenceInstantUtc} {s.days ? `(+${s.days} days)` : '(reference)'}</h4><p>Vimshottari: {s.vimshottari.activeMahadasha.lord} / {s.vimshottari.activeAntardasha.lord}. Next nominal transition: {s.vimshottari.nextTransition.atUtc} → {s.vimshottari.nextTransition.lord}.</p><details><summary className={summary}>Inspect periods, transit placements and contacts</summary><ul>{s.transits.placements.map(p => <li key={p.point}>{p.point}: {p.siderealSign} {p.degreeInSign.toFixed(2)}°, nominal D1 house {p.natalWholeSignHouse}, {p.motion}.</li>)}</ul><ul>{s.transits.contacts.map((c, i) => <li key={i}>{c.transitPoint} → natal {c.natalPoint}: {c.aspect}, orb {c.orbDegrees.toFixed(2)}°.</li>)}</ul>{s.vimshottari.sourceReferences.map(source => <p key={source.url}><a href={source.url} className="underline">{source.title}, {source.locator}</a>. {source.note}</p>)}</details></article>)}
      {timing.interactions.length > 0 && <details className="mt-4"><summary className={summary}>Period-lord / transit overlaps</summary><ul>{timing.interactions.map((i, n) => <li key={n}>{i.referenceUtc}: {i.contact.transitPoint} → {i.contact.natalPoint}, {i.contact.aspect}. {i.explanation}</li>)}</ul></details>}
      {timing.alternatives.length > 0 && <details className="mt-4"><summary className={summary}>Formation-time alternatives for periods</summary><ul>{timing.alternatives.map(a => <li key={a.instantUtc}>{a.instantUtc}: {a.major.lord}/{a.sub.lord}; next nominal boundary {a.next.atUtc}.</li>)}</ul><p>Agreement at these instants is not proof of stability throughout the interval.</p></details>}
    </section>
    <section className="border border-zinc-700 p-5"><h3 className="text-xl font-semibold text-white">Reading the factors together</h3><p>{layers.synthesis.explanation}</p>{layers.synthesis.groups.map(g => <div key={g.layer} className="mt-3"><h4 className="font-semibold">{g.layer}: {g.includedRuleIds.length} admitted modules</h4><ul>{g.qualifications.map((q, i) => <li key={i}>{q}</li>)}</ul></div>)}
      {layers.synthesis.conflicts.length > 0 && <div className="mt-4"><h4 className="font-semibold text-amber-200">Unresolved interpretations</h4><ul>{layers.synthesis.conflicts.map(c => <li key={c.ruleIds.join('|')}>{c.ruleIds.join(' / ')}: {c.explanation}</li>)}</ul></div>}
      <p className="mt-3">A planet may meet more than one dignity category. D1 and D9 classifications describe different coordinates, not votes for a single favorable or unfavorable verdict.</p></section>
  </section>
}
