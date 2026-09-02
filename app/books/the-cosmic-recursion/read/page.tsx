import type { Metadata } from 'next'
import { OpenBookReadingIndex } from '@/components/OpenBookReader'
import { openBookEditions } from '@/lib/open-book-editions'

const book = openBookEditions['the-cosmic-recursion']

export const metadata: Metadata = {
  title: `Read ${book.title} | Maha Strategies`,
  description: `Read ${book.title} by Mayone Maha Rajan, one section at a time.`,
  alternates: { canonical: `/books/${book.slug}/read` },
  openGraph: {
    type: 'book',
    url: `https://www.mahastrategies.com/books/${book.slug}/read`,
    title: `Read ${book.title}`,
    description: `A section-by-section open web edition of ${book.title}.`,
  },
}

export default function Page() {
  return <OpenBookReadingIndex book={book} />
}
