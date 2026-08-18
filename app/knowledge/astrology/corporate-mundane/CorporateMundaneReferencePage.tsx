import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import {
  CORPORATE_MUNDANE_PATH,
  CORPORATE_MUNDANE_RELEASE_DATE,
  corporateMundaneReferencePath,
  getCorporateMundaneReference,
  getCorporateMundaneSource,
  type CorporateMundaneReference,
} from '@/lib/corporate-mundane-references'

export default function CorporateMundaneReferencePage({ reference }: { reference: CorporateMundaneReference }) {
  const sources = reference.sourceIds.map(getCorporateMundaneSource).filter((source) => source !== undefined)
  const related = reference.relatedSlugs.map(getCorporateMundaneReference).filter((entry) => entry !== undefined)
  const path = corporateMundaneReferencePath(reference)
  const isCaseStudy = reference.kind === 'sanitized-case-study'
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'TechArticle', headline: reference.title,
    description: reference.description, datePublished: CORPORATE_MUNDANE_RELEASE_DATE,
    dateModified: CORPORATE_MUNDANE_RELEASE_DATE, mainEntityOfPage: `${SITE_URL}${path}`,
    articleSection: isCaseStudy ? 'Sanitized corporate methodology demonstration' : 'Corporate and mundane astrology methodology',
    author: { '@type': 'Organization', name: 'Maha Celestial', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Maha Strategies', url: SITE_URL },
    citation: sources.map((source) => source.url),
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="mx-auto max-w-4xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge/astrology" className="hover:text-white">Astrology traditions</Link><span className="px-2">/</span><Link href={CORPORATE_MUNDANE_PATH} className="hover:text-white">Corporate and mundane</Link><span className="px-2">/</span><span className="text-zinc-400">{reference.title}</span></nav>
        <header className="mt-10 border-b border-zinc-800 pb-10">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-widest"><span className={isCaseStudy ? 'border border-amber-700/60 bg-amber-950/30 px-2 py-1 text-amber-300' : 'border border-cyan-700/60 bg-cyan-950/30 px-2 py-1 text-cyan-300'}>{isCaseStudy ? 'Sanitized demonstration · not a client outcome' : 'Declared methodology'}</span><span className="text-rose-300">Not evidence of predictive skill</span></div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">{reference.title}</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">{reference.description}</p>
          <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600">Corporate and mundane reference · released {CORPORATE_MUNDANE_RELEASE_DATE}</p>
        </header>

        <section className="mt-8 border border-cyan-900/60 bg-cyan-950/10 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Question governed by this page</h2><p className="mt-3 font-serif text-base leading-8 text-zinc-200">{reference.question}</p></section>
        <section className="mt-12 border-t border-zinc-800 pt-8"><h2 className="text-2xl font-semibold text-white">Method</h2><p className="mt-4 font-serif text-base leading-8 text-zinc-400">{reference.method}</p><h3 className="mt-7 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Evidence required</h3><ul className="mt-4 grid gap-2 sm:grid-cols-2">{reference.evidenceRequired.map((input) => <li key={input} className="border-l border-cyan-800/70 pl-3 text-sm leading-6 text-zinc-300">{input}</li>)}</ul></section>
        <section className="mt-12 grid gap-5 sm:grid-cols-2"><div className="border border-zinc-800 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Decision rule</h2><p className="mt-3 text-sm leading-7 text-zinc-300">{reference.decisionRule}</p></div><div className="border border-zinc-800 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-amber-300">{isCaseStudy ? 'Sanitized result' : 'Sanitized example'}</h2><p className="mt-3 text-sm leading-7 text-zinc-300">{reference.sanitizedExample}</p></div></section>
        <section className="mt-12 border border-amber-900/50 bg-amber-950/10 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Sanitization disclosure</h2><p className="mt-3 text-sm leading-7 text-zinc-300">{reference.sanitization}</p></section>
        <section className="mt-12 border border-zinc-800 p-6"><h2 className="text-xl font-semibold text-white">Limitations</h2><p className="mt-3 text-sm leading-7 text-zinc-300">{reference.limitations}</p></section>
        <section className="mt-12 border-l-2 border-rose-500 bg-rose-950/10 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">What this does not establish</h2><p className="mt-3 text-sm leading-7 text-zinc-200">{reference.doesNotEstablish}</p></section>

        <section className="mt-12 border-t border-zinc-800 pt-8"><h2 className="text-2xl font-semibold text-white">Method and calculation sources</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Sources establish a calculation convention or Maha’s declared method. They do not establish predictive meaning.</p><ol className="mt-6 space-y-5">{sources.map((source) => <li key={source.id} className="border-l border-zinc-700 pl-4"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-zinc-100 underline decoration-zinc-700 underline-offset-4 hover:text-white">{source.title}</a><p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-zinc-600">{source.authority}</p><p className="mt-2 text-xs leading-5 text-zinc-500">{source.establishes}</p><p className="mt-1 text-xs leading-5 text-zinc-600"><span className="text-amber-400">Boundary:</span> {source.boundary}</p></li>)}</ol></section>
        {related.length > 0 && <section className="mt-12 border border-zinc-800 p-6"><h2 className="text-xl font-semibold text-white">Related corporate references</h2><div className="mt-5 flex flex-wrap gap-3">{related.map((entry) => <Link key={entry.slug} href={corporateMundaneReferencePath(entry)} className="border border-zinc-700 px-4 py-3 text-xs text-zinc-300 hover:border-cyan-500 hover:text-cyan-200">{entry.title} →</Link>)}</div></section>}
      </article>
    </main>
  )
}
