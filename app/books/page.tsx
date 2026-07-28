import Link from 'next/link'
import type { Metadata } from 'next'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'Books & Essays | Maha Strategies',
  description:
    'Open web editions by Mayone Maha Rajan on artificial intelligence, self-regulation, evolution, dreaming, relationship, and the human future.',
  alternates: { canonical: '/books' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/books`,
    title: 'Books & Essays | Maha Strategies',
    description: 'Five complete open web editions by Mayone Maha Rajan, with guides and essays.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Books & Essays — Maha Strategies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Books & Essays | Maha Strategies',
    description: 'Five open web editions by Mayone Maha Rajan.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const books = [
  {
    title: 'The Borrowed Light',
    subtitle: 'The Physics of a Self Made With Others',
    description: 'A book about the self, relationship, and the structures we borrow from one another to become real.',
    href: '/books/the-borrowed-light',
    readHref: '/books/the-borrowed-light/read',
    guide: { title: 'M-Theory, Plainly', href: '/books/the-borrowed-light/m-theory-faq' },
    chapter: { title: 'The Light Without a Source', href: '/books/the-borrowed-light/read/introduction' },
  },
  {
    title: 'The Orbital Mind',
    subtitle: 'The Astrophysics of the Self',
    description: 'A systems psychology of attention, desire, agency, structure, imagination, grief, and integration.',
    href: '/books/the-orbital-mind',
    readHref: '/books/the-orbital-mind/read',
    guide: { title: 'What Is Executive Function?', href: '/books/the-orbital-mind/what-is-executive-function' },
    chapter: { title: 'The Governing Center', href: '/books/the-orbital-mind/the-governing-center' },
  },
  {
    title: 'The Synthetic Self',
    subtitle: 'Engineering the Soul of the Machine',
    description: 'A book about language models, human judgment, and the record we are teaching machines to reflect.',
    href: '/books/the-synthetic-self',
    readHref: '/books/the-synthetic-self/read',
    guide: { title: 'How Do Large Language Models Learn?', href: '/books/the-synthetic-self/how-large-language-models-learn' },
    chapter: { title: 'The Learning Machine', href: '/books/the-synthetic-self/the-learning-machine' },
  },
  {
    title: 'The Unfinished Species',
    subtitle: 'How Intelligence Learned to Redesign Its Own Substrate',
    description: 'A book about evolution, self-design, and the conditions intelligence creates for its own development.',
    href: '/books/the-unfinished-species',
    readHref: '/books/the-unfinished-species/read',
    guide: { title: 'What Is Natural Selection?', href: '/books/the-unfinished-species/what-is-natural-selection' },
    chapter: { title: 'The Algorithm', href: '/books/the-unfinished-species/the-algorithm' },
  },
  {
    title: 'The Imagined Life',
    subtitle: 'Living Inside a Dreaming Brain',
    description: 'A book about dreaming, imagination, and turning a possible future into an actual one.',
    href: '/books/the-imagined-life',
    readHref: '/books/the-imagined-life/read',
    guide: { title: 'Sleep Stages Explained', href: '/books/the-imagined-life/sleep-stages-explained' },
    chapter: { title: 'What Happens When You Sleep', href: '/books/the-imagined-life/what-happens-when-you-sleep' },
  },
]

export default function BooksPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-5xl mx-auto px-6 py-20 sm:py-28">
        <header className="max-w-3xl border-l border-indigo-500 pl-6 sm:pl-8">
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-5">[ Maha Strategies // Open Editions ]</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-white leading-[1.08] tracking-tight mb-6">Books &amp; essays</h1>
          <p className="text-xl sm:text-2xl text-zinc-200 font-light leading-relaxed mb-5">
            Five works about the systems that shape a person: intelligence, attention, evolution, imagination, relationship, and the choices that follow from them.
          </p>
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            Each open edition includes the complete manuscript, with stable chapter links for focused reading, plus companion guides and essays where available.
          </p>
        </header>

        <section className="mt-20" aria-label="Open web editions">
          <div className="grid gap-5 md:grid-cols-2">
            {books.map((book) => (
              <article key={book.title} className="border border-zinc-800 p-6 sm:p-7 hover:border-zinc-600 transition-colors">
                <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-4">[ Open edition ]</p>
                <h2 className="text-2xl text-white mb-2">{book.title}</h2>
                <p className="font-mono text-xs text-zinc-400 tracking-widest uppercase mb-5">{book.subtitle}</p>
                <p className="text-zinc-400 leading-relaxed mb-7">{book.description}</p>
                <div className="flex flex-col gap-3 border-t border-zinc-800 pt-5 text-sm">
                  {'guide' in book && book.guide ? <Link href={book.guide.href} className="text-indigo-200 hover:text-white transition-colors">
                    New reader? {book.guide.title} ↗
                  </Link> : null}
                  <Link href={book.readHref} className="font-mono text-xs text-white hover:text-indigo-200 tracking-widest uppercase transition-colors">
                    Read complete edition ↗
                  </Link>
                  <Link href={book.chapter.href} className="text-zinc-400 hover:text-white transition-colors">
                    Start with {book.title === 'The Borrowed Light' ? 'the introduction' : 'Chapter 1'}: {book.chapter.title} ↗
                  </Link>
                  <Link href={book.href} className="font-mono text-xs text-zinc-400 hover:text-white tracking-widest uppercase transition-colors mt-1">
                    Explore the book ↗
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
