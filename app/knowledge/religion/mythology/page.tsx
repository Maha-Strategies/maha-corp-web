import type { Metadata } from 'next'
import Link from 'next/link'
import { MYTHOLOGY_PATH, mythologyTraditions } from '@/lib/mythology-navigation'

export const metadata: Metadata = { title: 'Mythology | Maha Strategies', description: 'Source-bounded mythology organized by tradition, subject, textual identity, reception, and comparison.', alternates: { canonical: MYTHOLOGY_PATH } }

export default function MythologyHubPage() {
  const traditions = mythologyTraditions()
  const total = traditions.reduce((sum, tradition) => sum + tradition.pageCount, 0)
  return <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 sm:px-12"><div className="mx-auto max-w-6xl">
    <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge">Knowledge</Link><span className="px-2">/</span><Link href="/knowledge/religion">Religion</Link><span className="px-2">/</span><span>Mythology</span></nav>
    <header className="mt-10 border-b border-zinc-800 pb-10"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-300">Source-bounded mythology · {traditions.length} traditions · {total} articles</p><h1 className="mt-6 max-w-5xl text-4xl font-bold tracking-tight text-white sm:text-6xl">Compare myths without collapsing distinct texts, traditions, or periods.</h1><p className="mt-6 max-w-3xl font-serif text-lg leading-8">Each subject separates source identity, cult or epithet evidence, and later reception. Similar names, motifs, or functions are treated as comparisons—not automatic identities.</p></header>
    <div className="mt-10 grid gap-5 md:grid-cols-2">{traditions.map((tradition) => <Link key={tradition.tradition} href={tradition.path} className="group border border-zinc-800 p-6 hover:border-teal-600/60"><p className="font-mono text-[9px] uppercase tracking-widest text-teal-300">{tradition.subjects.length} subjects · {tradition.pageCount} articles</p><h2 className="mt-3 text-2xl font-semibold text-white group-hover:text-teal-200">{tradition.label}</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Inspect source identity, bounded relationships, and reception within this tradition.</p></Link>)}</div>
  </div></main>
}
