import type { Metadata } from 'next'
import Link from 'next/link'

import { TrackedLink } from '@/components/ConversionTracker'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'MPS Evidence Audit | Maha Strategies',
  description: 'Make an AI-assisted report, manuscript, or public-facing document reviewable before it reaches publication, governance, or a consequential decision.',
  alternates: { canonical: '/evidence-audit' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/evidence-audit`,
    title: 'MPS Evidence Audit | Maha Strategies',
    description: 'A claim register, verification backlog, and evidence record for AI-assisted documents that must withstand review.',
    images: [{ url: '/og-evidence-audit.png', width: 1792, height: 1024, alt: 'MPS Evidence Audit — Make the document defensible' }],
  },
}

const outcomes = [
  ['Claim register', 'A reviewable inventory of substantive claims, their evidence status, and the work still owed.'],
  ['Verification backlog', 'A prioritized record of source checks, corrections, and decisions needed before the document moves forward.'],
  ['Publication-readiness record', 'A clear separation between sourced material, verified material, interpretation, and unresolved claims.'],
]

const buyers = [
  'Research and policy teams preparing a report that others will cite or scrutinize.',
  'Communications teams using AI-assisted drafting for externally consequential publications.',
  'Publishers and organizations that need to improve a document’s evidence trail before review.',
]

export default function EvidenceAuditPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <div className="mx-auto max-w-4xl px-6 py-20 sm:py-28">
        <section className="max-w-3xl">
          <p className="mb-5 font-mono text-[10px] uppercase tracking-widest text-indigo-400">[ Maha Provenance Standard // Evidence Audit ]</p>
          <h1 className="text-4xl font-light leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl">Make the document defensible before it reaches review.</h1>
          <p className="mt-7 text-xl font-light leading-relaxed text-zinc-300 sm:text-2xl">An MPS Evidence Audit turns an AI-assisted report, manuscript, or public-facing document into a reviewable record of what is sourced, verified, interpreted, and still unresolved.</p>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">This is not generic AI writing advice or a polished summary. It is an evidence workflow for work your organization must be able to stand behind.</p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <TrackedLink href="/mps/preflight" event="cta_evidence_audit_preflight" className="inline-block bg-white px-7 py-4 text-center font-mono text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-zinc-200">Run a Private Preflight — $49 ↗</TrackedLink>
            <TrackedLink href="/contact?service=mps_evidence_audit" event="cta_evidence_audit_scope" className="inline-block border border-zinc-600 px-7 py-4 text-center font-mono text-xs font-bold uppercase tracking-widest text-zinc-100 transition-colors hover:border-white hover:text-white">Request an Evidence Audit ↗</TrackedLink>
          </div>
          <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Start self-service for a defined extract. Scope a human audit for a high-stakes document.</p>
        </section>

        <section className="mt-24 border-t border-zinc-800 pt-10">
          <p className="mb-8 font-mono text-[10px] uppercase tracking-widest text-indigo-400">[ The outcome ]</p>
          <div className="grid gap-5 md:grid-cols-3">
            {outcomes.map(([title, body], index) => <article key={title} className="border border-zinc-800 p-6"><p className="font-mono text-[10px] tracking-widest text-indigo-300">0{index + 1}</p><h2 className="mt-5 text-xl text-white">{title}</h2><p className="mt-3 text-sm leading-relaxed text-zinc-400">{body}</p></article>)}
          </div>
        </section>

        <section className="mt-24 grid gap-10 border-t border-zinc-800 pt-10 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-5 font-mono text-[10px] uppercase tracking-widest text-indigo-400">[ Who it is for ]</p>
            <h2 className="text-3xl font-light text-white">For documents where a fluent answer is not enough.</h2>
          </div>
          <ul className="space-y-4 text-sm leading-relaxed text-zinc-400">
            {buyers.map((buyer) => <li key={buyer} className="border-l border-indigo-500 pl-4">{buyer}</li>)}
          </ul>
        </section>

        <section className="mt-24 border border-indigo-900/50 bg-indigo-950/20 p-8 sm:p-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ A clear path ]</p>
          <div className="mt-7 grid gap-6 md:grid-cols-3">
            <div><p className="font-mono text-xs text-indigo-200">01</p><h2 className="mt-3 text-lg text-white">Test the extract</h2><p className="mt-2 text-sm leading-relaxed text-zinc-400">Use the private preflight for a bounded claim map and verification backlog.</p></div>
            <div><p className="font-mono text-xs text-indigo-200">02</p><h2 className="mt-3 text-lg text-white">Scope the review</h2><p className="mt-2 text-sm leading-relaxed text-zinc-400">We define the document, reviewer context, source constraints, deliverable, price, and timing.</p></div>
            <div><p className="font-mono text-xs text-indigo-200">03</p><h2 className="mt-3 text-lg text-white">Resolve what matters</h2><p className="mt-2 text-sm leading-relaxed text-zinc-400">Receive the agreed evidence record and a clear view of what is ready, conditional, or unresolved.</p></div>
          </div>
        </section>

        <section className="mt-24 border-t border-zinc-800 pt-10">
          <p className="max-w-2xl text-lg font-light leading-relaxed text-zinc-300">The method is public: MPS makes the epistemic status of substantive claims explicit and machine-readable. An audit applies that discipline to the document in front of you.</p>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-4 font-mono text-xs uppercase tracking-widest"><Link href="/audit" className="text-zinc-300 hover:text-white">Try the free auditor ↗</Link><Link href="/mps" className="text-zinc-400 hover:text-white">Read MPS/0.1 ↗</Link><Link href="/mps/preflight/example" className="text-zinc-400 hover:text-white">See a sample report ↗</Link></div>
        </section>
      </div>
    </main>
  )
}
