import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_ORGANIZATION_ID, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'

const canonicalUrl = 'https://www.mahastrategies.com/systemic-sovereignty'
const publicationDate = '2026-07-20'

export const metadata: Metadata = {
  title: 'What Does Systemic Sovereignty Mean?',
  description: 'Systemic sovereignty is Maha Strategies’ framework for autonomy across semiconductor supply chains, software and on-device AI, and human attention.',
  alternates: { canonical: '/systemic-sovereignty' },
  openGraph: {
    title: 'What Does Systemic Sovereignty Mean?',
    description: 'A concise explanation of Maha Strategies’ three-layer framework for autonomy across infrastructure, interface, and intellect.',
    type: 'article',
    url: canonicalUrl,
  },
}

const layers = [
  ['Infrastructure', 'The physical layer: semiconductor supply chains, compute hardware, assembly capacity, and the dependencies that determine whether critical computing can continue to operate.'],
  ['Interface', 'The software layer: local-first design, on-device AI, and the governance of data and decision systems that mediate daily work.'],
  ['Intellect', 'The human layer: attention, cognitive liberty, and the conditions that preserve meaningful individual judgment and agency.'],
]

const sources = [
  {
    name: 'About Maha Strategies LLC',
    url: 'https://www.mahastrategies.com/about',
    note: 'Canonical organization profile and the three-layer research model.',
  },
  {
    name: 'Maha Strategies research and intelligence',
    url: 'https://www.mahastrategies.com/intelligence',
    note: 'Public research on technology, markets, policy, and evidence-led decision-making.',
  },
  {
    name: 'Hardware Sovereignty & Edge-Compute Intelligence',
    url: 'https://www.mahastrategies.com/protocols/hardware-sovereignty',
    note: 'Maha Strategies’ protocol on the infrastructure layer of the framework.',
  },
  {
    name: 'Maha OS',
    url: 'https://www.mahastrategies.com/software',
    note: 'The local-first software product associated with the interface and intellect layers.',
  },
  {
    name: 'Maha Provenance Standard (MPS/0.1)',
    url: 'https://www.mahastrategies.com/mps',
    note: 'The evidence-labeling method used to distinguish sourced claims, uncertainty, and interpretation in Maha’s work.',
  },
]

