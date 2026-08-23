import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_ORGANIZATION_ID, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'

const canonicalUrl = 'https://www.mahastrategies.com/on-device-ai-vs-cloud'
const publicationDate = '2026-07-20'

export const metadata: Metadata = {
  title: 'When Should an Organization Choose On-Device AI Over Cloud AI?',
  description: 'A decision framework for choosing on-device AI, cloud AI, or a hybrid architecture based on data sensitivity, latency, capability, governance, and operating constraints.',
  alternates: { canonical: '/on-device-ai-vs-cloud' },
  openGraph: {
    title: 'When Should an Organization Choose On-Device AI Over Cloud AI?',
    description: 'A practical decision framework for on-device, cloud, and hybrid AI deployments.',
    type: 'article',
    url: canonicalUrl,
  },
}

const choices = [
  ['Prefer on-device AI', 'The task needs to keep sensitive inputs on the device where feasible, must function through unreliable connectivity, needs low interaction latency, and can be served by a bounded model on the target hardware.'],
  ['Prefer cloud AI', 'The task requires a model, context window, retrieval system, or centralized capability that target devices cannot reliably host; or it needs centrally managed updates, monitoring, and shared organizational context.'],
  ['Prefer a hybrid architecture', 'The task has both local and remote elements: keep local capture, filtering, or bounded inference on-device, then send only the user-authorized minimum necessary data to a cloud service for higher-capability work.'],
]

const sources = [
  {
    name: 'NIST Privacy Framework',
    url: 'https://www.nist.gov/privacy-framework/privacy-framework',
    note: 'A voluntary enterprise risk-management framework for privacy risks arising from data processing; it supports the need to map processing and governance rather than treating deployment location as a complete privacy answer.',
  },
  {
    name: 'Apple Core ML documentation',
    url: 'https://developer.apple.com/documentation/coreml',
    note: 'An example of a production framework that performs predictions and optional model adaptation on a person’s device, illustrating viable local execution paths on supported hardware.',
  },
  {
    name: 'Apple: Reducing the Size of Your Core ML App',
    url: 'https://developer.apple.com/documentation/coreml/reducing-the-size-of-your-core-ml-app',
    note: 'An implementation reference for a real on-device constraint: model footprint and device storage.',
  },
  {
    name: 'Maha OS',
    url: 'https://www.mahastrategies.com/software',
    note: 'Maha Strategies’ local-first product context; it is not presented here as proof that local deployment is right for every workload.',
  },
  {
    name: 'What Does Systemic Sovereignty Mean?',
    url: 'https://www.mahastrategies.com/systemic-sovereignty',
    note: 'The Maha Strategies framework that treats hardware, software, and human agency as connected design layers.',
  },
]

