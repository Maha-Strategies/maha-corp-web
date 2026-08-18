import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import {
  CORPORATE_MUNDANE_KINDS,
  CORPORATE_MUNDANE_PATH,
  CORPORATE_MUNDANE_REFERENCES,
  CORPORATE_MUNDANE_RELEASE_DATE,
  corporateMundaneReferencePath,
  getCorporateMundaneReferencesByKind,
} from '@/lib/corporate-mundane-references'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Corporate and Mundane Astrology Methodology | Maha Celestial',
  description: 'Thirty auditable corporate-event methodologies and sanitized demonstrations for formation, transactions, launches, mergers, uncertainty, evidence, and prospective evaluation.',
  alternates: { canonical: CORPORATE_MUNDANE_PATH },
  openGraph: {
    type: 'website', title: 'Corporate and Mundane Astrology Methodology',
    description: 'Evidence-bound organization-event methods and sanitized system demonstrations with explicit predictive limits.',
    url: `${SITE_URL}${CORPORATE_MUNDANE_PATH}`, siteName: 'Maha Celestial',
  },
}

const kindLabels = {
  methodology: 'Methodology',
  'sanitized-case-study': 'Sanitized case studies',
} as const

export default function CorporateMundaneIndex() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'Corporate and Mundane Astrology Methodology', description: metadata.description,
    url: `${SITE_URL}${CORPORATE_MUNDANE_PATH}`, dateModified: CORPORATE_MUNDANE_RELEASE_DATE,
    hasPart: CORPORATE_MUNDANE_REFERENCES.map((entry) => ({
      '@type': 'TechArticle', name: entry.title, url: `${SITE_URL}${corporateMundaneReferencePath(entry)}`,
    })),
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge/astrology" className="hover:text-white">Astrology traditions</Link><span className="px-2">/</span><span className="text-zinc-400">Corporate and mundane</span></nav>
        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{CORPORATE_MUNDANE_REFERENCES.length} finite pages · released {CORPORATE_MUNDANE_RELEASE_DATE}</p>
          <h1 className="mt-6 max-w-5xl text-4xl font-bold tracking-tight text-white sm:text-6xl">Corporate charts begin with evidence, not a convenient date</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">This library defines how organization events are selected, timed, located, calculated, reviewed, and tested. The case studies are sanitized system demonstrations—not client outcomes and not evidence that astrology predicts business results.</p>
        </header>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="border border-zinc-800 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">Event-specific</p><p className="mt-3 text-sm leading-6 text-zinc-400">Formation, payment, deployment, launch, merger, and acquisition records remain distinct instead of becoming one universal company birth.</p></div>
          <div className="border border-zinc-800 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-emerald-300">Evidence-bound</p><p className="mt-3 text-sm leading-6 text-zinc-400">Every timestamp, location basis, confidence class, evidence locator, and calculation convention remains inspectable.</p></div>
          <div className="border border-zinc-800 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-rose-300">No outcome guarantee</p><p className="mt-3 text-sm leading-6 text-zinc-400">No page infers valuation, investment return, legal status, revenue, survival, adoption, or a guaranteed future event.</p></div>
        </section>

        {CORPORATE_MUNDANE_KINDS.map((kind) => {
          const entries = getCorporateMundaneReferencesByKind(kind)
          return (
            <section key={kind} className="mt-14 border-t border-zinc-800 pt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-2xl font-semibold text-white">{kindLabels[kind]}</h2><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">{entries.length} pages</p></div>
              {kind === 'sanitized-case-study' && <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-200/70">These are synthetic, de-identified demonstrations of system behavior. They are not presented as real client engagements or successful forecasts.</p>}
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {entries.map((entry) => <Link key={entry.slug} href={corporateMundaneReferencePath(entry)} className="group border border-zinc-800 p-5 hover:border-cyan-600/60"><div className="flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-widest"><span className={kind === 'methodology' ? 'text-cyan-300' : 'text-amber-300'}>{kind === 'methodology' ? 'Declared method' : 'Sanitized demonstration'}</span><span className="text-zinc-700 group-hover:text-cyan-400">Open →</span></div><h3 className="mt-3 text-lg font-semibold text-white">{entry.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{entry.description}</p></Link>)}
              </div>
            </section>
          )
        })}

        <section className="mt-14 flex flex-wrap gap-4 border-t border-zinc-800 pt-10 font-mono text-[10px] uppercase tracking-widest"><Link href="/knowledge/corporate" className="border border-cyan-700 px-4 py-3 text-cyan-200 hover:bg-cyan-300 hover:text-black">Calculate a corporate report</Link><Link href="/knowledge/astrology/timing" className="border border-zinc-700 px-4 py-3 hover:border-violet-400 hover:text-violet-300">Timing references</Link></section>
      </div>
    </main>
  )
}
