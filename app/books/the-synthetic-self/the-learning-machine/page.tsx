import type { Metadata } from 'next'
import MarkdownChapter from '@/components/MarkdownChapter'

const URL = 'https://www.mahastrategies.com/books/the-synthetic-self/the-learning-machine'

export const metadata: Metadata = {
  title: 'The Learning Machine | The Synthetic Self',
  description: 'Chapter 1 of The Synthetic Self: how language models learn, and why the mirror is not merely a metaphor.',
  alternates: { canonical: '/books/the-synthetic-self/the-learning-machine' },
  openGraph: { type: 'article', url: URL, title: 'The Learning Machine', description: 'Chapter 1 of The Synthetic Self: how language models learn, and why the mirror is not merely a metaphor.', images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The Learning Machine' }] },
}

export default function LearningMachinePage() {
  return <MarkdownChapter bookId="https://www.mahastrategies.com/books/the-synthetic-self#book" bookTitle="The Synthetic Self" bookHref="/books/the-synthetic-self" chapterTitle="The Learning Machine" chapterDescription="How language models learn, and why the mirror is not merely a metaphor." chapterUrl={URL} sourcePath="books/the-synthetic-self/chapter-1.md" />
}