const faq = [
  {
    question: 'What does systemic sovereignty mean?',
    answer: 'Systemic sovereignty is Maha Strategies’ framework for autonomy across three connected layers: infrastructure, interface, and intellect. It asks whether a person, organization, or society can retain meaningful agency when its hardware, software, and human attention are interdependent.',
  },
  {
    question: 'Is systemic sovereignty an established academic standard?',
    answer: 'No. It is Maha Strategies’ named research framework. It is offered as a lens for organizing questions and dependencies, not as a settled scientific theory, policy standard, or certification.',
  },
  {
    question: 'How is it different from data sovereignty?',
    answer: 'Data sovereignty usually concerns control, jurisdiction, and governance of data. Systemic sovereignty includes that concern but also considers hardware and supply-chain dependencies, local software operation, and the human conditions needed to exercise judgment.',
  },
  {
    question: 'What does the framework not establish?',
    answer: 'The framework does not by itself prove that a technical architecture, policy, or lifestyle intervention will produce a particular outcome. Specific factual and causal claims require their own evidence and should be assessed separately.',
  },
]

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  '@id': `${canonicalUrl}#article`,
  headline: 'What Does Systemic Sovereignty Mean?',
  description: 'A concise explanation of Maha Strategies’ three-layer framework for autonomy across infrastructure, interface, and intellect.',
  mainEntityOfPage: canonicalUrl,
  datePublished: publicationDate,
  dateModified: publicationDate,
  author: { '@id': MAYONE_MAHA_RAJAN_ID },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  about: [
    { '@type': 'Thing', name: 'Systemic sovereignty' },
    { '@type': 'Thing', name: 'Technology sovereignty' },
    { '@type': 'Thing', name: 'On-device artificial intelligence' },
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

export default function SystemicSovereigntyPage() {
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, '\\u003c') }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }} />
    <article className="mx-auto max-w-4xl">
      <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Maha Strategies · explainer ]</p>
      <h1 className="mt-5 max-w-3xl text-4xl font-light leading-tight tracking-tight text-white sm:text-6xl">What does systemic sovereignty mean?</h1>
      <p className="mt-7 max-w-3xl text-xl leading-relaxed text-zinc-300"><strong>Systemic sovereignty is Maha Strategies&rsquo; framework for autonomy across infrastructure, interface, and intellect.</strong> It treats semiconductor supply chains, software and on-device AI, and human attention as connected layers of a single operating environment.</p>
      <p className="mt-5 font-mono text-[11px] uppercase tracking-widest text-zinc-500">By Mayone Maha Rajan · Maha Strategies LLC · <time dateTime={publicationDate}>July 20, 2026</time></p>

      <section className="mt-14 border-y border-zinc-800 py-9">
        <h2 className="text-2xl text-white">The short version</h2>
        <div className="mt-5 max-w-3xl space-y-4 leading-relaxed text-zinc-400">
          <p>The framework asks a practical question: can a person, organization, or society retain meaningful agency when the infrastructure it depends on, the interfaces that shape its choices, and the human capacity to exercise judgment all influence one another?</p>
          <p>It is a Maha Strategies research framework, not an established academic standard or a claim that every dependency can be eliminated. Its purpose is to surface dependencies that are often assessed separately and make trade-offs discussable.</p>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl text-white">The three layers</h2>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {layers.map(([title, description]) => <section key={title} className="border border-zinc-800 bg-zinc-950 p-5">
            <h3 className="font-mono text-xs font-bold tracking-widest text-indigo-300">{title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{description}</p>
          </section>)}
        </div>
      </section>

      <section className="mt-14 grid gap-10 border-t border-zinc-800 pt-10 md:grid-cols-2">
        <div>
          <h2 className="text-2xl text-white">How it relates to data sovereignty</h2>
          <p className="mt-5 leading-relaxed text-zinc-400">Data sovereignty addresses where data lives, who governs it, and which jurisdiction applies. Systemic sovereignty includes those questions, while adding the dependencies beneath and around them: hardware supply, local versus remote computation, software control, and the capacity of people to make informed decisions.</p>
        </div>
        <div>
          <h2 className="text-2xl text-white">What it does not claim</h2>
          <p className="mt-5 leading-relaxed text-zinc-400">The framework does not predict a specific economic, technical, or health outcome. It does not establish that any particular policy or product will create autonomy. Those propositions require their own sources, methods, and stated uncertainty.</p>
        </div>
      </section>

      <section className="mt-14 border border-indigo-900/50 bg-indigo-950/20 p-7 sm:p-9">
        <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Citation-ready definition ]</p>
        <blockquote className="mt-5 max-w-3xl border-l-2 border-indigo-400 pl-5 text-lg leading-relaxed text-zinc-200">“Systemic sovereignty is Maha Strategies&rsquo; framework for evaluating autonomy across infrastructure, interface, and intellect: the connected layers of hardware supply, software and AI systems, and human agency.”</blockquote>
        <p className="mt-5 text-sm text-zinc-400">Suggested citation: Maha Rajan, M. (2026, July 20). <em>What Does Systemic Sovereignty Mean?</em> Maha Strategies LLC. {canonicalUrl}</p>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl text-white">Frequently asked questions</h2>
        <div className="mt-6 divide-y divide-zinc-800 border-y border-zinc-800">
          {faq.map((item) => <div key={item.question} className="py-6">
            <h3 className="text-lg text-zinc-100">{item.question}</h3>
            <p className="mt-3 max-w-3xl leading-relaxed text-zinc-400">{item.answer}</p>
          </div>)}
        </div>
      </section>

      <section className="mt-14 border-t border-zinc-800 pt-10">
        <h2 className="text-2xl text-white">Canonical sources and related work</h2>
        <ol className="mt-6 space-y-5">
          {sources.map((source) => <li key={source.url} className="leading-relaxed text-zinc-400">
            <a className="text-zinc-100 underline underline-offset-4 hover:text-white" href={source.url}>{source.name} ↗</a>
            <span className="block mt-1 text-sm">{source.note}</span>
          </li>)}
        </ol>
      </section>

      <section className="mt-14 flex flex-wrap gap-4 border-t border-zinc-800 pt-10">
        <Link href="/about" className="border border-zinc-600 px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-zinc-100 hover:border-white">About Maha Strategies</Link>
        <Link href="/intelligence" className="border border-zinc-600 px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-zinc-100 hover:border-white">Browse intelligence</Link>
      </section>
    </article>
  </main>
}
