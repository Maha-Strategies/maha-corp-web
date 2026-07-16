import Link from 'next/link'
import type { Metadata } from 'next'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'The blind watchmaker opens his eyes | The Unfinished Species',
  description:
    'Natural selection built a creature capable of prediction. What follows when that creature begins to redesign the pressures that made it?',
  alternates: { canonical: '/books/the-unfinished-species/the-blind-watchmaker-opens-his-eyes' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/books/the-unfinished-species/the-blind-watchmaker-opens-his-eyes`,
    title: 'The blind watchmaker opens his eyes',
    description: 'Natural selection built a creature capable of prediction. What follows when that creature begins to redesign the pressures that made it?',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The blind watchmaker opens his eyes' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The blind watchmaker opens his eyes',
    description: 'Natural selection built a creature capable of prediction. What follows when that creature begins to redesign the pressures that made it?',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The Blind Watchmaker Opens His Eyes',
  description: 'Natural selection built a creature capable of prediction. What follows when that creature begins to redesign the pressures that made it?',
  url: `${SITE_URL}/books/the-unfinished-species/the-blind-watchmaker-opens-his-eyes`,
  mainEntityOfPage: `${SITE_URL}/books/the-unfinished-species/the-blind-watchmaker-opens-his-eyes`,
  isPartOf: { '@id': `${SITE_URL}/books/the-unfinished-species#book` },
  author: { '@type': 'Person', name: 'Mayone Maha Rajan' },
  publisher: { '@type': 'Organization', name: 'Maha Strategies LLC', url: SITE_URL },
  datePublished: '2026-07-16',
  dateModified: '2026-07-16',
  isAccessibleForFree: true,
  inLanguage: 'en',
  articleSection: 'Opening essay',
}

const paragraphs = [
  'For two centuries, the intellectual history of our species has been caught in a false choice. On one side: a universe of chance, in which life is the accidental residue of blind selection. On the other: a universe of design, in which complexity must have been imposed by an external will. Both sides see something real. Both mistake a stage for the whole story.',
  'Natural selection has no foresight. Mutations do not arrive with a plan. Organisms that fit their circumstances leave more descendants, and those that do not tend to disappear. That mechanism is blind, slow, and often cruel. It is also capable, given enough time, of producing a creature that can imagine a future before it enters it.',
  'The human brain is not outside evolution. It is one of evolution’s outcomes: a biological system that can model possibilities, compare them, and choose an action without first paying for every mistake in blood. A jump can be rejected before the body makes it. A winter can be anticipated before it arrives. A shelter can be built before the cold kills.',
  'This is a change in kind. For most of life’s history, the environment imposed its verdict after the fact. The organism ran the experiment by living through it. With prediction, a creature can begin to run parts of the experiment internally. It can alter its surroundings in advance. It can make tools, habits, institutions, and eventually instruments that feed back into the conditions that shape it.',
  'That is not evidence that evolution had a destination in mind. It is an interpretation of the trajectory: evolution built a capacity for design from within a process that itself had none. Design is not an alternative to evolution. It is one of the things evolution can eventually produce.',
  'The difficulty begins when we notice what we have designed so far. Modern life has reduced many forms of suffering and danger, achievements that should not be romanticized away. Yet the same drive to remove friction can become a machine for mismatch. Bodies and minds formed under conditions of movement, scarcity, attention, and tight social groups now meet environments organized around effortless calories, continuous stimulation, and systems engineered to retain attention.',
  'The answer is not to reverse history or turn biology into a hierarchy of human worth. Nostalgia is not a method, and neither is coercion. The useful question is narrower and more demanding: which pressures help humans become more capable, attentive, resilient, and free—and which pressures quietly diminish those capacities?',
  'The distinction matters because we are no longer merely exposed to selection pressures. We are increasingly their authors. Architecture, education, food systems, workplaces, algorithms, medicine, and emerging computational tools all shape the environments in which human capacities develop. Each is, in a modest but real sense, a choice about what kinds of people are easier to become.',
  'This is the central proposition of The Unfinished Species. We do not become sovereign by pretending to be outside biology, and we do not become free by denying the forces that shape us. We become more responsible when we can see those forces clearly enough to choose among them.',
  'The blind watchmaker did not hand us a finished design. It handed us a capacity to participate in the next one. The question is whether we can learn to use that capacity with enough humility to avoid becoming the failed architect of ourselves.',
]

export default function BlindWatchmakerEssay() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <article className="max-w-3xl mx-auto px-6 py-20 sm:py-28">
        <Link href="/books/the-unfinished-species" className="inline-block font-mono text-xs text-indigo-300 hover:text-white tracking-widest uppercase transition-colors mb-12">
          ← The Unfinished Species
        </Link>
        <header className="border-b border-zinc-800 pb-10 mb-12">
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-5">[ Opening essay ]</p>
          <h1 className="text-4xl sm:text-5xl font-light text-white leading-[1.1] tracking-tight mb-6">The blind watchmaker opens his eyes</h1>
          <p className="text-xl text-zinc-300 font-light leading-relaxed">
            Natural selection built a creature capable of prediction. What follows when that creature begins to redesign the pressures that made it?
          </p>
          <p className="mt-7 font-mono text-xs text-zinc-500 tracking-widest uppercase">Mayone Maha Rajan · The Unfinished Species</p>
        </header>

        <div className="prose prose-invert prose-lg max-w-none prose-p:text-zinc-300 prose-p:leading-[1.85] prose-p:mb-7">
          {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>

        <footer className="mt-16 pt-8 border-t border-zinc-800">
          <p className="font-mono text-xs text-zinc-500 tracking-widest uppercase mb-4">[ Continue reading ]</p>
          <div className="flex flex-col gap-3">
            <Link href="/books/the-unfinished-species/what-is-natural-selection" className="text-zinc-300 hover:text-white transition-colors">What is natural selection? ↗</Link>
            <Link href="/books/the-unfinished-species" className="text-zinc-300 hover:text-white transition-colors">Return to the book’s table of contents ↗</Link>
          </div>
        </footer>
      </article>
    </main>
  )
}
