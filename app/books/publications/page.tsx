import type { Metadata } from 'next'
import Link from 'next/link'
import BookPublicationDetails from '@/components/BookPublicationDetails'
import { BOOK_PUBLICATIONS, BOOK_PUBLICATIONS_PATH, BOOK_PUBLICATIONS_JSON_PATH, bookPublicationJsonLd } from '@/lib/book-publications'
import { MAHA_SITE_URL } from '@/lib/entity'

export const metadata: Metadata = {
  title: 'Published Books | Maha Strategies',
  description: 'The Maha Principle, The Orbital Mind, and The Imagined Life by Mayone Maha Rajan: descriptions, ebook and paperback editions, ISBNs, retailer links, and publication status.',
  alternates: { canonical: BOOK_PUBLICATIONS_PATH },
}

export default function BookPublicationsPage() {
  const graph = { '@context': 'https://schema.org', '@graph': BOOK_PUBLICATIONS.flatMap((book) => bookPublicationJsonLd(book)['@graph']) }
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, '\\u003c') }} />
      <article className="evidence-container evidence-container--narrow">
        <header>
          <p className="evidence-kicker">[ Maha Strategies // Publishing ]</p>
          <h1 className="evidence-title evidence-title--product mt-5">Published books</h1>
          <p className="evidence-lede mt-7">Three books by Mayone Maha Rajan on human flourishing, the systems of a living self, and the possibilities of a dreaming brain.</p>
          <p className="evidence-copy mt-5">Find the ebook and paperback editions below, alongside companion research and reader resources. Status comes from the publishers; retailer delivery and regional availability can differ.</p>
        </header>
        <nav aria-label="Books" className="mt-8 flex flex-col gap-3">
          {BOOK_PUBLICATIONS.map((book) => <a key={book.slug} href={`#${book.slug}`} className="evidence-link">{book.title} ↓</a>)}
        </nav>
        {BOOK_PUBLICATIONS.map((book) => <BookPublicationDetails key={book.slug} book={book} />)}
        <p className="evidence-copy mt-10">Retail manuscripts remain all rights reserved. Separately licensed working papers and public web editions have their own terms.</p>
        <div className="mt-8 flex flex-col gap-4">
          <Link href="/books" className="evidence-link">Browse books and open editions ↗</Link>
          <a href={`${MAHA_SITE_URL}${BOOK_PUBLICATIONS_JSON_PATH}`} className="evidence-link">Publication catalog (JSON) ↗</a>
        </div>
      </article>
    </main>
  )
}
