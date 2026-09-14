import type { BirthReport } from '@/lib/birth-report'

/** Render only the per-request projection; never import source corpora here. */
export default function InspectableReading({ report }: { report: BirthReport }) {
  const { foundation, reading } = report
  return <section aria-labelledby="inspectable-reading-title" className="mt-8 space-y-6 break-words text-zinc-200">
    <h2 id="inspectable-reading-title" className="text-2xl font-semibold">D1 / D9 and inspectable interpretation</h2>
    <p className="text-sm leading-7">{reading.empiricalStatus} {reading.educational.reviewBasis}</p>
    <p className="text-sm leading-7">{reading.synthesis}</p>
    <div className="grid gap-4 sm:grid-cols-2">{reading.sections.filter(s => s.id === 'overview').map(section => <article key={section.id} className="min-w-0 border border-zinc-700 p-4">
      <h3 className="text-lg font-semibold">{section.heading}</h3><p className="my-2 text-xs text-violet-200">{section.status.replaceAll('-', ' ')}</p>
      <p className="text-sm leading-7">{section.explanation}</p>
    </article>)}</div>
    <p className="text-sm leading-7">This educational profile uses Varāhamihira through Iyer’s 1885 edition and the declared modern Lahiri calculation conventions. It does not attribute Lahiri to the historical author. Reflection prompts are Maha’s adaptation, not ancient predictions.</p>
    {[...reading.educational.sections, ...reading.educational.planetary].map(note => <article key={note.id} className="border border-zinc-700 p-4 space-y-3">
      <h3 className="text-lg font-semibold">{note.heading}</h3>
      <p className="text-sm leading-7">{note.explanation}</p>
      <p className="border-l-2 border-violet-400 pl-3 text-sm leading-7"><strong>{note.status === 'nominal-study-only' ? 'Uncertainty: ' : 'Optional reflection: '}</strong>{note.reflection}</p>
      <details><summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-300">Inspect calculated factors, source and limits</summary>
        <ul className="my-3 space-y-2">{note.factors.map(f => <li key={`${f.chart}:${f.name}`} className="text-sm">{f.chart} · {f.name}: {f.value}</li>)}</ul>
        {note.sources.map(s => <div key={s.id} className="mt-3 text-sm leading-7"><a href={s.url} target="_blank" rel="noreferrer noopener" className="text-violet-200 underline">{s.title}</a> · {s.edition} · {s.locator}
          <p>{s.account}</p><p>Boundary: {s.boundary}</p><p>Rights: {s.rights}</p></div>)}
        <p className="mt-3 text-sm leading-7">{note.reflectionBasis} {note.reviewBasis}</p>
        <ul>{[...note.rule.exceptions, ...note.rule.conflicts].map(text => <li key={text} className="text-sm leading-7">{text}</li>)}</ul>
        <p className="mt-3 break-all text-xs">{note.rule.profile} · {note.ruleDigest}</p>
      </details>
    </article>)}
    <p className="text-sm leading-7">Not provided: {reading.educational.unavailable.join('; ')}.</p>
    <details className="border border-zinc-700 p-4" open>
      <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-300">Calculated D9 placements — nominal birth time</summary>
      <p className="my-3 text-sm">Ascendant: {foundation.d9.ascendant.sign}. {foundation.d9.boundary}</p>
      <ul className="grid gap-3 sm:grid-cols-2">{foundation.d9.placements.map(point => <li key={point.name} className="text-sm">
        {point.name}: {point.sign} {point.degreeInSign.toFixed(2)}° · D9 house {point.house}
      </li>)}</ul>
    </details>
    <details className="border border-zinc-700 p-4" open={foundation.sensitivity.uncertaintyMinutes > 0}>
      <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-300">Birth-time uncertainty and alternatives</summary>
      <p className="my-3 text-sm leading-7">±{foundation.sensitivity.uncertaintyMinutes} minutes · {foundation.sensitivity.samples.length} samples. {foundation.sensitivity.explanation}</p>
      <ul className="space-y-3">{foundation.sensitivity.alternatives.map(alternative => <li key={alternative.offsetMinutes} className="border-l border-violet-500 pl-3 text-sm leading-7">
        Sample {alternative.offsetMinutes.toFixed(2)} minutes from nominal: D1 ascendant {alternative.d1Ascendant}, D9 ascendant {alternative.d9Ascendant}.
        <ul>{alternative.factors.map(factor => <li key={factor.name}>{factor.name}: D1 {factor.d1Sign}, house {factor.d1House}; D9 {factor.d9Sign}, house {factor.d9House}.</li>)}</ul>
      </li>)}</ul>
      {foundation.sensitivity.periodAlternatives.map(period => <p key={period.offsetMinutes} className="mt-3 text-sm">Sample {period.offsetMinutes.toFixed(2)} minutes: {period.mahadasha.lord}–{period.antardasha.lord}; next transition {period.nextTransition.atUtc.slice(0, 10)}.</p>)}
    </details>
    <details className="border border-zinc-700 p-4">
      <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-300">Upcoming position snapshots (not event forecasts)</summary>
      {foundation.upcoming.map(snapshot => <div key={snapshot.daysAfterReference} className="mt-4 text-sm leading-7"><h3>{snapshot.instantUtc.slice(0, 10)}</h3>
        <ul>{snapshot.placements.map(point => <li key={point.name}>{point.name}: {point.sign}, nominal D1 house {point.nominalD1House}</li>)}</ul>
      </div>)}
    </details>
    {reading.modules.map(module => <details key={module.ruleId} className="border border-zinc-700 p-4">
      <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-300">Traditional note: {module.heading}</summary>
      <p className="mt-3 text-sm leading-7">{module.interpretation}</p>
      <p className="mt-3 text-sm leading-7">Scope: {module.chartScope}. {module.reviewBasis}</p>
      <h3 className="mt-4 font-semibold">Why this applies</h3>
      <ul>{module.requiredFactors.map(factor => <li key={factor.field} className="text-sm leading-7">{factor.requirement}</li>)}</ul>
      <p className="text-sm leading-7">Matched: {module.matchedFactors.join('; ') || 'See the required factors and calculation receipt.'}</p>
      <p className="mt-3 text-sm leading-7">Limits: {module.qualifications}</p>
      {module.conflicts.map(conflict => <p key={conflict} className="mt-3 text-sm leading-7">Disagreement: {conflict}</p>)}
      <ul className="mt-4 space-y-3">{module.sources.map(source => <li key={source.id} className="text-sm leading-7">
        <a href={source.url} target="_blank" rel="noreferrer noopener" className="text-violet-200 underline focus-visible:outline-2">{source.title}</a> · {source.locator} · {source.edition} · {source.translator} · Rights: {source.rights}
      </li>)}</ul>
    </details>)}
    <details className="border border-zinc-700 p-4"><summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-300">Withheld rules and verification details</summary>
      <p className="my-3 text-sm">{reading.practitionerMethods.reason}</p>
      <ul className="space-y-2">{reading.withheld.map(rule => <li key={rule.ruleId} className="text-sm leading-7">{rule.ruleId}: {rule.reason} — {rule.explanation}</li>)}</ul>
      <p className="mt-4 break-all text-xs">{reading.version} · {foundation.version} · {reading.registryVersion} · {reading.receiptDigest}</p>
      <ul className="mt-3 space-y-2">{Object.entries(foundation.conventions).map(([key, value]) => <li key={key} className="text-sm">{key}: {value}</li>)}</ul>
    </details>
  </section>
}
