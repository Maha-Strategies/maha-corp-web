import type { Metadata } from 'next'
import Link from 'next/link'

import MpsLearningLinks from '@/components/MpsLearningLinks'
import { MAHA_ORGANIZATION_ID, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'

const canonicalUrl = 'https://www.mahastrategies.com/mps/what-is-mps'
const publicationDate = '2026-07-20'

export const metadata: Metadata = {
  title: 'What Is the Maha Provenance Standard (MPS)?',
  description: 'The Maha Provenance Standard (MPS/0.1) is a claim-level provenance framework that labels the evidentiary status of substantive nonfiction claims.',
  alternates: { canonical: '/mps/what-is-mps' },
  openGraph: {
    title: 'What Is the Maha Provenance Standard (MPS)?',
    description: 'A concise explanation of MPS/0.1, its five claim-status tags, scope, limits, and canonical sources.',
    url: canonicalUrl,
    type: 'article',
  },
}

const sources = [
  {
    name: 'Maha Provenance Standard (MPS/0.1) specification',
    url: 'https://www.mahastrategies.com/mps',
    note: 'Canonical specification, tag definitions, compliance levels, and JSON audit-record structure.',
  },
  {
    name: 'Zenodo archival record: 10.5281/zenodo.21241308',
    url: 'https://doi.org/10.5281/zenodo.21241308',
    note: 'Versioned archival record for the public MPS specification.',
  },
  {
    name: 'MPS Registry',
    url: 'https://mps.mahastrategies.com/v1/records',
    note: 'Public, versioned claim-record endpoint with evidence context and review metadata.',
  },
  {
    name: 'MPS Auditor',
    url: 'https://www.mahastrategies.com/audit',
    note: 'Reference implementation that produces a structured MPS/0.1 preflight record for a passage.',
  },
]

const faq = [
  {
    question: 'What is the Maha Provenance Standard?',
    answer: 'MPS/0.1 is a claim-level provenance framework for nonfiction produced with or without AI assistance. It labels the evidentiary status of each substantive claim so readers can distinguish checked evidence, attributed sources, uncertainty, illustration, and work still awaiting verification.',
  },
  {
    question: 'What does MPS tag?',
    answer: 'MPS applies to substantive claims: statements of fact, attribution, quantity, causation, or consensus that a reader might reasonably rely on. It does not tag clearly framed opinion, rhetorical questions, or structural prose.',
  },
  {
    question: 'Does an MPS tag prove a claim is true?',
    answer: 'No. An MPS tag records the claim’s stated evidentiary status and the checking that was performed. It is not an independent certification of truth, and MPS/0.1 does not replace primary-source verification.',
  },
  {
    question: 'Is MPS a certification?',
    answer: 'No. MPS/0.1 defines MPS-Declared and MPS-Audited states. MPS-Certified is reserved in the current specification and is not a general claim that documents using the framework are certified.',
  },
]

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  '@id': `${canonicalUrl}#article`,
  headline: 'What Is the Maha Provenance Standard (MPS)?',
  description: 'A concise explanation of MPS/0.1, its five claim-status tags, scope, limits, and canonical sources.',
  mainEntityOfPage: canonicalUrl,
  datePublished: publicationDate,
  dateModified: publicationDate,
  author: { '@id': MAYONE_MAHA_RAJAN_ID },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  about: [
    { '@type': 'Thing', name: 'Provenance' },
    { '@type': 'Thing', name: 'AI-assisted nonfiction' },
    { '@type': 'Thing', name: 'Claim-level evidence labeling' },
  ],
  citation: sources.map((source) => source.url),
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
}

const tagDefinitions = [
  ['VERIFIED', 'Confirmed by the author against a primary source, direct computation, or first-hand observation.'],
  ['SOURCED', 'Attributed to an identified, citable secondary source that has not been independently verified.'],
  ['BOUNDARY', 'Reports the limit of knowledge: an open question, untested conjecture, or contested finding.'],
  ['ILLUSTRATIVE', 'An analogy, thought experiment, composite example, or structural metaphor that asserts nothing about the world.'],
  ['UNVERIFIED', 'A claim awaiting confirmation. It is a flag of unfinished verification, not a license to publish an unchecked assertion as fact.'],
]

