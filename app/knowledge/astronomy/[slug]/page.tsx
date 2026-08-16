import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SITE_URL } from '@/lib/briefs-data'
import { CELESTIAL_FACT_PATH, CELESTIAL_FACT_SCHEMA_PATH } from '@/lib/celestial-facts'
import { CLAIM_PROVENANCE_META } from '@/lib/claim-evidence'
import {
  ASTRONOMY_ARTICLES,
  ASTRONOMY_KIND_META,
  ASTRONOMY_KNOWLEDGE_PATH,
  ASTRONOMY_SOURCES,
  ASTRONOMY_TRACK_META,
  astronomyArticlePath,
  getAstronomyArticle,
  getAstronomyArticleBySlug,
  type AstronomyEvidenceState,
} from '@/lib/astronomy-knowledge'

type PageProps = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return ASTRONOMY_ARTICLES.map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const article = getAstronomyArticleBySlug((await params).slug)
  if (!article) return {}
  const path = astronomyArticlePath(article)
  return {
    metadataBase: new URL(SITE_URL), title: `${article.title} | Maha Astronomy Knowledge`, description: article.description,
    alternates: { canonical: path },
    openGraph: { type: 'article', title: article.title, description: article.description, url: `${SITE_URL}${path}`, siteName: 'Maha Strategies', publishedTime: article.datePublished, modifiedTime: article.dateModified, images: [{ url: '/og-astronomy.png', width: 1731, height: 909, alt: 'Astronomy Knowledge — Observation to model to boundary' }] },
    twitter: { card: 'summary_large_image', title: article.title, description: article.description, images: ['/og-astronomy.png'] },
  }
}

