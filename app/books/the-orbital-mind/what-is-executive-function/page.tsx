import Link from 'next/link'
import type { Metadata } from 'next'
import ArticleTableOfContents from '@/components/ArticleTableOfContents'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

const SITE_URL = 'https://www.mahastrategies.com'
const URL = `${SITE_URL}/books/the-orbital-mind/what-is-executive-function`

export const metadata: Metadata = {
  title: 'What Is Executive Function? The Skills Behind Self-Regulation',
  description:
    'A plain-English guide to executive function: working memory, inhibitory control, cognitive flexibility, self-regulation, and what these terms can—and cannot—explain.',
  alternates: { canonical: '/books/the-orbital-mind/what-is-executive-function' },
  openGraph: {
    type: 'article',
    url: URL,
    title: 'What Is Executive Function?',
    description:
      'A plain-English guide to working memory, inhibitory control, cognitive flexibility, and self-regulation.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'What Is Executive Function? — Maha Strategies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'What Is Executive Function?',
    description: 'A plain-English guide to the cognitive skills behind self-regulation.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const sources = [
  {
    title: 'Executive Functions',
    authors: 'Adele Diamond (2013)',
    href: 'https://www.annualreviews.org/content/journals/10.1146/annurev-psych-113011-143750',
    note: 'A major review of core executive functions, their development, and the conditions that affect them.',
  },
  {
    title: 'The Nature and Organization of Individual Differences in Executive Functions',
    authors: 'Miyake and Friedman (2012)',
    href: 'https://pubmed.ncbi.nlm.nih.gov/22773897/',
    note: 'Explains why updating, shifting, and inhibition are related but distinguishable control processes.',
  },
  {
    title: 'Relations Among Self-Regulation, Self-Control, and Executive Functioning',
    authors: 'Joel T. Nigg (2017)',
    href: 'https://pubmed.ncbi.nlm.nih.gov/28035675/',
    note: 'A review of overlapping terminology and why self-regulation should not be reduced to a single process.',
  },
  {
    title: 'Conclusions About Interventions for Improving Executive Functions',
    authors: 'Diamond and Ling (2016)',
    href: 'https://pubmed.ncbi.nlm.nih.gov/26749076/',
    note: 'A review that distinguishes justified claims about practice from exaggerated claims about broad transfer.',
  },
]

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'What Is Executive Function? The Skills Behind Self-Regulation',
  description:
    'A plain-English guide to executive function: working memory, inhibitory control, cognitive flexibility, self-regulation, and what these terms can—and cannot—explain.',
  url: URL,
  mainEntityOfPage: URL,
  isPartOf: { '@id': `${SITE_URL}/books/the-orbital-mind#book` },
  author: { '@type': 'Person', name: 'Mayone Maha Rajan' },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  datePublished: '2026-07-16',
  dateModified: '2026-07-16',
  isAccessibleForFree: true,
  inLanguage: 'en',
  articleSection: 'Psychology explainer',
  about: [
    { '@type': 'Thing', name: 'Executive function' },
    { '@type': 'Thing', name: 'Self-regulation' },
    { '@type': 'Thing', name: 'Cognitive flexibility' },
  ],
  citation: sources.map((source) => source.href),
}

