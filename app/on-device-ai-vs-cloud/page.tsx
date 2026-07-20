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
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, '\\u003c') }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }} />
    <article className="mx-auto max-w-4xl">
      <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ AI infrastructure · decision guide ]</p>
      <h1 className="mt-5 max-w-4xl text-4xl font-light leading-tight tracking-tight text-white sm:text-6xl">When should an organization choose on-device AI over cloud AI?</h1>
      <p className="mt-7 max-w-3xl text-xl leading-relaxed text-zinc-300"><strong>Choose on-device AI when a bounded task gains materially from local data handling, offline operation, or low-latency interaction—and the target hardware can run it reliably.</strong> Choose cloud AI when capability, shared context, centralized operations, or model scale outweigh those local benefits. Many production systems should use both.</p>
      <p className="mt-5 font-mono text-[11px] uppercase tracking-widest text-zinc-500">By Mayone Maha Rajan · Maha Strategies LLC · <time dateTime={publicationDate}>July 20, 2026</time></p>

      <section className="mt-14 border-y border-zinc-800 py-9">
        <h2 className="text-2xl text-white">Start with the workload, not the slogan</h2>
        <div className="mt-5 max-w-3xl space-y-4 leading-relaxed text-zinc-400">
          <p>“On-device” and “cloud” describe where inference or related processing occurs; neither label settles the architecture decision. Begin with the actual task, the data it touches, the quality threshold, device fleet, network conditions, acceptable latency, governance needs, and lifecycle burden.</p>
          <p>On-device execution can reduce the need to send an input to a remote service. That does not itself make a system private or secure: collection, retention, telemetry, permissions, model delivery, access control, and incident response remain design responsibilities.</p>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl text-white">The deployment decision</h2>
        <div className="mt-7 grid gap-4">
          {choices.map(([title, description]) => <section key={title} className="border border-zinc-800 bg-zinc-950 p-6">
            <h3 className="font-mono text-xs font-bold tracking-widest text-indigo-300">{title}</h3>
            <p className="mt-3 max-w-3xl leading-relaxed text-zinc-400">{description}</p>
          </section>)}
        </div>
      </section>

      <section className="mt-14 grid gap-10 border-t border-zinc-800 pt-10 md:grid-cols-2">
        <div>
          <h2 className="text-2xl text-white">Signals for local execution</h2>
          <ul className="mt-5 list-disc space-y-3 pl-5 leading-relaxed text-zinc-400 marker:text-indigo-300">
            <li>The input contains personal, proprietary, or safety-sensitive material that should not leave the device unless a user or policy authorizes it.</li>
            <li>The experience must remain useful during poor or absent connectivity.</li>
            <li>Interaction quality depends on short, predictable response time.</li>
            <li>The use case can meet its quality threshold with a compact or specialized model on supported devices.</li>
          </ul>
        </div>
        <div>
          <h2 className="text-2xl text-white">Signals for cloud execution</h2>
          <ul className="mt-5 list-disc space-y-3 pl-5 leading-relaxed text-zinc-400 marker:text-indigo-300">
            <li>The task needs a model, context window, retrieval corpus, or multimodal capability beyond the target fleet.</li>
            <li>Many users must work from one current shared knowledge base or centrally governed workflow.</li>
            <li>The organization needs a controlled service layer for policy enforcement, observation, or rapid model changes.</li>
            <li>Device variability, thermal limits, storage, power, or model distribution make reliable local execution impractical.</li>
          </ul>
        </div>
      </section>

      <section className="mt-14 border border-indigo-900/50 bg-indigo-950/20 p-7 sm:p-9">
        <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Practical default ]</p>
        <h2 className="mt-4 text-2xl text-white">Minimize unnecessary data movement, then justify every remote dependency.</h2>
        <p className="mt-4 max-w-3xl leading-relaxed text-zinc-400">A hybrid design is often the most disciplined default: execute local steps that improve privacy, responsiveness, or resilience; make cloud escalation explicit; and measure whether each remote call earns the data flow and operational dependency it introduces.</p>
      </section>

      <section className="mt-14 border border-zinc-800 p-7 sm:p-9">
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">[ Decision checklist ]</p>
        <ol className="mt-5 list-decimal space-y-3 pl-5 leading-relaxed text-zinc-400 marker:text-zinc-300">
          <li>Define the task and minimum acceptable quality before choosing a model or vendor.</li>
          <li>Map the input, output, retention, telemetry, and authorized data transfers.</li>
          <li>Test representative target devices under network, thermal, battery, and accessibility constraints.</li>
          <li>Specify update, rollback, security, and incident-response responsibilities for the chosen architecture.</li>
          <li>Use a hybrid boundary where it reduces unnecessary transfer without undermining the user outcome.</li>
        </ol>
      </section>

      <section className="mt-14 border border-indigo-900/50 bg-indigo-950/20 p-7 sm:p-9">
        <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Citation-ready guidance ]</p>
        <blockquote className="mt-5 max-w-3xl border-l-2 border-indigo-400 pl-5 text-lg leading-relaxed text-zinc-200">“On-device AI is appropriate when a bounded task benefits materially from local data handling, offline resilience, or low latency and can run reliably on target hardware; cloud AI is appropriate when capability, shared context, or centralized operations outweigh those benefits. Hybrid designs often provide the best boundary.”</blockquote>
        <p className="mt-5 text-sm text-zinc-400">Suggested citation: Maha Rajan, M. (2026, July 20). <em>When Should an Organization Choose On-Device AI Over Cloud AI?</em> Maha Strategies LLC. {canonicalUrl}</p>
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
        <h2 className="text-2xl text-white">Sources and implementation references</h2>
        <ol className="mt-6 space-y-5">
          {sources.map((source) => <li key={source.url} className="leading-relaxed text-zinc-400">
            <a className="text-zinc-100 underline underline-offset-4 hover:text-white" href={source.url}>{source.name} ↗</a>
            <span className="block mt-1 text-sm">{source.note}</span>
          </li>)}
        </ol>
      </section>

      <section className="mt-14 flex flex-wrap gap-4 border-t border-zinc-800 pt-10">
        <Link href="/software" className="border border-zinc-600 px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-zinc-100 hover:border-white">Explore Maha OS</Link>
        <Link href="/systemic-sovereignty" className="border border-zinc-600 px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-zinc-100 hover:border-white">Read systemic sovereignty</Link>
      </section>
    </article>
  </main>
}
