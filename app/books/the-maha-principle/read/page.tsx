import type { Metadata } from 'next'

import { OpenBookReadingIndex } from '@/components/OpenBookReader'
import { openBookEditions } from '@/lib/open-book-editions'

const book = openBookEditions['the-maha-principle']

export const metadata: Metadata = {
  title: `Read ${book.title} | Maha Strategies`,
  description: `Read the complete free web edition of ${book.title} by Mayone Maha Rajan, one section at a time.`,
  alternates: { canonical: `/books/${book.slug}/read` },
  openGraph: {
    type: 'book',
    url: `https://www.mahastrategies.com/books/${book.slug}/read`,
    title: `Read ${book.title}`,
    description: `${book.subtitle}. A complete section-by-section web edition.`,
    images: [{ url: '/books/the-maha-principle/cover.jpg', width: 1632, height: 2624, alt: book.title }],
  },
}

export default function TheMahaPrincipleReadingIndex() {
  return <OpenBookReadingIndex book={book} />
}
