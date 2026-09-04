import type { Metadata } from 'next'
import Link from 'next/link'

import { TrackedLink } from '@/components/ConversionTracker'
import EvidenceAuditScopeForm from '@/components/EvidenceAuditScopeForm'
import { EVIDENCE_WORKFLOW_PATH } from '@/lib/evidence-workflow-examples'

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
    <main className="evidence-page">
      <div className="evidence-container">
        <section className="max-w-3xl">
          <p className="evidence-kicker mb-3">[ Maha Provenance Standard // Evidence Audit ]</p>
          <h1 className="evidence-title evidence-title--product">
            Make the document defensible before it reaches review.
          </h1>
          <p className="evidence-lede mt-7">
            An MPS Evidence Audit turns an AI-assisted report, manuscript, or public-facing document into a reviewable record of what is sourced, verified, interpreted, and still unresolved.
          </p>
          <p className="evidence-copy mt-5 max-w-2xl sm:text-lg">
            This is not generic AI writing advice or a polished summary. It is an evidence workflow for work your organization must be able to stand behind.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <TrackedLink href="/tools/evidence-preflight" event="cta_evidence_audit_structural_preflight" className="evidence-action evidence-action--primary">
              Check three claims for free ↗
            </TrackedLink>
            <TrackedLink href="/mps/preflight" event="cta_evidence_audit_preflight" className="evidence-action evidence-action--secondary">
              Run a private preflight — $49 ↗
            </TrackedLink>
            <TrackedLink href="#scope-an-audit" event="cta_evidence_audit_scope" className="evidence-action evidence-action--secondary">
              Request an evidence audit ↗
            </TrackedLink>
          </div>
          <p className="evidence-kicker mt-5 text-[var(--text-muted)]">Start self-service for a defined extract, and scope a human audit for a high-stakes document.</p>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker mb-3">[ The outcome ]</p>
          <div className="grid gap-5 md:grid-cols-3">
            {outcomes.map(([title, body], index) => (
              <article key={title} className="evidence-card">
                <p className="evidence-kicker">0{index + 1}</p>
                <p className="evidence-card-title mt-3">{title}</p>
                <p className="evidence-card-copy mt-3">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section">
          <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="evidence-kicker mb-3">[ Who it is for ]</p>
              <h2 className="evidence-section-title">For documents where a fluent answer is not enough.</h2>
            </div>
            <ul className="space-y-4 text-sm leading-relaxed text-[var(--text-primary)]">
              {buyers.map((buyer) => <li key={buyer} className="border-l border-[var(--border-emphasis)] pl-4">{buyer}</li>)}
            </ul>
          </div>
        </section>

        <section className="evidence-section">
          <div className="rounded border border-[var(--border-default)] bg-[var(--surface-elevated)] p-8 sm:p-10">
            <p className="evidence-kicker">[ A clear path ]</p>
            <div className="mt-7 grid gap-6 md:grid-cols-3">
              <article className="evidence-card">
                <p className="evidence-kicker">01</p>
                <h2 className="evidence-card-title mt-3">Test the extract</h2>
                <p className="evidence-card-copy mt-2">Use the private preflight for a bounded claim map and verification backlog.</p>
              </article>
              <article className="evidence-card">
                <p className="evidence-kicker">02</p>
                <h2 className="evidence-card-title mt-3">Scope the review</h2>
                <p className="evidence-card-copy mt-2">We define the document, reviewer context, source constraints, deliverable, price, and timing.</p>
              </article>
              <article className="evidence-card">
                <p className="evidence-kicker">03</p>
                <h2 className="evidence-card-title mt-3">Resolve what matters</h2>
                <p className="evidence-card-copy mt-2">Receive the agreed evidence record and a clear view of what is ready, conditional, or unresolved.</p>
              </article>
            </div>
          </div>
        </section>

        <div className="mt-24">
          <EvidenceAuditScopeForm />
        </div>

        <section className="evidence-section">
          <p className="evidence-kicker max-w-2xl">Method statement</p>
          <p className="evidence-copy mt-2">
            The method is public: MPS makes the epistemic status of substantive claims explicit and machine-readable. An audit applies that discipline to the document in front of you.
          </p>
          <div className="mt-7 flex flex-wrap gap-4">
            <Link href="/tools/evidence-preflight" className="evidence-link">Check source readiness deterministically ↗</Link>
            <Link href="/audit" className="evidence-link">Try the free auditor ↗</Link>
            <Link href="/mps" className="evidence-link">Read MPS/0.1 ↗</Link>
            <Link href="/mps/preflight/example" className="evidence-link">See a sample report ↗</Link>
            <Link href={EVIDENCE_WORKFLOW_PATH} className="evidence-link">Work through evidence-to-delivery examples ↗</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
