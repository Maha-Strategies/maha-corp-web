import type { Metadata } from 'next'
import { CompleteOpenBookReader } from '@/components/OpenBookReader'
import { openBookEditions, readOpenBookManuscript } from '@/lib/open-book-editions'

const book = openBookEditions['the-synthetic-self']
export const metadata: Metadata = { title: `Read ${book.title} | Maha Strategies`, description: `The complete open web edition of ${book.title} by Mayone Maha Rajan.`, alternates: { canonical: `/books/${book.slug}/read` }, openGraph: { type: 'book', url: `https://www.mahastrategies.com/books/${book.slug}/read`, title: `Read ${book.title}`, description: `The complete open web edition of ${book.title}.` } }
export default function Page() { return <CompleteOpenBookReader book={book} markdown={readOpenBookManuscript(book)} /> }
