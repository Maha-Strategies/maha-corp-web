import type { Metadata } from 'next'
import Link from 'next/link'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'M-Theory FAQ | The Borrowed Light',
  description: 'A plain-language guide to M-theory, string theory, extra dimensions, branes, the landscape, and the limits of what physics currently establishes.',
  alternates: { canonical: '/books/the-borrowed-light/m-theory-faq' },
  openGraph: {
    type: 'article', url: `${SITE_URL}/books/the-borrowed-light/m-theory-faq`, title: 'M-Theory FAQ',
    description: 'A plain-language guide to the physics used—and carefully bounded—in The Borrowed Light.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'M-Theory FAQ — The Borrowed Light' }],
  },
  twitter: { card: 'summary_large_image', title: 'M-Theory FAQ', description: 'A plain-language guide to the physics used in The Borrowed Light.', images: ['/og-master.png'], creator: '@mayonemaha' },
}

const questions = [
  {
    question: 'What is M-theory?',
    answer: 'M-theory is the name physicists use for a proposed deeper framework connecting the five consistent superstring theories. It is not a finished theory with one universally accepted defining equation. Rather, it is a web of powerful mathematical relationships, limiting cases, and partial descriptions that appear to point beyond the separate string theories.',
  },
  {
    question: 'Is M-theory the “theory of everything”?',
    answer: 'No. It is a candidate framework for unifying quantum mechanics and gravity, but it has not been established as a description of our universe. Calling it a theory of everything overstates its present scientific status.',
  },
  {
    question: 'Has M-theory been experimentally confirmed?',
    answer: 'No distinctive experimental prediction of string theory or M-theory has been confirmed. Its characteristic effects are generally associated with energies far beyond present experiments. Mathematical coherence can make a framework scientifically valuable, but it is not empirical confirmation.',
  },
  {
    question: 'Why do people say M-theory has eleven dimensions?',
    answer: 'In an important limit, Type IIA string theory behaves like an eleven-dimensional theory whose low-energy description is eleven-dimensional supergravity. That is a major clue in the M-theory picture. It does not mean eleven dimensions have been observed, nor does it settle how—if the framework describes nature at all—such dimensions would relate to the familiar four-dimensional world.',
  },
  {
    question: 'What are strings and branes?',
    answer: 'In string theory, fundamental objects can be one-dimensional strings rather than point particles. A brane is an extended object with more dimensions: a membrane is a two-dimensional example. These are technical ideas in a mathematical framework, not objects that have been directly observed.',
  },
  {
    question: 'What are dualities?',
    answer: 'Dualities are exact correspondences between apparently different mathematical descriptions. They can show that a regime that looks strongly coupled in one description is equivalent to a weakly coupled regime in another. They establish a deep equivalence between theories; they do not establish that either theory describes our universe.',
  },
  {
    question: 'What are the landscape and the swampland?',
    answer: 'The “landscape” refers to the large set of possible low-energy situations that can arise in string-theory constructions. The “swampland” is a set of active conjectures about effective theories that may look internally sensible but cannot arise from a consistent theory of quantum gravity. These are research programs with real technical content and unresolved questions, not settled facts about the universe.',
  },
  {
    question: 'Does M-theory explain consciousness, personality, or relationships?',
    answer: 'No. M-theory is a proposal in fundamental physics. It does not provide scientific evidence for a theory of the self, consciousness, attachment, or relationship. Any comparison between its structures and human life belongs to philosophy, art, or analogy—not physics.',
  },
  {
    question: 'How does The Borrowed Light use M-theory?',
    answer: 'The book uses selected structures—partial descriptions, boundaries, dualities, landscapes, and limits—as explicitly marked structural analogies. The human argument is meant to stand without the physics. The book does not claim that M-theory proves its conclusions about selfhood or relationship.',
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: questions.map(({ question, answer }) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })),
}

export default function MTheoryFaqPage() {
  return <main className="evidence-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    <article className="evidence-container evidence-container--narrow">
      <Link href="/books/the-borrowed-light" className="inline-block font-mono text-xs text-[var(--status-sourced)] hover:text-[var(--text-primary)] tracking-widest uppercase transition-colors mb-12">← The Borrowed Light</Link>
      <header className="border-l border-indigo-500 pl-6 sm:pl-8">
        <p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-5">[ New reader guide ]</p>
        <h1 className="text-4xl sm:text-5xl font-light text-[var(--text-primary)] leading-[1.1] tracking-tight mb-5">M-theory, plainly</h1>
        <p className="text-xl text-[var(--text-secondary)] font-light leading-relaxed">The physics vocabulary behind <em>The Borrowed Light</em>, and the boundary between what it can and cannot support.</p>
      </header>
      <section className="mt-12 border border-indigo-900/50 bg-indigo-950/20 p-6 sm:p-7 text-sm leading-relaxed text-[var(--text-secondary)]">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Reading boundary ]</p>
        <p className="mt-3">This is a guide to concepts, not a claim that fundamental physics explains a human life. The book&apos;s analogies are offered for their structure; they are not evidence.</p>
      </section>
      <section className="mt-14 space-y-10">
        {questions.map(({ question, answer }) => <div key={question} className="border-b border-[var(--border-default)] pb-10">
          <h2 className="text-2xl font-light text-[var(--text-primary)] leading-snug">{question}</h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--text-secondary)]">{answer}</p>
        </div>)}
      </section>
      <section className="mt-14 border-t border-[var(--border-default)] pt-8 text-sm leading-relaxed text-[var(--text-secondary)]">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-secondary)]">Further reading</h2>
        <ul className="mt-5 space-y-3">
          <li><a className="text-[var(--status-sourced)] underline underline-offset-4 hover:text-[var(--text-primary)]" href="https://arxiv.org/abs/hep-th/9503124">Edward Witten, “String Theory Dynamics in Various Dimensions”</a></li>
          <li><a className="text-[var(--status-sourced)] underline underline-offset-4 hover:text-[var(--text-primary)]" href="https://arxiv.org/abs/1806.08362">Obied, Ooguri, Spodyneiko, and Vafa, “De Sitter Space and the Swampland”</a></li>
          <li><Link className="text-[var(--status-sourced)] underline underline-offset-4 hover:text-[var(--text-primary)]" href="/books/the-borrowed-light/read/what-m-theory-is-and-isnt">Appendix A: What M-Theory Actually Is and Isn&apos;t</Link></li>
        </ul>
      </section>
    </article>
  </main>
}
