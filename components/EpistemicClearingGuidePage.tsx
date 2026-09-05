import Link from 'next/link'

import { MAHA_SITE_URL } from '@/lib/entity'
import type { ClearingGuide } from '@/lib/epistemic-clearing-batch-one'

const laneLabels: Record<ClearingGuide['lane'], string> = {
  'machine-integrations': 'Book-concept machine application',
  'tamil-religion': 'Tamil religion evidence clearing',
  'astrology-infrastructure': 'Astrology infrastructure',
  'evidence-clearing': 'Evidence clearing protocol',
  'mathematics-astronomy': 'Mathematics and astronomy verification',
  'cross-domain-synthesis': 'Typed cross-domain synthesis',
}

const roleLabels: Record<ClearingGuide['sourceLinks'][number]['role'], string> = {
  'operational-source': 'Operational source',
  'inspected-source-projection': 'Published evidence projection',
  'conceptual-lens': 'Conceptual lens only',
  'related-guide': 'Related guide',
}

export function EpistemicClearingGuidePage({ guide }: { guide: ClearingGuide }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: guide.title,
    description: guide.summary,
    url: `${MAHA_SITE_URL}${guide.path}`,
    datePublished: guide.preparedOn,
    dateModified: guide.preparedOn,
    isAccessibleForFree: true,
    citation: guide.sourceLinks
      .filter((source) => source.role === 'operational-source' || source.role === 'inspected-source-projection')
      .map((source) => `${MAHA_SITE_URL}${source.path}`)
      .concat(guide.sourceBoundaryInspection ? [guide.sourceBoundaryInspection.sourceUrl] : []),
    hasPart: {
      '@type': 'FAQPage',
      mainEntity: guide.questions.map((entry) => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: { '@type': 'Answer', text: entry.answer },
      })),
    },
  }

  return <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-cyan-300 selection:text-black sm:px-12">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <div className="mx-auto max-w-6xl">
      <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span><span className="text-zinc-400">Epistemic clearing</span></nav>

      <header className="mt-10 border-b border-zinc-800 pb-10">
        <div className="flex flex-wrap items-center gap-3"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">{laneLabels[guide.lane]}</p><span className="border border-violet-900 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-violet-300">Digest-bound guide</span></div>
        <h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{guide.title}</h1>
        <p className="mt-6 max-w-4xl font-serif text-xl leading-8 text-zinc-200">{guide.question}</p>
        <p className="mt-5 max-w-4xl text-sm leading-7 text-zinc-400">{guide.summary}</p>
      </header>

      <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article>
          <section className="border-l-2 border-cyan-500 bg-cyan-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Bounded answer</p><p className="mt-4 font-serif text-lg leading-8 text-zinc-100">{guide.directAnswer}</p>{guide.methodBoundary ? <p className="mt-5 border-t border-cyan-950 pt-4 text-xs leading-6 text-cyan-100/70">{guide.methodBoundary}</p> : null}</section>

          <section className="mt-14"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Input contract</p><h2 className="mt-3 text-3xl font-semibold text-white">What must be fixed first</h2><div className="mt-7 grid gap-3 sm:grid-cols-2">{guide.requiredInputs.map((input) => <p key={input} className="border border-zinc-800 px-4 py-3 text-sm leading-6 text-zinc-300">{input}</p>)}</div></section>

          <section className="mt-14"><p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Procedure</p><h2 className="mt-3 text-3xl font-semibold text-white">Work the decision in order</h2><ol className="mt-7 space-y-5">{guide.orderedSteps.map((step, index) => <li key={step} className="grid grid-cols-[36px_1fr] gap-4"><span className="flex h-9 w-9 items-center justify-center border border-violet-700 font-mono text-xs text-violet-300">{index + 1}</span><p className="pt-1 text-sm leading-7 text-zinc-300">{step}</p></li>)}</ol></section>

          <section className="mt-14 grid gap-8 md:grid-cols-2"><div><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Expected outputs</p><ul className="mt-5 space-y-3">{guide.expectedOutputs.map((output) => <li key={output} className="border-l border-emerald-700 pl-3 text-sm leading-6 text-zinc-300">{output}</li>)}</ul></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Refuse when</p><ul className="mt-5 space-y-3">{guide.refusalConditions.map((condition) => <li key={condition} className="border-l border-rose-800 pl-3 text-sm leading-6 text-zinc-300">{condition}</li>)}</ul></div></section>

          {guide.decisionRecord ? <section className="mt-14 border border-violet-900/70 bg-violet-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Subject-specific decision record</p><h2 className="mt-3 text-2xl font-semibold text-white">What a complete answer would require</h2><dl className="mt-6 space-y-5 text-sm leading-7"><div><dt className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">Minimum evidence</dt><dd className="mt-1 text-zinc-300">{guide.decisionRecord.minimumEvidence}</dd></div><div><dt className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">Pass condition</dt><dd className="mt-1 text-zinc-300">{guide.decisionRecord.passCondition}</dd></div><div><dt className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">Current result</dt><dd className="mt-1 text-amber-200">{guide.decisionRecord.resultStatus}</dd></div></dl></section> : null}

          <section className="mt-14"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Questions this guide answers</p><div className="mt-7 space-y-5">{guide.questions.map((entry) => <details key={entry.question} className="border border-zinc-800 p-5"><summary className="cursor-pointer text-sm font-semibold text-zinc-100">{entry.question}</summary><p className="mt-4 text-sm leading-7 text-zinc-400">{entry.answer}</p></details>)}</div></section>

          <section className="mt-14 border border-amber-900/70 bg-amber-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Limits</p><ul className="mt-5 space-y-3">{guide.limitations.map((limit) => <li key={limit} className="border-l border-amber-800 pl-3 text-sm leading-6 text-zinc-300">{limit}</li>)}</ul></section>

          {guide.sourceBoundaryInspection ? <section className="mt-14 border border-cyan-900/70 bg-cyan-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Inspected source boundary</p><h2 className="mt-3 text-2xl font-semibold text-white">Edition and locator</h2><p className="mt-5 text-sm leading-7 text-zinc-300">{guide.sourceBoundaryInspection.locator}</p><a href={guide.sourceBoundaryInspection.sourceUrl} rel="noreferrer" className="mt-4 inline-block text-sm text-cyan-200 underline decoration-cyan-900 underline-offset-4 hover:text-white">Open the named source edition →</a>{guide.sourceBoundaryInspection.sourceAnomaly ? <p className="mt-5 border-l border-amber-700 pl-3 text-xs leading-6 text-amber-100/80">{guide.sourceBoundaryInspection.sourceAnomaly}</p> : null}<p className="mt-5 text-xs leading-6 text-zinc-500">Boundary inspection does not imply translation, historical, reception, or theological verification.</p></section> : null}
        </article>

        <aside className="space-y-7">
          <div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Evidence frame</p><p className="mt-3 text-sm leading-6 text-zinc-300">{guide.evidenceFrame.replaceAll('-', ' ')}</p><p className="mt-4 text-xs leading-6 text-zinc-500">{guide.releaseBoundary}</p></div>
          <div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Named sources and lenses</p><div className="mt-4 space-y-4">{guide.sourceLinks.map((source) => <Link key={`${source.role}:${source.path}`} href={source.path} className="block border-l border-cyan-900 pl-3"><span className="block text-sm text-zinc-200 hover:text-white">{source.title}</span><span className="mt-1 block font-mono text-[9px] uppercase tracking-widest text-zinc-600">{roleLabels[source.role]}</span></Link>)}</div></div>
          <div className="border border-cyan-900 bg-cyan-950/10 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Next action</p><p className="mt-3 text-xs uppercase tracking-widest text-zinc-600">{guide.commercialAction.state.replaceAll('-', ' ')}</p><Link href={guide.commercialAction.path} className="mt-4 block text-sm text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white">{guide.commercialAction.label} →</Link></div>
          <div className="break-all border border-zinc-800 p-5 font-mono text-[9px] leading-5 text-zinc-600"><p>{guide.provenanceDigest}</p><p className="mt-3">Candidate rank {guide.candidateRank} · digest-bound batch guide</p></div>
        </aside>
      </div>
    </div>
  </main>
}
