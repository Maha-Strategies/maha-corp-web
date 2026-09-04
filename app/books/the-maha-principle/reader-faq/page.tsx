import type { Metadata } from 'next'
import Link from 'next/link'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'Reader FAQ | The Maha Principle',
  description:
    'A new-reader guide to The Maha Principle, its systems framework for human flourishing, its practical scope, and its limits.',
  alternates: { canonical: '/books/the-maha-principle/reader-faq' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/books/the-maha-principle/reader-faq`,
    title: 'Reader FAQ | The Maha Principle',
    description: 'A concise guide to the book’s framework, practical use, and claim boundaries.',
    images: [
      {
        url: '/books/the-maha-principle/cover.jpg',
        width: 1632,
        height: 2624,
        alt: 'Cover of The Maha Principle',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reader FAQ | The Maha Principle',
    description: 'A concise guide to the book’s framework, practical use, and claim boundaries.',
    images: ['/books/the-maha-principle/cover.jpg'],
    creator: '@mayonemaha',
  },
}

const questions = [
  {
    question: 'What is the Maha Principle?',
    answer:
      'It is a systems framework for examining the conditions that support human flourishing. The book connects bodily health, attention, community, execution, governance, complexity, and long-range direction while treating them as interacting domains rather than isolated problems.',
  },
  {
    question: 'Is the book a personal-development guide, a political program, or a philosophy?',
    answer:
      'It contains elements of all three, but it is best read as a systems manifesto with practical protocols. It moves between individual practice, community design, institutional governance, and civic possibility. Those levels are related in the argument, but a proposal at one level does not automatically establish a prescription at another.',
  },
  {
    question: 'Who is the book for?',
    answer:
      'It is written for readers who want to connect personal agency with the wider systems that shape health, attention, work, community, and public life. Readers can use the framework without accepting every diagnosis or proposal in the book.',
  },
  {
    question: 'What does “human flourishing” mean here?',
    answer:
      'It means more than comfort or productivity. The book uses the term for a condition in which people retain health, attention, meaningful relationships, capable action, and a credible role in shaping the institutions around them. This is a normative definition, not a universally settled scientific metric.',
  },
  {
    question: 'Are the protocols medical treatment?',
    answer:
      'No. The dietary, fasting, cold-exposure, exercise, and self-assessment material is educational and philosophical, not medical advice. Individual circumstances and risks differ, and readers should consult qualified healthcare professionals before applying health-related protocols.',
  },
  {
    question: 'Does the book claim that flawless execution means never making mistakes?',
    answer:
      'No. The phrase describes disciplined alignment between intention, evidence, action, feedback, and correction. A system that detects and repairs error can be more faithful to the principle than one that hides uncertainty behind an appearance of perfection.',
  },
  {
    question: 'How are evidence and values separated?',
    answer:
      'Empirical claims can inform what is possible or likely, but they cannot determine every value judgment. The book combines factual claims, interpretations, ethical commitments, and proposals; readers should distinguish those categories rather than treating the entire argument as one kind of proof.',
  },
  {
    question: 'How should a new reader use the book?',
    answer:
      'Begin with the map of the terrain and introduction, then choose the domain most relevant to your present situation. Treat the audits and protocols as prompts for observation and discussion, not as compulsory instructions. The falsifiability protocol is the clearest guide to testing the book’s claims rather than merely agreeing with them.',
  },
  {
    question: 'Is this FAQ the complete book?',
    answer:
      'No. This page is a short reader guide. It summarizes the framework and its boundaries but does not reproduce the manuscript or replace the published edition.',
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

export default function MahaPrincipleReaderFaqPage() {
  return (
    <main className="evidence-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }}
      />
      <article className="evidence-container evidence-container--narrow">
        <Link
          href="/books/the-maha-principle"
          className="mb-12 inline-block font-mono text-xs uppercase tracking-widest text-[var(--status-sourced)] transition-colors hover:text-[var(--text-primary)]"
        >
          ← The Maha Principle
        </Link>
        <header className="border-l border-indigo-500 pl-6 sm:pl-8">
          <p className="mb-5 font-mono text-xs uppercase tracking-widest text-[var(--status-sourced)]">[ New reader guide ]</p>
          <h1 className="mb-5 text-4xl font-light leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-5xl">
            The Maha Principle: reader FAQ
          </h1>
          <p className="text-xl font-light leading-relaxed text-[var(--text-secondary)]">
            What the framework is for, how to approach it, and what it does not claim.
          </p>
        </header>

        <section className="mt-12 border border-indigo-900/50 bg-indigo-950/20 p-6 text-sm leading-relaxed text-[var(--text-secondary)] sm:p-7">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Scope boundary ]</p>
          <p className="mt-3">
            This guide explains the book without reproducing it. Its health material is educational and philosophical,
            not medical advice, and its civic proposals remain arguments to assess rather than facts to inherit.
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

        <p className="mt-12 text-sm leading-relaxed text-[var(--text-secondary)]">
          The complete text is not reproduced on this page. Visit the book page for current edition availability.
        </p>
      </article>
    </main>
  )
}