const faq = [
  {
    question: 'When should an organization choose on-device AI?',
    answer: 'Choose on-device AI when a bounded task can run reliably on target hardware and the design benefits materially from keeping inputs local, operating without a dependable network, or delivering low-latency interaction. Evaluate model quality, device capability, lifecycle, and security controls before deciding.',
  },
  {
    question: 'Is on-device AI automatically private or secure?',
    answer: 'No. Local inference can reduce the need to transfer inputs to a remote service, but privacy and security still depend on collection, storage, telemetry, permissions, access controls, model updates, and the rest of the product design.',
  },
  {
    question: 'When is cloud AI the better choice?',
    answer: 'Cloud AI is often the better choice when a workload needs capability, scale, current shared information, centralized operations, or a model that target devices cannot host reliably. The relevant question is whether those benefits justify the data flow, dependency, latency, and cost profile for the specific task.',
  },
  {
    question: 'What is a hybrid AI architecture?',
    answer: 'A hybrid architecture assigns different steps to local and cloud systems. For example, a product can perform capture, filtering, redaction, or a small bounded model locally, then send only authorized, necessary data to a cloud service for a larger model or shared retrieval system.',
  },
]

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  '@id': `${canonicalUrl}#article`,
  headline: 'When Should an Organization Choose On-Device AI Over Cloud AI?',
  description: 'A decision framework for choosing on-device AI, cloud AI, or a hybrid architecture based on data sensitivity, latency, capability, governance, and operating constraints.',
  mainEntityOfPage: canonicalUrl,
  datePublished: publicationDate,
  dateModified: publicationDate,
  author: { '@id': MAYONE_MAHA_RAJAN_ID },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  about: [
    { '@type': 'Thing', name: 'On-device artificial intelligence' },
    { '@type': 'Thing', name: 'Cloud computing' },
    { '@type': 'Thing', name: 'Privacy engineering' },
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

export default function OnDeviceAiVsCloudPage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }} />
      <article className="evidence-container">
        <p className="evidence-kicker">AI infrastructure · decision guide</p>
        <h1 className="evidence-title">When should an organization choose on-device AI over cloud AI?</h1>
        <p className="evidence-lede mt-6">
          <strong>Choose on-device AI when a bounded task gains materially from local data handling, offline resilience, or low latency and can run reliably on target hardware.</strong> Choose cloud AI when capability, shared context, centralized operations, or model scale outweigh those local benefits. Many production systems should use both.
        </p>
        <p className="evidence-kicker mt-5">By Mayone Maha Rajan · Maha Strategies LLC · <time dateTime={publicationDate}>July 20, 2026</time></p>

        <section className="evidence-section">
          <p className="evidence-kicker">Start with the workload, not the slogan</p>
          <h2 className="evidence-section-title mt-4 max-w-3xl">Model architecture decisions start with constraints, not labels.</h2>
          <div className="mt-5 space-y-4 evidence-copy">
            <p>On-device and cloud describe where inference or related processing occurs; neither label settles the architecture decision. Begin with the actual task, the data it touches, the quality threshold, device fleet, network conditions, acceptable latency, governance needs, and lifecycle burden.</p>
            <p>On-device execution can reduce the need to send an input to a remote service. That does not itself make a system private or secure: collection, retention, telemetry, permissions, model delivery, access control, and incident response remain design responsibilities.</p>
          </div>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">Deployment decision</p>
          <h2 className="evidence-section-title mt-4">Choose the boundary explicitly.</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
            {choices.map(([choiceTitle, description]) => (
              <article key={choiceTitle} className="evidence-card">
                <p className="evidence-kicker">{choiceTitle}</p>
                <p className="evidence-copy mt-3">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section">
          <div className="grid gap-8 lg:grid-cols-2">
            <article>
              <p className="evidence-kicker">Signals for local execution</p>
              <h2 className="evidence-section-title mt-4">When local execution is preferred</h2>
              <ul className="mt-6 list-disc space-y-3 pl-5 text-sm leading-7 text-[var(--text-secondary)] marker:text-[var(--text-muted)]">
                <li>The input contains personal, proprietary, or safety-sensitive material that should not leave the device unless a user or policy authorizes it.</li>
                <li>The experience must remain useful during poor or absent connectivity.</li>
                <li>Interaction quality depends on short, predictable response time.</li>
                <li>The use case can meet its quality threshold with a compact or specialized model on supported devices.</li>
              </ul>
            </article>

            <article>
              <p className="evidence-kicker">Signals for cloud execution</p>
              <h2 className="evidence-section-title mt-4">When remote processing is preferred</h2>
              <ul className="mt-6 list-disc space-y-3 pl-5 text-sm leading-7 text-[var(--text-secondary)] marker:text-[var(--text-muted)]">
                <li>The task needs a model, context window, retrieval corpus, or multimodal capability beyond the target fleet.</li>
                <li>Many users must work from one current shared knowledge base or centrally governed workflow.</li>
                <li>The organization needs a controlled service layer for policy enforcement, observation, or rapid model changes.</li>
                <li>Device variability, thermal limits, storage, power, or model distribution make reliable local execution impractical.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="evidence-section">
          <div className="evidence-inset">
            <p className="evidence-kicker">Practical default</p>
            <h2 className="evidence-section-title mt-3">Minimize unnecessary data movement, then justify every remote dependency.</h2>
            <p className="evidence-copy mt-4">
              A hybrid design is often the most disciplined default: execute local steps that improve privacy, responsiveness, or resilience; make cloud escalation explicit; and measure whether each remote call earns the data flow and operational dependency it introduces.
            </p>
          </div>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">Decision checklist</p>
          <h2 className="evidence-section-title mt-4">A reusable pre-decision checklist</h2>
          <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-7 text-[var(--text-secondary)] marker:text-[var(--text-primary)]">
            <li>Define the task and minimum acceptable quality before choosing a model or vendor.</li>
            <li>Map the input, output, retention, telemetry, and authorized data transfers.</li>
            <li>Test representative target devices under network, thermal, battery, and accessibility constraints.</li>
            <li>Specify update, rollback, security, and incident-response responsibilities for the chosen architecture.</li>
            <li>Use a hybrid boundary where it reduces unnecessary transfer without undermining the user outcome.</li>
          </ol>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">Citation-ready guidance</p>
          <h2 className="evidence-section-title mt-4">Recommended summary</h2>
          <blockquote className="evidence-inset mt-6">
            <p className="evidence-copy text-base leading-relaxed text-[var(--text-primary)]">
              On-device AI is appropriate when a bounded task benefits materially from local data handling, offline resilience, or low latency and can run reliably on target hardware; cloud AI is appropriate when capability, shared context, or centralized operations outweigh those benefits. Hybrid designs often provide the best boundary.
            </p>
          </blockquote>
          <p className="evidence-kicker mt-6">Suggested citation: Maha Rajan, M. (2026, July 20). <em>When Should an Organization Choose On-Device AI Over Cloud AI?</em> Maha Strategies LLC. {canonicalUrl}</p>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">Frequently asked questions</p>
          <h2 className="evidence-section-title mt-4">Operational concerns answered</h2>
          <div className="mt-6 divide-y divide-[var(--border-default)] border-y border-[var(--border-default)]">
            {faq.map((item) => (
              <article key={item.question} className="py-6">
                <h3 className="text-lg text-[var(--text-primary)]">{item.question}</h3>
                <p className="mt-3 evidence-copy">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">Sources and implementation references</p>
          <h2 className="evidence-section-title mt-4">References</h2>
          <ol className="mt-6 space-y-5">
            {sources.map((source) => (
              <li key={source.url} className="evidence-copy">
                <a className="evidence-link" href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.name} ↗
                </a>
                <span className="mt-2 block text-sm text-[var(--text-secondary)]">{source.note}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="evidence-section">
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/mps/learn/implementation" className="evidence-action evidence-action--secondary">
              Use the implementation framework
            </Link>
            <Link href="/mps/learn" className="evidence-action evidence-action--secondary">
              MPS learning center
            </Link>
            <Link href="/software" className="evidence-action evidence-action--secondary">
              Explore Maha OS
            </Link>
            <Link href="/systemic-sovereignty" className="evidence-action evidence-action--secondary">
              How we research
            </Link>
          </div>
        </section>
      </article>
    </main>
  )
}
