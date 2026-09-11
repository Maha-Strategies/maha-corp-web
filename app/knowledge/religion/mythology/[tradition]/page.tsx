import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MYTHOLOGY_PATH, mythologyTradition, mythologyTraditions } from '@/lib/mythology-navigation'

type Props = { params: Promise<{ tradition: string }> }
export const dynamicParams = false
export const generateStaticParams = () => mythologyTraditions().map(({ tradition }) => ({ tradition }))
export async function generateMetadata({ params }: Props): Promise<Metadata> { const entry = mythologyTradition((await params).tradition); return entry ? { title: `${entry.label} Mythology | Maha Strategies`, description: `${entry.pageCount} source-bounded articles across ${entry.subjects.length} ${entry.label} mythology subjects.`, alternates: { canonical: entry.path } } : {} }

export default async function MythologyTraditionPage({ params }: Props) {
  const entry = mythologyTradition((await params).tradition)
  if (!entry) notFound()
  return <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 sm:px-12"><div className="mx-auto max-w-6xl">
    <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge">Knowledge</Link><span className="px-2">/</span><Link href="/knowledge/religion">Religion</Link><span className="px-2">/</span><Link href={MYTHOLOGY_PATH}>Mythology</Link><span className="px-2">/</span><span>{entry.label}</span></nav>
    <header className="mt-10 border-b border-zinc-800 pb-10"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-300">Tradition hub · {entry.subjects.length} subjects · {entry.pageCount} articles</p><h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">{entry.label} mythology</h1><p className="mt-6 max-w-3xl font-serif text-lg leading-8">Read each subject through its distinct evidence lenses. Article links preserve the released canonical URLs and make the complete subject set visible together.</p></header>
    <div className="mt-10 grid gap-5 md:grid-cols-2">{entry.subjects.map((subject) => <section key={subject.topic} className="border border-zinc-800 p-6"><h2 className="text-xl font-semibold text-white">{subject.label}</h2><ul className="mt-5 space-y-3">{subject.pages.map((page) => <li key={page.path}><Link href={page.path} className="text-sm text-teal-300 hover:text-white">{page.title} →</Link></li>)}</ul></section>)}</div>
  </div></main>
}
