import Link from 'next/link'
import BookManuscript from '@/components/BookManuscript'
import type { OpenBookEdition, OpenBookSection } from '@/lib/open-book-editions'

export function CompleteOpenBookReader({ book, markdown }: { book: OpenBookEdition; markdown: string }) {
  return <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white"><article className="max-w-3xl mx-auto px-6 py-20 sm:py-28"><Link href={`/books/${book.slug}`} className="inline-block font-mono text-xs text-indigo-300 hover:text-white tracking-widest uppercase transition-colors mb-12">← {book.title}</Link><header className="border-b border-zinc-800 pb-10 mb-12"><p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-5">[ Complete open edition ]</p><h1 className="text-4xl sm:text-5xl font-light text-white leading-[1.1] tracking-tight mb-5">{book.title}</h1><p className="text-xl text-zinc-300 font-light leading-relaxed">{book.subtitle}</p><p className="mt-7 font-mono text-xs text-zinc-500 tracking-widest uppercase">Mayone Maha Rajan · Full text</p></header><BookSectionNav book={book} /><BookManuscript markdown={markdown} skipFirstH1 /></article></main>
}

export function OpenBookSectionReader({ book, section, markdown }: { book: OpenBookEdition; section: OpenBookSection; markdown: string }) {
  return <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white"><article className="max-w-3xl mx-auto px-6 py-20 sm:py-28"><Link href={`/books/${book.slug}/read`} className="inline-block font-mono text-xs text-indigo-300 hover:text-white tracking-widest uppercase transition-colors mb-12">← Complete edition</Link><header className="border-b border-zinc-800 pb-10 mb-12"><p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-5">[ Open edition ]</p><h1 className="text-4xl sm:text-5xl font-light text-white leading-[1.1] tracking-tight mb-5">{section.title}</h1><p className="text-lg text-zinc-400 font-light leading-relaxed">A section of {book.title} by Mayone Maha Rajan.</p></header><BookManuscript markdown={markdown} /><footer className="mt-16 border-t border-zinc-800 pt-8"><Link href={`/books/${book.slug}`} className="text-sm text-zinc-300 hover:text-white">Return to the book’s table of contents ↗</Link></footer></article></main>
}

function BookSectionNav({ book }: { book: OpenBookEdition }) {
  return <nav aria-label={`${book.title} sections`} className="mb-16 border border-zinc-800 p-6 sm:p-7"><p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-4">[ Read by section ]</p><ol className="grid gap-2 text-sm sm:grid-cols-2">{book.sections.map((section) => <li key={section.slug}><Link href={`/books/${book.slug}/read/${section.slug}`} className="text-zinc-300 hover:text-white">{section.title} ↗</Link></li>)}</ol></nav>
}
