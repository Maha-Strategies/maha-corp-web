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
    <main className="evidence-page">
      <article className="evidence-container evidence-container--narrow">
        <Link href={`/books/${book.slug}`} className="inline-block font-mono text-xs text-[var(--status-sourced)] hover:text-[var(--text-primary)] tracking-widest uppercase transition-colors mb-12">← {book.title}</Link>
        <header className="border-b border-[var(--border-default)] pb-10 mb-12">
          <p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-5">[ Open edition · chapter reader ]</p>
          <h1 className="text-4xl sm:text-5xl font-light text-[var(--text-primary)] leading-[1.1] tracking-tight mb-5">{book.title}</h1>
          <p className="text-xl text-[var(--text-secondary)] font-light leading-relaxed">{book.subtitle}</p>
          <p className="mt-7 font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase">Mayone Maha Rajan · Read one chapter at a time</p>
        </header>
        <section className="mb-12 border border-indigo-900/50 bg-indigo-950/20 p-6 sm:p-7">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Start here ]</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">Choose a chapter below, or begin at the beginning. Each chapter has its own stable URL and links to the next section.</p>
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
  return <main className="evidence-page"><article className="evidence-container evidence-container--narrow"><Link href={`/books/${book.slug}/read`} className="inline-block font-mono text-xs text-[var(--status-sourced)] hover:text-[var(--text-primary)] tracking-widest uppercase transition-colors mb-12">← All chapters</Link><header className="border-b border-[var(--border-default)] pb-10 mb-12"><p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-5">[ Open edition ]</p><h1 className="text-4xl sm:text-5xl font-light text-[var(--text-primary)] leading-[1.1] tracking-tight mb-5">{section.title}</h1><p className="text-lg text-[var(--text-secondary)] font-light leading-relaxed">A section of {book.title} by Mayone Maha Rajan.</p></header><BookManuscript markdown={markdown} skipFirstH1 demoteH1 /><OpenBookSectionNavigation book={book} section={section} /><footer className="mt-16 border-t border-[var(--border-default)] pt-8"><Link href={`/books/${book.slug}`} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Return to the book’s table of contents ↗</Link></footer></article></main>
}

export function OpenBookSectionNavigation({ book, section }: { book: BookReadingEdition; section: Pick<OpenBookSection, 'slug' | 'title'> }) {
  const index = book.sections.findIndex((candidate) => candidate.slug === section.slug)
  const previous = index > 0 ? book.sections[index - 1] : null
  const next = index < book.sections.length - 1 ? book.sections[index + 1] : null

  return (
    <nav aria-label="Chapter navigation" className="mt-16 grid gap-4 border-y border-[var(--border-default)] py-6 sm:grid-cols-2">
      {previous ? <Link href={`/books/${book.slug}/read/${previous.slug}`} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Previous: {previous.title}</Link> : <span />}
      {next ? <Link href={`/books/${book.slug}/read/${next.slug}`} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] sm:text-right">Next: {next.title} →</Link> : <span className="text-sm text-[var(--text-muted)] sm:text-right">End of the edition</span>}
    </nav>
  )
}

function BookSectionNav({ book }: { book: BookReadingEdition }) {
  return <nav aria-label={`${book.title} sections`} className="mb-16 border border-[var(--border-default)] p-6 sm:p-7"><p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-4">[ Read by section ]</p><ol className="grid gap-2 text-sm sm:grid-cols-2">{book.sections.map((section) => <li key={section.slug}><Link href={`/books/${book.slug}/read/${section.slug}`} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{section.title} ↗</Link></li>)}</ol></nav>
}
