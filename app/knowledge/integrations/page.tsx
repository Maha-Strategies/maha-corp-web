import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/briefs-data'
import {
  EXACTZK_EVIDENCE,
  EXACTZK_EVIDENCE_PATH,
  KNOWLEDGE_INTEGRATIONS_PATH,
  NSGOODS_PREFLIGHT_V3_EVIDENCE,
  NSGOODS_PREFLIGHT_V3_EVIDENCE_PATH,
} from '@/lib/knowledge-integration-evidence'
import { clearingGuidesForLane } from '@/lib/epistemic-clearing-batch-one'

const crossDomainClearingGuides = clearingGuidesForLane('cross-domain-synthesis').slice(0, 6)

export const metadata: Metadata = {
  title: 'Integration Evidence | Maha Strategies',
  description:
    'Crawlable, machine-linked records of bounded external reproductions, interoperability tests and independently checkable integration evidence.',
  alternates: { canonical: KNOWLEDGE_INTEGRATIONS_PATH },
  openGraph: {
    title: 'Integration Evidence | Maha Strategies',
    description:
      'Bounded external reproductions and interoperability records with explicit evidence links and non-claims.',
    url: `${SITE_URL}${KNOWLEDGE_INTEGRATIONS_PATH}`,
    siteName: 'Maha Strategies',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Strategies integration evidence' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Integration Evidence | Maha Strategies',
    description: 'Bounded, independently checkable integration evidence from Maha Strategies.',
    images: ['/og-master.png'],
  },
}

export default function KnowledgeIntegrationsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Maha Strategies Integration Evidence',
    description: metadata.description,
    url: `${SITE_URL}${KNOWLEDGE_INTEGRATIONS_PATH}`,
    isPartOf: { '@type': 'CollectionPage', name: 'Maha Strategies Knowledge', url: `${SITE_URL}/knowledge` },
    hasPart: [
      {
        '@type': 'DigitalDocument',
        name: EXACTZK_EVIDENCE.title,
        description: EXACTZK_EVIDENCE.summary,
        url: `${SITE_URL}${EXACTZK_EVIDENCE_PATH}`,
        datePublished: '2026-09-01',
      },
      {
        '@type': 'DigitalDocument',
        name: NSGOODS_PREFLIGHT_V3_EVIDENCE.title,
        description: NSGOODS_PREFLIGHT_V3_EVIDENCE.summary,
        url: `${SITE_URL}${NSGOODS_PREFLIGHT_V3_EVIDENCE_PATH}`,
        datePublished: '2026-09-02',
      },
    ],
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-cyan-400 selection:text-black">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <section className="border-b border-zinc-800 px-6 py-20 sm:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300">[ Knowledge // Integration evidence ]</p>
          <h1 className="mt-7 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">Evidence that can be followed beyond Maha.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-400">
            This index exposes bounded reproduction and interoperability records as crawlable HTML with direct links to their machine-readable artifacts and upstream publications.
          </p>
          <p className="mt-5 max-w-3xl border-l border-amber-600/60 pl-4 text-sm leading-6 text-amber-100">
            Integration evidence is not promoted into canonical domain knowledge. Each record states exactly what was observed, who asserted it and what remains outside scope.
          </p>
          <Link href="/knowledge" className="mt-8 inline-block font-mono text-xs uppercase tracking-widest text-cyan-300 hover:text-cyan-100">
            ← Back to Knowledge
          </Link>
        </div>
      </section>

      <section className="px-6 py-14 sm:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-white">Published records</h2>
            <a href="/maha-machine-readable-registry.json" className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-cyan-300">
              Machine-readable registry ↗
            </a>
          </div>
          <div className="grid gap-5">
          <Link href={NSGOODS_PREFLIGHT_V3_EVIDENCE_PATH} className="group block border border-zinc-800 bg-zinc-950/70 p-7 transition-colors hover:border-cyan-500/60">
            <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-widest">
              <span className="text-emerald-300">Passed · fixture-only validation</span>
              <span className="text-zinc-600">2026-09-02</span>
              <span className="text-zinc-600">NSGoods · preflight_v3</span>
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-white group-hover:text-cyan-200">{NSGOODS_PREFLIGHT_V3_EVIDENCE.title}</h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{NSGOODS_PREFLIGHT_V3_EVIDENCE.summary}</p>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-cyan-400">Open validation record →</p>
          </Link>
          <Link href={EXACTZK_EVIDENCE_PATH} className="group block border border-zinc-800 bg-zinc-950/70 p-7 transition-colors hover:border-cyan-500/60">
            <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-widest">
              <span className="text-emerald-300">Published · independently verified</span>
              <span className="text-zinc-600">2026-09-01</span>
              <span className="text-zinc-600">ExactZK · EZKL 23.0.5</span>
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-white group-hover:text-cyan-200">{EXACTZK_EVIDENCE.title}</h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{EXACTZK_EVIDENCE.summary}</p>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-cyan-400">Open evidence record →</p>
          </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-900 px-6 py-14 sm:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Typed bridge contracts</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Connect domains without transferring validity by metaphor.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-500">Each guide defines the evidence, terminology, units, uncertainty, and machine selector required on both sides. No bridge is itself evidence that the connected claims are true.</p>
          <div className="mt-7 grid gap-4 md:grid-cols-2">{crossDomainClearingGuides.map((guide) => <Link key={guide.path} href={guide.path} className="group border border-zinc-800 bg-zinc-950/60 p-5 hover:border-violet-500/60"><p className="font-mono text-[9px] uppercase tracking-widest text-violet-300">Method-only bridge</p><h3 className="mt-3 font-semibold text-white group-hover:text-violet-200">{guide.title}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{guide.question}</p></Link>)}</div>
        </div>
      </section>
    </main>
  )
}
