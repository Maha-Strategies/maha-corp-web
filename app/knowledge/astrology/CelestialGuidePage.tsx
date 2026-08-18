import Link from 'next/link'

import type { CelestialGuide } from '@/lib/celestial-guides'
import { CELESTIAL_GUIDE_RELEASE_DATE } from '@/lib/celestial-guides'
import { SITE_URL } from '@/lib/briefs-data'
import { CALCULATION_REFERENCE_PATH } from '@/lib/celestial-calculation-references'

export default function CelestialGuidePage({ guide }: { guide: CelestialGuide }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: guide.title,
    description: guide.description,
    datePublished: CELESTIAL_GUIDE_RELEASE_DATE,
    dateModified: CELESTIAL_GUIDE_RELEASE_DATE,
    mainEntityOfPage: `${SITE_URL}${guide.path}`,
    author: { '@type': 'Organization', name: 'Maha Celestial', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Maha Strategies', url: SITE_URL },
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="mx-auto max-w-4xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge/astrology" className="hover:text-white">Astrology traditions</Link>
          <span className="px-2">/</span>
          <span className="text-zinc-400">{guide.title}</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">{guide.eyebrow}</p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">{guide.title}</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">{guide.summary}</p>
          <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600">Published {CELESTIAL_GUIDE_RELEASE_DATE}</p>
        </header>

        <section className="mt-8 border border-cyan-900/60 bg-cyan-950/10 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Calculation chain</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-200">{guide.calculation}</p>
        </section>

        {guide.sections.map((section) => (
          <section key={section.heading} className="mt-12 border-t border-zinc-800 pt-8">
            <h2 className="text-2xl font-semibold text-white">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 font-serif text-base leading-8 text-zinc-400">{paragraph}</p>)}
            {section.points && (
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {section.points.map((point) => <li key={point} className="border-l border-violet-800/70 pl-3 text-sm leading-6 text-zinc-300">{point}</li>)}
              </ul>
            )}
          </section>
        ))}

        <section className="mt-12 border-l-2 border-rose-500 bg-rose-950/10 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Interpretive boundary</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-200">{guide.interpretationBoundary}</p>
        </section>

        <section className="mt-8 border border-zinc-800 p-6">
          <h2 className="text-xl font-semibold text-white">Use the calculation</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {guide.relatedReports.map((report) => <Link key={report.href} href={report.href} className="border border-violet-500 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-violet-300 hover:bg-violet-400 hover:text-black">{report.label} →</Link>)}
            <Link href={CALCULATION_REFERENCE_PATH} className="border border-cyan-700 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-cyan-300 hover:bg-cyan-300 hover:text-black">Inspect all calculation contracts →</Link>
          </div>
        </section>
      </article>
    </main>
  )
}
