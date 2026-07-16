import Link from 'next/link'
import type { Metadata } from 'next'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'The map is not the mind | The Orbital Mind',
  description:
    'A self is a system of relationships, not a set of personality labels. How to use a symbolic map without mistaking it for evidence.',
  alternates: { canonical: '/books/the-orbital-mind/the-map-is-not-the-mind' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/books/the-orbital-mind/the-map-is-not-the-mind`,
    title: 'The map is not the mind',
    description: 'A self is a system of relationships, not a set of personality labels. How to use a symbolic map without mistaking it for evidence.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The map is not the mind' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The map is not the mind',
    description: 'A self is a system of relationships, not a set of personality labels. How to use a symbolic map without mistaking it for evidence.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The Map Is Not the Mind',
  description: 'A self is a system of relationships, not a set of personality labels. How to use a symbolic map without mistaking it for evidence.',
  url: `${SITE_URL}/books/the-orbital-mind/the-map-is-not-the-mind`,
  mainEntityOfPage: `${SITE_URL}/books/the-orbital-mind/the-map-is-not-the-mind`,
  isPartOf: { '@id': `${SITE_URL}/books/the-orbital-mind#book` },
  author: { '@type': 'Person', name: 'Mayone Maha Rajan' },
  publisher: { '@type': 'Organization', name: 'Maha Strategies LLC', url: SITE_URL },
  datePublished: '2026-07-16',
  dateModified: '2026-07-16',
  isAccessibleForFree: true,
  inLanguage: 'en',
  articleSection: 'Opening essay',
}

const paragraphs = [
  'A person can be highly capable and still feel internally ungoverned: thought pulling one way, desire another, obligation a third. The work that matters sits open in front of you while attention is captured by whatever is loudest. The problem is not always intelligence or effort. Often it is a problem of coordination.',
  'We reach for personality labels because they feel clarifying. They reduce a moving life to a fixed answer: this is who I am; this is the kind of person I have always been. But labels easily end the conversation we most need to have. They turn a relationship between functions into a verdict about a self.',
  'A more useful starting point is to treat the self as a regulatory system. Attention must filter and frame. Desire must assign value. Agency must mobilize and hold a boundary. Structure must make commitments and endings possible. The body must be supplied, rested, and listened to. Imagination has to open a future without letting us disappear into it. No single function is your name. All of them are operating in you now.',
  'What varies from life to life is not which function a person “is.” It is which relationships are under strain. Someone who cannot start an important project may not lack drive; the functions that mobilize action and impose constraint may be locked against each other. Someone who burns out may not have too much ambition; the producing function may be running with nothing that replenishes it. The question is not “what am I?” but “what is happening here, and which forces are involved?”',
  'The Orbital Mind uses the solar system as a memorable language for asking that question. The Sun can stand for a governing center. Earth and Moon can evoke the body and its rhythms. Saturn can illuminate limit and commitment. Mars can make agency and boundary vivid. These are images: useful handles for a complex subject, not claims that a planet determines a person’s life.',
  'That distinction is not a footnote. The sky is not evidence for psychology, and this is not astrology. The psychological claims in the book stand or fall on their own evidence, their limitations, and their alternatives. The planetary language arrives only afterward, as an image that may help a reader remember and work with an idea that has already been stated in plain language.',
  'Symbols can help precisely because they compress a problem into something graspable. A good map does not replace the terrain. It lets you orient yourself in terrain too large and too near to see all at once. Used lightly, an image can make a difficult relationship visible. Used dogmatically, it becomes another way to stop looking.',
  'The purpose of a map is not to tell you who you are. It is to give you better questions: What is asking for attention? What has been neglected? Which capacities are colliding? What would a small, concrete adjustment look like under real conditions?',
  'No book can answer those questions in place of a life, and no framework should be used to avoid appropriate professional help. But a person who learns to see their inner conflicts as relationships rather than defects has already gained something important: a path toward intervention that does not begin with shame.',
  'The map is not the mind. It is a set of handles for a system in motion. Its value lies not in delivering a verdict, but in helping a reader begin the one conversation that has a chance of changing things.',
]

export default function MapIsNotMindEssay() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <article className="max-w-3xl mx-auto px-6 py-20 sm:py-28">
        <Link href="/books/the-orbital-mind" className="inline-block font-mono text-[10px] text-indigo-400 hover:text-white tracking-widest uppercase transition-colors mb-12">
          ← The Orbital Mind
        </Link>
        <header className="border-b border-zinc-800 pb-10 mb-12">
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-5">[ Opening essay ]</p>
          <h1 className="text-4xl sm:text-5xl font-light text-white leading-[1.1] tracking-tight mb-6">The map is not the mind</h1>
          <p className="text-xl text-zinc-400 font-light leading-relaxed">
            A self is a system of relationships, not a set of personality labels.
          </p>
          <p className="mt-7 font-mono text-[10px] text-zinc-600 tracking-widest uppercase">Mayone Maha Rajan · The Orbital Mind</p>
        </header>

        <div className="prose prose-invert prose-lg max-w-none prose-p:text-zinc-300 prose-p:leading-[1.85] prose-p:mb-7">
          {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>

        <footer className="mt-16 pt-8 border-t border-zinc-800">
          <p className="font-mono text-[10px] text-zinc-600 tracking-widest uppercase mb-4">[ Continue reading ]</p>
          <Link href="/books/the-orbital-mind" className="text-zinc-300 hover:text-white transition-colors">Return to the book’s table of contents ↗</Link>
        </footer>
      </article>
    </main>
  )
}
