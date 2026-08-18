import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import { TIMING_REFERENCE_CATEGORIES, TIMING_REFERENCE_PATH, TIMING_REFERENCE_RELEASE_DATE, TIMING_REFERENCES, getTimingReferencesByCategory, timingReferencePath } from '@/lib/celestial-timing-references'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL), title: 'Ingress, Station, Lunation and Daśā References | Maha Celestial',
  description: 'Thirty-six canonical timing references for planetary ingresses, stations, lunar phases, eclipses, and Vimśottarī chronology, with reproducible methods and explicit limits.',
  alternates: { canonical: TIMING_REFERENCE_PATH },
  openGraph: { type: 'website', title: 'Celestial Timing Reference Library', description: 'Finite, auditable reference pages for celestial timing calculations and declared daśā conventions.', url: `${SITE_URL}${TIMING_REFERENCE_PATH}`, siteName: 'Maha Celestial' },
}

export default function TimingReferenceIndex() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Celestial Timing Reference Library', description: metadata.description,
    url: `${SITE_URL}${TIMING_REFERENCE_PATH}`, dateModified: TIMING_REFERENCE_RELEASE_DATE,
    hasPart: TIMING_REFERENCES.map((entry) => ({ '@type': 'TechArticle', name: entry.title, url: `${SITE_URL}${timingReferencePath(entry)}` })),
  }
  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge/astrology" className="hover:text-white">Astrology traditions</Link><span className="px-2">/</span><span className="text-zinc-400">Timing references</span></nav>
        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">{TIMING_REFERENCES.length} finite reference pages · released {TIMING_REFERENCE_RELEASE_DATE}</p>
          <h1 className="mt-6 max-w-5xl text-4xl font-bold tracking-tight text-white sm:text-6xl">Ingresses, stations, lunations, and daśā—without hidden conventions</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">This library explains how timing events are defined, calculated, bracketed, versioned, and used in reports. It is deliberately finite: one substantial reference per major method or event family, not daily auto-generated horoscope pages.</p>
        </header>
        <section className="mt-10 grid gap-4 md:grid-cols-3"><div className="border border-zinc-800 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-violet-300">Event before meaning</p><p className="mt-3 text-sm leading-6 text-zinc-400">A crossing, speed reversal, phase root, or period boundary is calculated before any tradition rule is considered.</p></div><div className="border border-zinc-800 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-emerald-300">Every crossing retained</p><p className="mt-3 text-sm leading-6 text-zinc-400">Retrograde re-entry and repeated boundary crossings remain chronology, rather than being compressed into one convenient date.</p></div><div className="border border-zinc-800 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-rose-300">No predictive shortcut</p><p className="mt-3 text-sm leading-6 text-zinc-400">Deterministic dates are reproducible conventions, not evidence that a symbolic rule predicts an outcome.</p></div></section>
        {TIMING_REFERENCE_CATEGORIES.map((category) => { const entries = getTimingReferencesByCategory(category); return <section key={category} className="mt-14 border-t border-zinc-800 pt-8"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-2xl font-semibold text-white">{category}</h2><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">{entries.length} references</p></div><div className="mt-6 grid gap-4 md:grid-cols-2">{entries.map((entry) => <Link key={entry.slug} href={timingReferencePath(entry)} className="group border border-zinc-800 p-5 hover:border-violet-600/60"><div className="flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-widest"><span className="text-emerald-400">{entry.implementationStatus.replaceAll('-', ' ')}</span><span className="text-zinc-700 group-hover:text-violet-400">Open →</span></div><h3 className="mt-3 text-lg font-semibold text-white">{entry.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{entry.description}</p></Link>)}</div></section> })}
        <section className="mt-14 flex flex-wrap gap-4 border-t border-zinc-800 pt-10 font-mono text-[10px] uppercase tracking-widest"><Link href="/knowledge/astrology/calculations" className="border border-zinc-700 px-4 py-3 hover:border-cyan-400 hover:text-cyan-300">Calculation contracts</Link><Link href="/knowledge/birth" className="border border-violet-700 px-4 py-3 text-violet-200 hover:bg-violet-300 hover:text-black">Calculate a timing report</Link></section>
      </div>
    </main>
  )
}