export default function WhatIsExecutiveFunctionPage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <article className="evidence-container evidence-container--narrow">
        <Link href="/books/the-orbital-mind" className="inline-block font-mono text-xs text-[var(--status-sourced)] hover:text-[var(--text-primary)] tracking-widest uppercase transition-colors mb-12">
          ← The Orbital Mind
        </Link>

        <header className="border-b border-[var(--border-default)] pb-10 mb-12">
          <p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-5">[ Plain-English psychology guide ]</p>
          <h1 className="text-4xl sm:text-5xl font-light text-[var(--text-primary)] leading-[1.1] tracking-tight mb-6">What is executive function?</h1>
          <p className="text-xl text-[var(--text-secondary)] font-light leading-relaxed">
            Executive function is the family of cognitive skills that helps us hold information in mind, resist an unhelpful impulse, shift when circumstances change, and keep a goal in view. It is not a personality type, a moral score, or a diagnosis.
          </p>
          <p className="mt-7 font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase">Mayone Maha Rajan · The Orbital Mind</p>
        </header>

        <ArticleTableOfContents contentId="article-content" />
        <div id="article-content" data-article-content className="prose prose-lg max-w-none prose-p:text-[var(--text-secondary)] prose-p:leading-[1.85] prose-p:mb-7 prose-strong:text-[var(--text-primary)] prose-a:text-[var(--status-sourced)] prose-a:no-underline hover:prose-a:text-[var(--text-primary)] prose-li:text-[var(--text-secondary)] prose-li:leading-relaxed">
          <h2>Short answer</h2>
          <p>
            Executive function is an umbrella term for the control processes we use when a response is not automatic: keeping a rule in mind, pausing before acting, ignoring interference, switching strategies, and organizing steps toward a goal. Research commonly identifies three core components—working memory, inhibitory control, and cognitive flexibility—while also recognizing that they are related without being one single ability. <a href={sources[0].href}>[1]</a> <a href={sources[1].href}>[2]</a>
          </p>
          <p>
            You use executive function when you remember the point you wanted to make while listening to someone else, stop yourself from sending an angry message, or abandon a plan that is not working. Those examples do not make executive function synonymous with intelligence, ambition, or virtue. They describe a set of context-sensitive skills that help regulate thought and action.
          </p>

          <h2>The three core skills</h2>
          <h3>Working memory: holding the relevant information</h3>
          <p>
            Working memory is the ability to keep information available long enough to use it. It helps when following multi-step directions, comparing options, carrying a number while doing mental arithmetic, or remembering a goal while distractions compete for attention. It is not a warehouse for everything you know; it is a limited workspace for what matters now.
          </p>
          <h3>Inhibitory control: pausing or filtering</h3>
          <p>
            Inhibitory control helps prevent a strong, habitual, or distracting response from taking over immediately. It includes resisting an impulse to act, filtering interference, and choosing a response after a pause. It is not the absence of desire or emotion. Often it is the capacity to notice a pull without letting that pull decide by itself.
          </p>
          <h3>Cognitive flexibility: changing course</h3>
          <p>
            Cognitive flexibility is the ability to shift perspective, rules, or strategies when a situation changes. It helps a person move from one task to another, revise an interpretation when new evidence arrives, or find an alternative when a first approach fails. A system that can only persist is rigid; a system that can only switch is scattered. Flexibility helps balance those failures.
          </p>

          <h2>How executive function relates to self-regulation</h2>
          <p>
            The terms overlap, but they are not perfectly interchangeable. Executive function usually refers to cognitive control processes. <strong>Self-regulation</strong> is often used more broadly: it can include how a person manages attention, behavior, emotion, motivation, and the demands of a situation. Researchers use the labels differently across fields, which is one reason simple definitions can become misleading. <a href={sources[2].href}>[3]</a>
          </p>
          <p>
            The practical distinction matters. “I did not do the thing I intended to do” can involve a working-memory overload, an impulse, a poorly defined task, fatigue, conflicting values, missing support, or some combination. Calling every difficulty “lack of willpower” hides the actual problem. Calling every difficulty “executive dysfunction” can do the same in a different way.
          </p>

          <h2>What executive function can and cannot explain</h2>
          <p>
            Executive-function language is useful when it helps make a task more specific. Instead of “I cannot get organized,” the relevant question might be: am I losing the next step, unable to filter interruptions, or failing to revise a plan that has become unrealistic? Specific questions produce more useful observations than a global verdict about character.
          </p>
          <p>
            It cannot diagnose a condition from a single difficult week, a productivity problem, or an online checklist. Performance also changes with context and state; stress, lack of sleep, and other pressures can affect executive functioning. A useful concept becomes harmful when it is used to declare what a person permanently is, or to substitute for professional assessment where one is needed. <a href={sources[0].href}>[1]</a>
          </p>

          <h2>A practical systems view</h2>
          <p>
            The least dramatic intervention is often the most intelligent: change the demand before demanding more control. Put the next physical action in writing instead of trying to carry a project in working memory. Remove a predictable distraction before relying on inhibition. Add a review point when a plan has become rigid. These are not cures or diagnoses. They are ways of making the task fit the limited, shifting resources a person actually has.
          </p>
          <p>
            This is why executive function should not be treated as a private moral substance. It is expressed in a system: a body, an environment, a task, a history, and other people. The relevant question is not simply “how strong is my control?” but “what conditions would let this control process do its job?”
          </p>

          <h2>Can executive function improve?</h2>
          <p>
            Executive skills develop and can be practiced, but the research does not support a universal shortcut or a generic “brain training” upgrade that transfers everywhere. Reviews find that benefits from training are often strongest for the practiced activity and closely related tasks. The honest goal is not to install an all-purpose stronger self; it is to build usable skills and conditions for the situations that matter. <a href={sources[3].href}>[4]</a>
          </p>

          <h2>Where The Orbital Mind begins</h2>
          <p>
            <em>The Orbital Mind</em> calls one aspect of self-regulation the “governing center.” That is a philosophical and symbolic image for coordination among competing demands. It is not the name of a brain structure, a diagnostic category, or evidence that planets determine personality. The book’s solar language comes after the psychological concept, as a way to remember it—not as a way to prove it.
          </p>
          <p>
            The book’s larger claim is interpretive: a life can be understood as a system of functions held in a workable relation. Executive function is one piece of evidence relevant to that picture, not a complete theory of a person.
          </p>

          <h2>Frequently asked questions</h2>
          <h3>Is executive function the same as willpower?</h3>
          <p>
            No. Willpower is an everyday term that can refer to effort, motivation, or self-control. Executive function names specific cognitive control processes. Motivation, emotion, values, task design, and social conditions also affect whether a person follows through.
          </p>
          <h3>Is executive function the same as intelligence?</h3>
          <p>
            No. Executive function and intelligence are related in some research, but neither term replaces the other. A person can be highly knowledgeable or creative and still struggle with planning, distraction, or switching under particular conditions.
          </p>
          <h3>When should someone seek professional support?</h3>
          <p>
            If difficulties with attention, planning, impulse control, mood, or daily functioning are persistent, distressing, or interfering with work, study, relationships, or safety, discuss them with a qualified healthcare or mental-health professional. This guide is educational and cannot assess an individual situation.
          </p>
        </div>

        <section className="mt-16 pt-8 border-t border-[var(--border-default)]">
          <p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-5">[ Sources ]</p>
          <ol className="space-y-5">
            {sources.map((source, index) => (
              <li key={source.href} className="grid grid-cols-[1.5rem_1fr] gap-4 text-sm leading-relaxed">
                <span className="font-mono text-[var(--text-muted)]">{index + 1}</span>
                <div>
                  <a href={source.href} className="text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors">{source.title}</a>
                  <span className="text-[var(--text-muted)]"> · {source.authors}</span>
                  <p className="text-[var(--text-muted)] mt-1">{source.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-16 pt-8 border-t border-[var(--border-default)]">
          <p className="font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase mb-4">[ Continue reading ]</p>
          <div className="flex flex-col gap-3">
            <Link href="/books/the-orbital-mind/the-governing-center" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Read Chapter 1: The Governing Center ↗</Link>
            <Link href="/books/the-orbital-mind" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Return to The Orbital Mind ↗</Link>
          </div>
        </footer>
      </article>
    </main>
  )
}
