import Link from 'next/link'
import type { Metadata } from 'next'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'The faculty of the possible | The Imagined Life',
  description:
    'A dream does not make itself real. It changes the dreamer, who changes their actions, which can then change the world.',
  alternates: { canonical: '/books/the-imagined-life/the-faculty-of-the-possible' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/books/the-imagined-life/the-faculty-of-the-possible`,
    title: 'The faculty of the possible',
    description: 'A dream does not make itself real. It changes the dreamer, who changes their actions, which can then change the world.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The faculty of the possible' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The faculty of the possible',
    description: 'A dream does not make itself real. It changes the dreamer, who changes their actions, which can then change the world.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The Faculty of the Possible',
  description: 'A dream does not make itself real. It changes the dreamer, who changes their actions, which can then change the world.',
  url: `${SITE_URL}/books/the-imagined-life/the-faculty-of-the-possible`,
  mainEntityOfPage: `${SITE_URL}/books/the-imagined-life/the-faculty-of-the-possible`,
  isPartOf: { '@id': `${SITE_URL}/books/the-imagined-life#book` },
  author: { '@type': 'Person', name: 'Mayone Maha Rajan' },
  publisher: { '@type': 'Organization', name: 'Maha Strategies LLC', url: SITE_URL },
  datePublished: '2026-07-16',
  dateModified: '2026-07-16',
  isAccessibleForFree: true,
  inLanguage: 'en',
  articleSection: 'Opening essay',
}

const paragraphs = [
  'There is a moment, just before sleep, when the mind slips its leash. A place you have never been appears. A conversation that never happened begins. A version of yourself does something you have not done. You did not decide to picture these things. They arrive, and by morning they can carry the texture of having been lived rather than imagined.',
  'We tend to treat dreaming as the mind’s idle hour: a strange nightly screensaver, meaningful or meaningless according to taste, disconnected from the serious business of waking life. But the generative power on display in a dream—the ability to build a convincing world from within—may be much closer to the center of waking life than it first appears.',
  'The name for that power is imagination. We have used the word so casually that we can miss what it names: the capacity to hold a version of the world that does not yet exist. A person can picture a different skill, a different relationship, a different body of work, or a different way of inhabiting an ordinary day. That capacity is not a guarantee. It is an opening.',
  'The distinction matters because imagination is often surrounded by magical advice. Picture what you want, the story goes, and the world will arrange itself to deliver it. Want the outcome intensely enough and reality will comply. That promise is popular, profitable, and false.',
  'A dream does not become real because it was dreamed. It becomes real, when it does, because imagining it changes the dreamer. A person who can vividly picture a future may notice different opportunities, tolerate a different kind of effort, rehearse a difficult conversation, or return to a task that used to feel meaningless. Those altered actions accumulate. Over time, they can alter a life and, sometimes, a piece of the world.',
  'The chain is not wish to world. It is imagination to altered self, altered self to altered action, and altered action to altered reality. Every link is human work. The vision does not replace the deed. It gives the deed a direction.',
  'This is why dreaming deserves more than sentimental respect. The sleeping brain offers a dramatic version of an ability that also operates while we are awake: the capacity to simulate a not-yet-real possibility and respond to it as though it matters. Planning, rehearsal, longing, anxiety, and hope all make use of that faculty. They are not identical to dreams, but they belong to the same larger human traffic between the actual and the possible.',
  'The faculty can also mislead. An imagined catastrophe can take over attention as easily as an imagined future can guide it. A polished fantasy can become a substitute for action. Generative machines can supply us with an endless procession of images, plans, and possible selves—some useful, some entrancing, some designed to keep us consuming possibility instead of living it.',
  'The practical task is not to stop imagining. It is to become a better steward of imagination: to distinguish a model from the world it represents, an aspiration from a plan, and an inspiring image from the practices that could make it durable. The imagined future becomes useful when it is allowed to revise our behavior rather than excuse us from revising it.',
  'This is the claim of The Imagined Life. The dream was never going to make itself real. The work belongs to the one who dreamed it—but the ability to imagine what is not may be one of the most practical powers that person has.',
]

export default function FacultyOfThePossibleEssay() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <article className="max-w-3xl mx-auto px-6 py-20 sm:py-28">
        <Link href="/books/the-imagined-life" className="inline-block font-mono text-[10px] text-indigo-400 hover:text-white tracking-widest uppercase transition-colors mb-12">
          ← The Imagined Life
        </Link>
        <header className="border-b border-zinc-800 pb-10 mb-12">
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-5">[ Opening essay ]</p>
          <h1 className="text-4xl sm:text-5xl font-light text-white leading-[1.1] tracking-tight mb-6">The faculty of the possible</h1>
          <p className="text-xl text-zinc-400 font-light leading-relaxed">
            Imagination does not make a future appear. It changes the person who works to bring one about.
          </p>
          <p className="mt-7 font-mono text-[10px] text-zinc-600 tracking-widest uppercase">Mayone Maha Rajan · The Imagined Life</p>
        </header>

        <div className="prose prose-invert prose-lg max-w-none prose-p:text-zinc-300 prose-p:leading-[1.85] prose-p:mb-7">
          {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>

        <footer className="mt-16 pt-8 border-t border-zinc-800">
          <p className="font-mono text-[10px] text-zinc-600 tracking-widest uppercase mb-4">[ Continue reading ]</p>
          <Link href="/books/the-imagined-life" className="text-zinc-300 hover:text-white transition-colors">Return to the book’s table of contents ↗</Link>
        </footer>
      </article>
    </main>
  )
}
