import Link from 'next/link'
import BookManuscript from '@/components/BookManuscript'
import type { OpenBookEdition, OpenBookSection } from '@/lib/open-book-editions'

type BookReadingEdition = {
  slug: string
  title: string
  subtitle: string
  sections: Array<Pick<OpenBookSection, 'slug' | 'title'>>
}

export function OpenBookReadingIndex({ book }: { book: BookReadingEdition }) {
  const firstSection = book.sections[0]

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <article className="max-w-3xl mx-auto px-6 py-20 sm:py-28">
        <Link href={`/books/${book.slug}`} className="inline-block font-mono text-xs text-indigo-300 hover:text-white tracking-widest uppercase transition-colors mb-12">← {book.title}</Link>
        <header className="border-b border-zinc-800 pb-10 mb-12">
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-5">[ Open edition · chapter reader ]</p>
          <h1 className="text-4xl sm:text-5xl font-light text-white leading-[1.1] tracking-tight mb-5">{book.title}</h1>
          <p className="text-xl text-zinc-300 font-light leading-relaxed">{book.subtitle}</p>
          <p className="mt-7 font-mono text-xs text-zinc-500 tracking-widest uppercase">Mayone Maha Rajan · Read one chapter at a time</p>
        </header>
        <section className="mb-12 border border-indigo-900/50 bg-indigo-950/20 p-6 sm:p-7">
          <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Start here ]</p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">Choose a chapter below, or begin at the beginning. Each chapter has its own stable URL and links to the next section.</p>
          <Link href={`/books/${book.slug}/read/${firstSection.slug}`} className="mt-5 inline-block bg-white px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-zinc-200">
            Start reading: {firstSection.title} ↗
          </Link>
        </section>
        <BookSectionNav book={book} />
      </article>
    </main>
  )
}

export function OpenBookSectionReader({ book, section, markdown }: { book: OpenBookEdition; section: OpenBookSection; markdown: string }) {
  return <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white"><article className="max-w-3xl mx-auto px-6 py-20 sm:py-28"><Link href={`/books/${book.slug}/read`} className="inline-block font-mono text-xs text-indigo-300 hover:text-white tracking-widest uppercase transition-colors mb-12">← All chapters</Link><header className="border-b border-zinc-800 pb-10 mb-12"><p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-5">[ Open edition ]</p><h1 className="text-4xl sm:text-5xl font-light text-white leading-[1.1] tracking-tight mb-5">{section.title}</h1><p className="text-lg text-zinc-400 font-light leading-relaxed">A section of {book.title} by Mayone Maha Rajan.</p></header><BookManuscript markdown={markdown} skipFirstH1 demoteH1 /><OpenBookSectionNavigation book={book} section={section} /><footer className="mt-16 border-t border-zinc-800 pt-8"><Link href={`/books/${book.slug}`} className="text-sm text-zinc-300 hover:text-white">Return to the book’s table of contents ↗</Link></footer></article></main>
}

export function OpenBookSectionNavigation({ book, section }: { book: BookReadingEdition; section: Pick<OpenBookSection, 'slug' | 'title'> }) {
  const index = book.sections.findIndex((candidate) => candidate.slug === section.slug)
  const previous = index > 0 ? book.sections[index - 1] : null
  const next = index < book.sections.length - 1 ? book.sections[index + 1] : null

  return (
    <nav aria-label="Chapter navigation" className="mt-16 grid gap-4 border-y border-zinc-800 py-6 sm:grid-cols-2">
      {previous ? <Link href={`/books/${book.slug}/read/${previous.slug}`} className="text-sm text-zinc-400 hover:text-white">← Previous: {previous.title}</Link> : <span />}
      {next ? <Link href={`/books/${book.slug}/read/${next.slug}`} className="text-sm text-zinc-300 hover:text-white sm:text-right">Next: {next.title} →</Link> : <span className="text-sm text-zinc-500 sm:text-right">End of the edition</span>}
    </nav>
  )
}

function BookSectionNav({ book }: { book: BookReadingEdition }) {
  return <nav aria-label={`${book.title} sections`} className="mb-16 border border-zinc-800 p-6 sm:p-7"><p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-4">[ Read by section ]</p><ol className="grid gap-2 text-sm sm:grid-cols-2">{book.sections.map((section) => <li key={section.slug}><Link href={`/books/${book.slug}/read/${section.slug}`} className="text-zinc-300 hover:text-white">{section.title} ↗</Link></li>)}</ol></nav>
}
