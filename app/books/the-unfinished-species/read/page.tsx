import type { Metadata } from 'next'
import Link from 'next/link'
import BookManuscript from '@/components/BookManuscript'
import { readUnfinishedSpeciesManuscript, unfinishedSpeciesSections } from '@/lib/unfinished-species'

const SITE_URL = 'https://www.mahastrategies.com'
const URL = `${SITE_URL}/books/the-unfinished-species/read`

export const metadata: Metadata = {
  title: 'Read The Unfinished Species | Maha Strategies',
  description: 'The complete open web edition of The Unfinished Species by Mayone Maha Rajan.',
  alternates: { canonical: '/books/the-unfinished-species/read' },
  openGraph: { type: 'book', url: URL, title: 'Read The Unfinished Species', description: 'The complete open web edition of The Unfinished Species.', images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The Unfinished Species' }] },
}

export default function FullUnfinishedSpeciesReader() {
  const manuscript = readUnfinishedSpeciesManuscript()
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <article className="max-w-3xl mx-auto px-6 py-20 sm:py-28">
        <Link href="/books/the-unfinished-species" className="inline-block font-mono text-xs text-indigo-300 hover:text-white tracking-widest uppercase transition-colors mb-12">← The Unfinished Species</Link>
        <header className="border-b border-zinc-800 pb-10 mb-12">
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-5">[ Complete open edition ]</p>
          <h1 className="text-4xl sm:text-5xl font-light text-white leading-[1.1] tracking-tight mb-5">The Unfinished Species</h1>
          <p className="text-xl text-zinc-300 font-light leading-relaxed">How Intelligence Learned to Redesign Its Own Substrate</p>
          <p className="mt-7 font-mono text-xs text-zinc-500 tracking-widest uppercase">Mayone Maha Rajan · Full text</p>
        </header>
        <nav aria-label="Book chapters" className="mb-16 border border-zinc-800 p-6 sm:p-7">
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-4">[ Read by section ]</p>
          <ol className="grid gap-2 text-sm sm:grid-cols-2">
            {unfinishedSpeciesSections.map((section) => <li key={section.slug}><Link href={`/books/the-unfinished-species/read/${section.slug}`} className="text-zinc-300 hover:text-white">{section.title} ↗</Link></li>)}
          </ol>
        </nav>
        <BookManuscript markdown={manuscript} skipFirstH1 />
      </article>
    </main>
  )
}
