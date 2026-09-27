import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ARCHITECTURE_DATE, ARCHITECTURE_PATH, architectureArticles, architectureSources } from '@/lib/computational-architecture'
import ProgramChecker from '../ProgramChecker'
export const dynamicParams = false
export function generateStaticParams() { return architectureArticles.map(({ slug }) => ({ slug })) }
type Props = { params: Promise<{ slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const a = architectureArticles.find(item => item.slug === slug)
  if (!a) notFound()
  return { title: `${a.title} | Maha Strategies`, description: a.answer, alternates: { canonical: `https://www.mahastrategies.com${ARCHITECTURE_PATH}/${a.slug}` } }
}
export default async function ArchitectureArticle({ params }: Props) {
  const { slug } = await params
  const a = architectureArticles.find(item => item.slug === slug)
  if (!a) notFound()
  return <main className="mx-auto max-w-3xl space-y-8 px-6 py-12 leading-relaxed">
    <nav aria-label="Breadcrumb"><Link prefetch={false} className="underline" href="/knowledge">Knowledge</Link> / <Link prefetch={false} className="underline" href={ARCHITECTURE_PATH}>Computational Architecture</Link></nav>
    <header><h1 className="text-3xl font-semibold">{a.title}</h1><p className="mt-4 text-lg">{a.answer}</p></header>
    <nav aria-label="On this page" className="flex flex-wrap gap-4 text-sm underline"><Link prefetch={false} href="#method">Explanation</Link><Link prefetch={false} href="#example">Example</Link><Link prefetch={false} href="#limits">Limits</Link><Link prefetch={false} href="#sources">Sources and review</Link></nav>
    <section id="method"><h2 className="text-2xl font-semibold">How to use this idea</h2><p>{a.mechanism}</p></section>
    <section id="example"><h2 className="text-2xl font-semibold">Worked illustration</h2><p>{a.example}</p><p>All numerical examples here are synthetic, not measured building results.</p></section>
    <section><h2 className="text-2xl font-semibold">Checks before relying on a result</h2><ul className="list-disc space-y-2 pl-6">{a.checks.map(c => <li key={c}>{c}</li>)}</ul></section>
    {slug === 'program-area-checker' && <ProgramChecker />}
    <section id="limits"><h2 className="text-2xl font-semibold">What this does not establish</h2><p>{a.boundary}</p></section>
    <section id="sources"><h2 className="text-2xl font-semibold">Sources and review</h2><p>Automated editorial preparation, not independent expert review. Examples and proposed workflows are Maha-authored.</p>{a.sources.length === 0 ? <p>This page presents an authored protocol or elementary arithmetic, not a sourced engineering finding or professional standard.</p> : a.sources.map(id => { const s = architectureSources[id]; return <div key={id} className="my-4 space-y-2"><Link prefetch={false} className="font-semibold underline" href={s.url}>{s.title}</Link><p>Locator: {s.locator}</p><p>Supports: {s.supports}</p><p>Limit: {s.boundary}</p><details><summary>Inspection and reuse</summary><p>Selected HTML sections inspected {ARCHITECTURE_DATE}. {s.rights}</p></details></div> })}</section>
    <section><h2 className="text-2xl font-semibold">Continue reading</h2><ul className="list-disc pl-6">{a.related.map(slug => <li key={slug}><Link prefetch={false} className="underline" href={`${ARCHITECTURE_PATH}/${slug}`}>{architectureArticles.find(item => item.slug === slug)?.title}</Link></li>)}</ul></section>
  </main>
}
