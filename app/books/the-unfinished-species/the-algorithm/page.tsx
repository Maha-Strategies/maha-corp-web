import type { Metadata } from 'next'
import MarkdownChapter from '@/components/MarkdownChapter'

const URL = 'https://www.mahastrategies.com/books/the-unfinished-species/the-algorithm'

export const metadata: Metadata = {
  title: 'The Algorithm | The Unfinished Species',
  description: 'Chapter 1 of The Unfinished Species: natural selection, the era of randomness, and the machine that wrote us.',
  alternates: { canonical: '/books/the-unfinished-species/the-algorithm' },
  openGraph: { type: 'article', url: URL, title: 'The Algorithm', description: 'Chapter 1 of The Unfinished Species: natural selection, the era of randomness, and the machine that wrote us.', images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The Algorithm' }] },
}

export default function AlgorithmPage() {
  return <MarkdownChapter bookId="https://www.mahastrategies.com/books/the-unfinished-species#book" bookTitle="The Unfinished Species" bookHref="/books/the-unfinished-species" chapterTitle="The Algorithm" chapterDescription="Natural selection, the era of randomness, and the machine that wrote us." chapterUrl={URL} sourcePath="books/the-unfinished-species/chapter-1.md" />
}