export default function WhatIsMpsPage() {
  return <main className="evidence-page"><div className="evidence-container">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, '\\u003c') }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }} />
    <article>
      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ MPS/0.1 · explainer ]</p>
      <h1 className="evidence-title evidence-title--product max-w-3xl">What is the Maha Provenance Standard?</h1>
      <p className="mt-7 max-w-3xl text-xl leading-relaxed text-[var(--text-secondary)]"><strong>MPS/0.1 is a claim-level provenance framework for nonfiction.</strong> It labels the evidentiary status of substantive claims so a reader can see what was checked, what was attributed, where knowledge ends, and what remains unverified.</p>
      <p className="mt-5 font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)]">By Mayone Maha Rajan · Maha Strategies LLC · <time dateTime={publicationDate}>July 20, 2026</time></p>

      <section className="mt-14 border-y border-[var(--border-default)] py-9">
        <h2 className="evidence-section-title">The short version</h2>
        <div className="mt-5 max-w-3xl space-y-4 leading-relaxed text-[var(--text-secondary)]">
          <p>Document-level AI disclosure can say that AI was used, but it does not tell a reader which individual statements were checked. MPS works at the claim level instead. Each substantive claim receives one status tag and, in a structured audit record, a rationale, source field, and recommended action.</p>
          <p>MPS is designed for nonfiction written with or without AI assistance. It is intended to make uncertainty inspectable; it does not turn an assertion into a fact, replace source review, or certify a document merely because it carries MPS tags.</p>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="evidence-section-title">The five claim-status tags</h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {tagDefinitions.map(([tag, definition]) => <div key={tag} className="border border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
            <h3 className="font-mono text-xs font-bold tracking-widest text-[var(--text-muted)]">{tag}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{definition}</p>
          </div>)}
        </div>
      </section>

      <section className="mt-14 grid gap-10 border-t border-[var(--border-default)] pt-10 md:grid-cols-2">
        <div>
          <h2 className="evidence-section-title">What MPS covers</h2>
          <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">Statements of fact, attribution, quantity, causation, and expert consensus that a reader might reasonably rely on. A compliant record can be rendered inline for readers or serialized as JSON for audit tools.</p>
        </div>
        <div>
          <h2 className="evidence-section-title">What MPS does not claim</h2>
          <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">It does not independently prove a claim, guarantee completeness, replace a domain expert, or create a blanket certification. In the current specification, MPS-Certified remains reserved; the defined states are MPS-Declared and MPS-Audited.</p>
        </div>
      </section>

      <section className="mt-14 border border-[var(--status-sourced)] bg-[var(--surface-raised)] p-7 sm:p-9">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ Citation-ready definition ]</p>
        <blockquote className="mt-5 max-w-3xl border-l-2 border-[var(--status-sourced)] pl-5 text-lg leading-relaxed text-[var(--text-secondary)]">“The Maha Provenance Standard (MPS/0.1) is a claim-level provenance framework that makes the evidentiary status of substantive nonfiction claims explicit, auditable, and machine-readable.”</blockquote>
        <p className="mt-5 text-sm text-[var(--text-secondary)]">Suggested citation: Maha Rajan, M. (2026, July 20). <em>What Is the Maha Provenance Standard (MPS)?</em> Maha Strategies LLC. {canonicalUrl}</p>
      </section>

      <section className="mt-14">
        <h2 className="evidence-section-title">Frequently asked questions</h2>
        <div className="mt-6 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-default)]">
          {faq.map((item) => <div key={item.question} className="py-6">
            <h3 className="text-lg text-[var(--text-primary)]">{item.question}</h3>
            <p className="mt-3 max-w-3xl leading-relaxed text-[var(--text-secondary)]">{item.answer}</p>
          </div>)}
        </div>
      </section>

      <section className="mt-14 border-t border-[var(--border-default)] pt-10">
        <h2 className="evidence-section-title">Canonical sources and reference implementations</h2>
        <ol className="mt-6 space-y-5">
          {sources.map((source) => <li key={source.url} className="leading-relaxed text-[var(--text-secondary)]">
            <a className="text-[var(--text-primary)] underline underline-offset-4 hover:text-[var(--text-primary)]" href={source.url}>{source.name} ↗</a>
            <span className="block mt-1 text-sm">{source.note}</span>
          </li>)}
        </ol>
      </section>

      <section className="mt-14 flex flex-wrap gap-4 border-t border-[var(--border-default)] pt-10">
        <Link href="/mps" className="border border-[var(--border-default)] px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--text-primary)]">Read the MPS/0.1 specification</Link>
        <Link href="/audit" className="border border-[var(--border-default)] px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--text-primary)]">Try the free Auditor</Link>
      </section>
      <MpsLearningLinks />
    </article>
    </div>
  </main>
}
