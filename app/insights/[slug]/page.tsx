import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MAHA_ORGANIZATION_ID, MAHA_SITE_URL, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'
import { getPublicContentPublication } from '@/lib/public-content-publications'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const publication = await getPublicContentPublication(slug)
  if (!publication) return {}
  const url = `${MAHA_SITE_URL}/insights/${publication.slug}`
  return { title: publication.title, description: publication.summary, alternates: { canonical: `/insights/${publication.slug}` }, openGraph: { type: 'article', url, title: publication.title, description: publication.summary, publishedTime: publication.published_at }, twitter: { card: 'summary_large_image', title: publication.title, description: publication.summary } }
}

export default async function PublishedInsightPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const publication = await getPublicContentPublication(slug)
  if (!publication) notFound()
  const url = `${MAHA_SITE_URL}/insights/${publication.slug}`
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Article', '@id': `${url}#article`, headline: publication.title, description: publication.summary, mainEntityOfPage: url, datePublished: publication.published_at, dateModified: publication.published_at, author: { '@id': MAYONE_MAHA_RAJAN_ID }, publisher: { '@id': MAHA_ORGANIZATION_ID }, citation: publication.evidence.map((source) => source.url) }
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} /><article className="mx-auto max-w-4xl"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Evidence-led insight ]</p><h1 className="mt-5 text-4xl font-light leading-tight tracking-tight text-white sm:text-6xl">{publication.title}</h1><p className="mt-7 max-w-3xl text-xl leading-relaxed text-zinc-300">{publication.summary}</p><p className="mt-5 font-mono text-[11px] uppercase tracking-widest text-zinc-500">By {publication.editorial_reviewer} · Maha Strategies LLC · <time dateTime={publication.published_at}>{new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(publication.published_at))}</time></p><section className="mt-14 border-y border-zinc-800 py-9"><h2 className="text-2xl text-white">Direct answer</h2><p className="mt-5 whitespace-pre-wrap leading-relaxed text-zinc-400">{publication.direct_answer}</p></section><section className="mt-14"><h2 className="text-2xl text-white">Maha method</h2><p className="mt-5 whitespace-pre-wrap leading-relaxed text-zinc-400">{publication.method}</p></section><section className="mt-14 border border-cyan-900/50 bg-cyan-950/10 p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Evidence artifact ]</p><a href={publication.artifact_url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-lg text-cyan-100 underline">{publication.artifact_label}</a><p className="mt-3 text-sm text-zinc-400">This artifact supports an editorial workflow; it does not independently establish factual truth.</p></section><section className="mt-14 border border-amber-900/50 bg-amber-950/10 p-7"><h2 className="text-2xl text-white">Limits</h2><p className="mt-5 whitespace-pre-wrap leading-relaxed text-zinc-400">{publication.limitations}</p></section><section className="mt-14"><h2 className="text-2xl text-white">Sources</h2><ol className="mt-5 space-y-4">{publication.evidence.map((source) => <li key={source.url} className="border-l border-zinc-700 pl-4"><a href={source.url} target="_blank" rel="noreferrer" className="text-cyan-100 underline">{source.title}</a>{source.note && <p className="mt-1 text-sm leading-relaxed text-zinc-500">{source.note}</p>}</li>)}</ol></section><section className="mt-14 border-t border-zinc-800 pt-8"><p className="text-sm text-zinc-500">Need a source-tagged analysis for a decision? <Link href="/consulting" className="text-cyan-100 underline">Explore consulting</Link>.</p></section></article></main>
}
