import Link from 'next/link'
import type { Metadata } from 'next'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'Books & Essays | Maha Strategies',
  description:
    'Open web editions by Mayone Maha Rajan on artificial intelligence, self-regulation, evolution, dreaming, relationship, planetary systems, and the human future.',
  alternates: { canonical: '/books' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/books`,
    title: 'Books & Essays | Maha Strategies',
    description: 'Eight complete open web editions by Mayone Maha Rajan, with guides and essays.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Books & Essays — Maha Strategies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Books & Essays | Maha Strategies',
    description: 'Eight open web editions by Mayone Maha Rajan.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const books = [
  {
    title: 'The Cosmic Recursion',
    subtitle: 'What Survives the Compression',
    description: 'A book about information, erasure, physical limits, cosmic structure, and the disciplined losses through which anything persists.',
    href: '/books/the-cosmic-recursion',
    readHref: '/books/the-cosmic-recursion/read',
    chapter: { title: 'The First Forgetting', href: '/books/the-cosmic-recursion/read/the-first-forgetting' },
  },
  {
    title: 'The Maha Principle',
    subtitle: 'The Architecture of Human Flourishing',
    description: 'A systems manifesto about health, attention, community, capable action, humane governance, and civic renewal.',
    href: '/books/the-maha-principle',
    readHref: '/books/the-maha-principle/read',
    chapter: { title: 'The Poisoned Body', href: '/books/the-maha-principle/read/the-poisoned-body' },
  },
  {
    title: 'The Volcanic Engine',
    subtitle: 'Living on a Firing Planet',
    description: 'A research edition about the engine beneath the surface: eruption, warning, climate, habitability, and human life on volcanic ground.',
    href: '/books/the-volcanic-engine',
    readHref: '/books/the-volcanic-engine/read',
    guide: { title: 'Why Do Volcanoes Explode?', href: '/books/the-volcanic-engine/why-volcanoes-explode' },
    chapter: { title: 'The Rock That Flows', href: '/books/the-volcanic-engine/read/the-rock-that-flows' },
  },
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
    <main className="evidence-page">
      <div className="evidence-container">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker">[ Maha Strategies // Open Editions ]</p>
          <h1 className="evidence-title evidence-title--product mt-5">Books &amp; essays</h1>
          <p className="evidence-lede mt-7">
            Eight works about the systems that shape a person and a world: intelligence, attention, evolution,
            imagination, relationship, planetary and cosmic process, and the choices that follow from them.
          </p>
          <p className="evidence-copy mt-5">
            Each open edition includes the complete manuscript, stable chapter links, and companion essays where available.
          </p>
        </header>

        <section className="evidence-section" aria-label="Open web editions">
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {books.map((book) => (
              <article key={book.title} className="evidence-card">
                <p className="evidence-kicker">Open edition</p>
                <p className="evidence-card-title mt-4">{book.title}</p>
                <p className="evidence-kicker mt-2">{book.subtitle}</p>
                <p className="evidence-copy mt-5">{book.description}</p>
                <div className="mt-7 flex flex-col gap-3">
                  {'guide' in book && book.guide ? (
                    <Link href={book.guide.href} className="evidence-link">
                      New reader: {book.guide.title} ↗
                    </Link>
                  ) : null}
                  <Link href={book.readHref} className="evidence-link">
                    Read complete edition ↗
                  </Link>
                  <Link href={book.chapter.href} className="evidence-link">
                    Start with {book.title === 'The Borrowed Light' ? 'the introduction' : 'Chapter 1'}: {book.chapter.title} ↗
                  </Link>
                  <Link href={book.href} className="evidence-link">
                    Explore book structure ↗
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