const evidenceMeta: Record<AstronomyEvidenceState, { label: string; className: string }> = {
  'direct-observation': { label: 'Direct observation', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  'calibrated-measurement': { label: 'Calibrated measurement', className: 'border-sky-500/30 bg-sky-500/10 text-sky-300' },
  'method-basis': { label: 'Method basis', className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' },
  'model-dependent': { label: 'Model-dependent', className: 'border-violet-500/30 bg-violet-500/10 text-violet-300' },
  'consensus-summary': { label: 'Consensus summary', className: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' },
  'open-question': { label: 'Open question', className: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
}

function EvidenceList({ title, items, tone = 'sky' }: { title: string; items: string[]; tone?: 'sky' | 'violet' | 'amber' | 'zinc' }) {
  const color = { sky: 'text-sky-300', violet: 'text-violet-300', amber: 'text-amber-300', zinc: 'text-zinc-400' }[tone]
  return <section className="border-t border-zinc-800 pt-5"><h2 className={`font-mono text-[10px] uppercase tracking-widest ${color}`}>{title}</h2><ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">{items.map((item) => <li key={item} className="border-l border-zinc-700 pl-3">{item}</li>)}</ul></section>
}

export default async function AstronomyArticlePage({ params }: PageProps) {
  const article = getAstronomyArticleBySlug((await params).slug)
  if (!article) notFound()
  const path = astronomyArticlePath(article)
  const sources = article.sourceIds.map((id) => ASTRONOMY_SOURCES.find((source) => source.id === id)).filter((source) => source !== undefined)
  const sourceNumbers = new Map(sources.map((source, index) => [source.id, index + 1]))
  const claims = new Map(article.claims.map((claim) => [claim.id, claim]))
  const related = article.relatedArticleIds.map(getAstronomyArticle).filter((item) => item !== undefined)
  const jsonLd = { '@context': 'https://schema.org', '@type': 'TechArticle', headline: article.title, description: article.description, datePublished: article.datePublished, dateModified: article.dateModified, mainEntityOfPage: `${SITE_URL}${path}`, isPartOf: `${SITE_URL}${ASTRONOMY_KNOWLEDGE_PATH}`, isBasedOn: `${SITE_URL}${CELESTIAL_FACT_PATH}`, citation: sources.map((source) => source.url), about: [ASTRONOMY_TRACK_META[article.track].label, ASTRONOMY_KIND_META[article.kind].label] }

  return (
    <main className="min-h-screen bg-[#07090e] px-6 py-16 text-zinc-300 selection:bg-sky-300 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span><Link href={ASTRONOMY_KNOWLEDGE_PATH} className="hover:text-white">Astronomy</Link><span className="px-2">/</span><span className="text-zinc-400">{article.shortTitle}</span></nav>
        <header className="mt-10 border-b border-zinc-800 pb-10">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-widest"><span className="border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-sky-300">{ASTRONOMY_KIND_META[article.kind].label}</span><span className="text-zinc-600">{ASTRONOMY_TRACK_META[article.track].label}</span><span className="text-zinc-700">Updated {article.dateModified}</span></div>
          <h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{article.title}</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-400">{article.description}</p>
        </header>

        <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_330px]">
          <article>
            <section className="border-l-2 border-sky-500 bg-sky-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-sky-300">Working definition</p><p className="mt-3 font-serif text-lg leading-8 text-zinc-200">{article.definition}</p></section>

            <section className="mt-12 grid gap-6 md:grid-cols-2"><div className="border border-emerald-900/50 bg-emerald-950/10 p-6"><EvidenceList title="What is measured" items={article.measured} /></div><div className="border border-violet-900/50 bg-violet-950/10 p-6"><EvidenceList title="What is inferred" items={article.inferred} tone="violet" /></div></section>

            <section className="mt-12 border border-sky-900/50 bg-sky-950/10 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-sky-300">Fact-layer dependency</p><h2 className="mt-3 text-2xl font-semibold text-white">The explanatory layer cannot rewrite these fields.</h2></div><Link href={CELESTIAL_FACT_SCHEMA_PATH} className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-sky-300">Fact schema →</Link></div>
              <div className="mt-6 flex flex-wrap gap-2">{article.factDependencies.map((field) => <code key={field} className="border border-zinc-800 bg-black/30 px-3 py-2 text-[11px] text-zinc-400">{field}</code>)}</div>
            </section>

            <div className="mt-12 space-y-12 font-serif text-lg leading-8">{article.sections.map((section) => <section key={section.heading}><h2 className="font-sans text-2xl font-semibold text-white">{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-5 text-zinc-400">{paragraph}</p>)}<div className="mt-6 space-y-3">{section.claimIds.map((claimId) => { const claim = claims.get(claimId); if (!claim) return null; const meta = evidenceMeta[claim.evidenceState]; return <div key={claim.id} className="border border-zinc-800 bg-zinc-950/70 p-5 font-sans text-sm leading-6"><div className="flex flex-wrap items-center gap-2"><span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${meta.className}`}>{meta.label}</span><span title={CLAIM_PROVENANCE_META[claim.provenance].description} className="border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-400">{CLAIM_PROVENANCE_META[claim.provenance].label}</span>{claim.sourceIds.map((sourceId) => sourceNumbers.get(sourceId)).filter(Boolean).map((number) => <a key={number} href={`#source-${number}`} className="font-mono text-[10px] text-sky-300 hover:text-white">[{number}]</a>)}</div><p className="mt-3 text-zinc-300">{claim.statement}</p><p className="mt-3 border-l border-amber-600/50 pl-3 text-xs text-zinc-500"><span className="text-amber-400">Boundary:</span> {claim.boundary}</p></div>})}</div></section>)}</div>

            <section className="mt-14 border-t border-zinc-800 pt-8"><h2 className="text-2xl font-semibold text-white">Sources</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Each source states both what it establishes and where its authority ends. Access dates record the last public verification.</p><ol className="mt-6 space-y-5">{sources.map((source, index) => <li key={source.id} id={`source-${index + 1}`} className="scroll-mt-24 border-l border-zinc-700 pl-4 text-sm leading-6 text-zinc-400"><span className="mr-2 font-mono text-xs text-sky-300">[{index + 1}]</span><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white">{source.title}</a><span className="text-zinc-600"> · {source.publisher} · accessed {source.accessed}</span><p className="mt-2 text-xs text-zinc-500"><span className="text-zinc-300">Establishes:</span> {source.establishes}</p><p className="mt-2 text-xs text-amber-200/70"><span className="text-amber-300">Boundary:</span> {source.boundary}</p></li>)}</ol></section>
          </article>

          <aside className="space-y-8"><div className="border border-zinc-800 bg-zinc-950/60 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Inference controls</p><div className="mt-5"><EvidenceList title="Assumptions" items={article.assumptions} tone="violet" /></div><div className="mt-7"><EvidenceList title="Limitations" items={article.limitations} tone="amber" /></div></div><div className="border border-amber-900/50 bg-amber-950/10 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Layer boundary</p><p className="mt-3 text-sm leading-6 text-zinc-400">This article explains scientific observations and models. It supplies no symbolic, divinatory, personality, or predictive interpretation.</p></div></aside>
        </div>

        <section className="mt-16 border-t border-zinc-800 pt-10"><h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500">Continue through the Astronomy graph</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{related.map((item) => <Link key={item.id} href={astronomyArticlePath(item)} className="border border-zinc-800 p-5 hover:border-sky-500/50"><p className="font-mono text-[9px] uppercase tracking-widest text-sky-300">{ASTRONOMY_TRACK_META[item.track].label}</p><p className="mt-3 text-sm font-semibold text-white">{item.shortTitle}</p></Link>)}</div></section>
      </div>
    </main>
  )
}
