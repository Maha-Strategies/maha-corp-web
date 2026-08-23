import type { Metadata } from 'next'
import Link from 'next/link'

import MpsLearningLinks from '@/components/MpsLearningLinks'
import MpsImplementationLibraryLinks from '@/components/MpsImplementationLibraryLinks'
import { MAHA_ORGANIZATION_ID, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'

const canonicalUrl = 'https://www.mahastrategies.com/mps/learn'

export const metadata: Metadata = {
  title: 'MPS Learning Center | Claim-level provenance guides',
  description: 'Practical guides to claim-level provenance, citing AI-assisted research, and separating sources from interpretation and speculation.',
  alternates: { canonical: '/mps/learn' },
  openGraph: {
    title: 'MPS Learning Center | Maha Strategies',
    description: 'Practical, bounded guides for source-aware AI-assisted research and publishing.',
    url: canonicalUrl,
    type: 'website',
  },
}

const guides = [
  {
    href: '/mps/claim-level-provenance',
    title: 'What is claim-level provenance?',
    description: 'The minimum record that lets a claim keep its source, status, scope, and review history when it is quoted or reused.',
  },
  {
    href: '/mps/citing-ai-assisted-research',
    title: 'How should AI-assisted research be cited?',
    description: 'A practical distinction between citing the work, disclosing the instruments, and tracing the sources behind individual claims.',
  },
  {
    href: '/mps/source-interpretation-speculation',
    title: 'How do source, interpretation, and speculation differ?',
    description: 'A compact reading and writing method for keeping evidence, inference, and possibility from being flattened into one voice.',
  },
]

const implementationGuides = [
  { href: '/mps/learn/implementation', title: 'AI implementation decision framework', description: 'Compare privacy, capability, cost, latency, resilience, and device requirements before selecting a local, cloud, or hybrid boundary.' },
  { href: '/on-device-ai-vs-cloud', title: 'On-device AI vs cloud AI', description: 'The existing canonical workload-level comparison: where inference belongs, what each option requires, and why hybrid is often appropriate.' },
  { href: '/mps/learn/implementation/individuals', title: 'Implementation guides', description: 'Practical starting points for individuals, schools, small organizations, and developers.' },
  { href: '/mps/learn/reference-architectures', title: 'Reference architectures', description: 'Bounded field, school, and internal-search patterns with data flows, measurements, failure paths, and sources.' },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${canonicalUrl}#page`,
  name: 'MPS Learning Center',
  description: 'Practical guides to claim-level provenance and AI-assisted research publishing.',
  url: canonicalUrl,
  isPartOf: { '@id': 'https://www.mahastrategies.com/#website' },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  author: { '@id': MAYONE_MAHA_RAJAN_ID },
  hasPart: [...guides, ...implementationGuides].map((guide) => ({ '@type': 'Article', name: guide.title, url: `https://www.mahastrategies.com${guide.href}` })),
}

export default function MpsLearningCenterPage() {
  return <main className="evidence-page"><div className="evidence-container">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <article>
      <Link href="/mps" className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)]">← Maha Provenance Standard</Link>
      <p className="mt-12 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ MPS/0.1 · learning center ]</p>
      <h1 className="evidence-title evidence-title--product max-w-3xl">Research should not lose its boundaries when it travels.</h1>
      <p className="mt-7 max-w-3xl text-xl leading-relaxed text-[var(--text-secondary)]">These short guides explain the practices behind the Maha Provenance Standard: how a substantive claim can retain its source, epistemic status, scope, and revision history when people—or AI systems—reuse it.</p>

      <section className="mt-14 grid gap-4 md:grid-cols-3" aria-label="MPS learning guides">
        {guides.map((guide) => <Link key={guide.href} href={guide.href} className="border border-[var(--border-default)] bg-[var(--surface-raised)] p-6 transition hover:border-[var(--status-sourced)]">
          <h2 className="evidence-card-title">{guide.title}</h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">{guide.description}</p>
          <span className="mt-6 block font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Read guide →</span>
        </Link>)}
      </section>

      <section className="mt-16 border-t border-[var(--border-default)] pt-12" aria-labelledby="implementation-library-heading">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ MPS implementation library ]</p>
        <h2 id="implementation-library-heading" className="evidence-section-title mt-4">Decide where AI belongs before deciding what it should say.</h2>
        <p className="mt-4 max-w-3xl leading-relaxed text-[var(--text-secondary)]">This practical library extends the Learning Center from claim provenance into deployment choices. It compares on-device, cloud, and hybrid AI without treating any location as an automatic privacy, security, performance, or sovereignty outcome. Start with a workload, map its data and dependencies, and test the real device and network conditions.</p>
        <div className="mt-7 grid gap-4 md:grid-cols-3">{implementationGuides.map((guide) => <Link key={guide.href} href={guide.href} className="border border-[var(--border-default)] bg-[var(--surface-raised)] p-6 transition hover:border-[var(--status-sourced)]"><h3 className="evidence-card-title">{guide.title}</h3><p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">{guide.description}</p><span className="mt-6 block font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Open guide →</span></Link>)}</div>
        <MpsImplementationLibraryLinks />
      </section>

      <section className="mt-14 grid gap-8 border-y border-[var(--border-default)] py-10 md:grid-cols-2">
        <div><h2 className="evidence-section-title">What these guides are</h2><p className="mt-4 leading-relaxed text-[var(--text-secondary)]">A public explanation of one project’s methodology and tools. They use examples from Maha work, including the Research Context Registry and the De Sitter Atlas, to show the difference between a visible source trail and a bare assertion.</p></div>
        <div><h2 className="evidence-section-title">What they are not</h2><p className="mt-4 leading-relaxed text-[var(--text-secondary)]">They are not peer-reviewed research, legal guidance, a general certification scheme, or a substitute for reading primary sources. MPS records what was checked and how a claim is framed; it does not make a claim true.</p></div>
      </section>

      <section className="mt-14 flex flex-wrap gap-4">
        <Link href="/audit" className="border border-[var(--border-default)] px-5 py-3 font-mono text-xs uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--text-primary)]">Try the free Auditor</Link>
        <a href="https://research.mahastrategies.com/registry" className="border border-[var(--border-default)] px-5 py-3 font-mono text-xs uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--text-primary)]">Inspect the Research Registry ↗</a>
        <a href="https://publish.mahastrategies.com" className="border border-[var(--border-default)] px-5 py-3 font-mono text-xs uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--text-primary)]">Explore Agentic Publishing ↗</a>
      </section>
      <MpsLearningLinks />
    </article>
    </div>
  </main>
}
