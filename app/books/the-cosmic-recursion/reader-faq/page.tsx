import type { Metadata } from 'next'
import Link from 'next/link'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'Reader FAQ | The Cosmic Recursion',
  description:
    'A new-reader guide to The Cosmic Recursion, its argument about compression and persistence, and the boundaries between science and analogy.',
  alternates: { canonical: '/books/the-cosmic-recursion/reader-faq' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/books/the-cosmic-recursion/reader-faq`,
    title: 'Reader FAQ | The Cosmic Recursion',
    description: 'What the book argues, what evidence supports it, and where its analogies stop.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The Cosmic Recursion — reader FAQ' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reader FAQ | The Cosmic Recursion',
    description: 'What the book argues, what evidence supports it, and where its analogies stop.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const questions = [
  {
    question: 'What is The Cosmic Recursion about?',
    answer:
      'It asks how anything persists in a universe where no physical system can retain everything. The book follows a recurring pattern: a system encounters more information than it can preserve, discards some of it, and maintains a smaller set of constraints or invariants that lets it continue.',
  },
  {
    question: 'What does “compression” mean in the book?',
    answer:
      'Sometimes it refers to literal information processing, and sometimes to a broader structural pattern in which a system retains less detail than it receives. The book marks the difference between established physical results, scientific inference, and analogy rather than treating every use of the word as the same technical claim.',
  },
  {
    question: 'Is the book saying that the universe is a computer?',
    answer:
      'No. Computational descriptions can illuminate physical systems, but that does not establish that the universe literally is a computer. Appendix A separates strong ontological claims from weaker and better-supported claims about information, state, measurement, and physical limits.',
  },
  {
    question: 'Does Landauer’s principle prove the book’s whole argument?',
    answer:
      'No. Landauer’s principle connects logically irreversible information erasure with a minimum thermodynamic cost under specified conditions. It supports a bounded claim about information and physics; it does not by itself prove the book’s wider account of memory, civilisation, identity, or cosmic persistence.',
  },
  {
    question: 'How does the book treat black holes and the information problem?',
    answer:
      'Black holes are used as a scientifically active boundary case for questions about entropy, horizons, recoverability, and what an external observer can know. The book does not present any unresolved proposal about black-hole information as settled fact.',
  },
  {
    question: 'Why discuss dark matter if its nature is still unknown?',
    answer:
      'Because its gravitational effects are strongly evidenced even though its underlying nature remains unresolved. That makes it a useful example of disciplined inference: researchers can establish that an explanatory gap is real without pretending to know what ultimately fills it.',
  },
  {
    question: 'Are the claims about people and societies scientific conclusions?',
    answer:
      'Not automatically. When the book moves from stars, entropy, or measurement to memory, institutions, and civilisation, those moves are identified as structural analogies or philosophical arguments. They should be judged on their own reasoning, not borrowed scientific authority.',
  },
  {
    question: 'Where can I check the sources and claim boundaries?',
    answer:
      'The complete edition ends with a provenance index and a sources-and-verification appendix. Together they identify source families and distinguish empirical claims, scientific inferences, and analogical extensions.',
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: questions.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
}

export default function CosmicRecursionReaderFaqPage() {
  return (
    <main className="evidence-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }}
      />
      <article className="evidence-container evidence-container--narrow">
        <Link
          href="/books/the-cosmic-recursion"
          className="mb-12 inline-block font-mono text-xs uppercase tracking-widest text-[var(--status-sourced)] transition-colors hover:text-[var(--text-primary)]"
        >
          ← The Cosmic Recursion
        </Link>
        <header className="border-l border-indigo-500 pl-6 sm:pl-8">
          <p className="mb-5 font-mono text-xs uppercase tracking-widest text-[var(--status-sourced)]">[ New reader guide ]</p>
          <h1 className="mb-5 text-4xl font-light leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-5xl">
            The Cosmic Recursion: reader FAQ
          </h1>
          <p className="text-xl font-light leading-relaxed text-[var(--text-secondary)]">
            The central argument, the scientific foundations, and the boundary between evidence and analogy.
          </p>
        </header>

        <section className="mt-12 border border-indigo-900/50 bg-indigo-950/20 p-6 text-sm leading-relaxed text-[var(--text-secondary)] sm:p-7">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Reading boundary ]</p>
          <p className="mt-3">
            The book separates empirical findings, scientific inference, and structural analogy. A scientific concept can
            clarify a human problem without proving a claim about human life.
          </p>
        </section>

        <section className="mt-14 space-y-10">
          {questions.map(({ question, answer }) => (
            <div key={question} className="border-b border-[var(--border-default)] pb-10">
              <h2 className="text-2xl font-light leading-snug text-[var(--text-primary)]">{question}</h2>
              <p className="mt-4 text-base leading-relaxed text-[var(--text-secondary)]">{answer}</p>
            </div>
          ))}
        </section>

        <Link href="/books/the-cosmic-recursion/read" className="evidence-action evidence-action--primary mt-12 inline-block">
          Explore the complete edition ↗
        </Link>
      </article>
    </main>
  )
}
