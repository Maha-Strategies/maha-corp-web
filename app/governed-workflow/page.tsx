// app/governed-workflow/page.tsx
// Product page. Deliberately short: the technical detail and the ten worked
// scenarios live at /governed-workflow/evidence, so a buyer deciding whether
// this is relevant does not have to read an engine trace to find out.
// Server component — no 'use client', nothing live to fetch.
//
// On the shared paper system: the page previously carried its own inline
// palette, which is exactly what made the product surfaces read as separate
// products. Copy and claims are unchanged.

import React from 'react';
import Link from 'next/link';

import { GWSG_SCHEMA_VERSION } from '@/lib/governed-workflow/types';

const SITE_URL = 'https://www.mahastrategies.com';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Governed Workflow State Graph | Maha Strategies',
  description:
    'A governed, evidence-bounded record of one regulated decision: what was decided, on what evidence, under which policy, approved by whom, and whether a retry could repeat an effect. Evaluation-grade prototype on a synthetic corpus.',
  alternates: { canonical: '/governed-workflow' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/governed-workflow`,
    siteName: 'Maha Strategies',
    title: 'Governed Workflow State Graph',
    description:
      'Bind a decision to the exact evidence set and policy version that produced it. Regulated approvals, procurement, claims, and agentic actions.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Governed Workflow State Graph' }],
  },
};

const CAPTION = 'Synthetic evaluation corpus — not a customer result — evaluation-grade prototype, not a compliance certification.';

const FITS = [
  {
    title: 'Regulated approvals',
    body: 'Bind a reviewer’s approval to one policy version, one input, and one evidence set — so a later policy change or a revised document cannot silently inherit it.',
  },
  {
    title: 'Procurement',
    body: 'Require a bounded approval before an agent may prepare a purchase action, and make a lower-level exception incapable of widening what a tenant-level policy forbids.',
  },
  {
    title: 'Claims and policy review',
    body: 'Adjudicate against a named evidence set, with unresolved questions declared rather than absorbed into the decision.',
  },
  {
    title: 'Agentic actions',
    body: 'Record the intended effect, the receipt, the uncertainty, and the recovery path — so a retry after an interruption cannot quietly become a second effect.',
  },
];

const GUARANTEES = [
  ['Approvals bind, or they do not apply.', 'The approval is addressed by its content — instance, transition, policy version, input digest, evidence digest set. Change the evidence and the old approval is not found rather than silently reused.'],
  ['A repeat is not a re-run.', 'The same idempotency key returns the original record and produces no second intent. A repeat with changed material inputs is rejected outright.'],
  ['Uncertainty is declared, not absorbed.', 'A blocking or unresolved question routes to a human. A signed exception cannot override it.'],
  ['An escalation can be resolved — only by a human.', 'Agents are refused. Terminal states are shut to everyone.'],
  ['Documents stay outside the record.', 'The durable event shape has no field that can hold source text. What is retained is references, digests, bounded classifications, and caller-supplied labels.'],
];

export default function GovernedWorkflowProductPage() {
  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3">
            <span>Evaluation prototype</span>
            <span>Schema {GWSG_SCHEMA_VERSION}</span>
          </p>
          <h1 className="evidence-title evidence-title--product">Governed Workflow State Graph</h1>
          <p className="evidence-lede mt-7">
            A governed, evidence-bounded record of <strong>one</strong> regulated decision — what was decided, on what
            evidence, under which policy, approved by whom, and whether a retry could repeat an effect.
          </p>
          <p className="evidence-copy mt-5">
            It is not an agent memory store and not an autonomous runner. It decides and records; it never acts. Every
            side effect is an intent plus a receipt, and in this release the middle is simulated.
          </p>
        </header>

        <section className="evidence-section" aria-labelledby="boundary-heading">
          <div className="evidence-inset" style={{ borderLeftColor: 'var(--status-boundary)' }}>
            <h2 id="boundary-heading" className="evidence-card-title">{CAPTION}</h2>
            <p className="evidence-copy mt-4">
              The published corpus is invented for evaluation. No real claim, claimant, document, reviewer, or payment is
              involved. This release is not connected to payment: it makes no payments, calls no providers, and dispatches
              no messages.
            </p>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="workflow-fit">
          <p className="evidence-kicker">Where it fits</p>
          <h2 id="workflow-fit" className="evidence-section-title mt-4">Four decisions this is shaped for.</h2>
          <p className="evidence-copy mt-5">
            For a workflow where an organisation must later answer: what was decided, what evidence was in scope, which
            policy applied, who approved it, and whether a retry could repeat an effect.
          </p>
          <div className="mt-9 grid gap-4 md:grid-cols-2">
            {FITS.map((entry) => (
              <article key={entry.title} className="evidence-card">
                <h3 className="evidence-card-title">{entry.title}</h3>
                <p className="evidence-card-copy mt-3">{entry.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="guarantees">
          <p className="evidence-kicker">What it guarantees</p>
          <h2 id="guarantees" className="evidence-section-title mt-4">Enforced by shape, not by convention.</h2>
          <p className="evidence-copy mt-5">
            Each of these is enforced by the shape of the model rather than by convention, and each is covered by a test
            that attacks it.
          </p>
          <dl className="mt-9 flex flex-col">
            {GUARANTEES.map(([claim, detail]) => (
              <div key={claim} className="border-t border-[var(--border-subtle)] py-4 last:border-b">
                <dt className="text-[var(--text-primary)]" style={{ fontWeight: 600 }}>{claim}</dt>
                <dd className="evidence-card-copy mt-2">{detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="evidence-section" aria-labelledby="evaluation-walkthrough">
          <p className="evidence-kicker">Five steps</p>
          <h2 id="evaluation-walkthrough" className="evidence-section-title mt-4">A bounded evaluation walkthrough</h2>
          <ol className="mt-9 flex flex-col">
            {[
              ['Choose one decision.', 'For example: approve a claim exception, approve a supplier change, or authorize an agent to prepare—not execute—an action.'],
              ['Declare the boundary.', 'Required evidence references, policy version, approval role, allowed operation, stop conditions, and retention constraints.'],
              ['Run the workflow twice.', 'The normal path, and one adverse path such as changed evidence, expired approval, denied policy, or an interrupted action.'],
              ['Review the evidence.', 'Hash-chained transitions, reason codes, approval binding, uncertainty state, and recovery classification.'],
              ['Decide what would be required next.', 'A production design needs the customer’s identity, storage, key-management, retention, integration, and control-owner decisions. This prototype does not supply them.'],
            ].map(([step, detail], index) => (
              <li key={step} className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-t border-[var(--border-subtle)] py-4 last:border-b">
                <span className="evidence-kicker pt-1">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <strong className="text-[var(--text-primary)]">{step}</strong>{' '}
                  <span className="evidence-card-copy">{detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="evidence-copy mt-7">
            <Link href="/contact" className="evidence-link">Discuss a bounded evaluation</Link>
            {' '}for a customer-shaped workflow. No source documents, provider credentials, payment authority, or live effects are needed for the initial review.
          </p>
        </section>

        <section className="evidence-section" aria-labelledby="see-for-yourself">
          <p className="evidence-kicker">Machine-readable evidence</p>
          <h2 id="see-for-yourself" className="evidence-section-title mt-4">See it for yourself</h2>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            <Link href="/governed-workflow/evidence" className="evidence-card group flex flex-col">
              <p className="evidence-kicker">Worked scenarios</p>
              <h3 className="evidence-card-title mt-3">Ten scenarios, rendered from engine output</h3>
              <p className="evidence-card-copy mt-3 flex-1">
                The normal approved path, denied policy, uncertainty, approval expiry, changed evidence, duplicate replay,
                interrupted recovery, attempted bypass, policy conflict, and the metadata-only audit guarantee.
              </p>
              <span className="evidence-kicker mt-5 text-[var(--text-primary)]">Read the evidence ↗</span>
            </Link>
            <article className="evidence-card flex flex-col">
              <p className="evidence-kicker">JSON Schema</p>
              <h3 className="evidence-card-title mt-3">Transition, evidence, state graph</h3>
              <p className="evidence-card-copy mt-3 flex-1">Emitted from the same constants the engine enforces.</p>
              <span className="mt-5 flex flex-wrap gap-x-4 gap-y-2 font-mono text-xs uppercase tracking-widest">
                <a href={`/schemas/governed-workflow/transition-${GWSG_SCHEMA_VERSION}.json`} className="evidence-link">Transition ↗</a>
                <a href={`/schemas/governed-workflow/evidence-reference-${GWSG_SCHEMA_VERSION}.json`} className="evidence-link">Evidence reference ↗</a>
                <a href={`/schemas/governed-workflow/state-graph-${GWSG_SCHEMA_VERSION}.json`} className="evidence-link">State graph ↗</a>
              </span>
            </article>
            <Link href="/docs" className="evidence-card group flex flex-col">
              <p className="evidence-kicker">API</p>
              <h3 className="evidence-card-title mt-3">API documentation</h3>
              <p className="evidence-card-copy mt-3 flex-1">The demo surface is stateless and accepts metadata only.</p>
              <span className="evidence-kicker mt-5 text-[var(--text-primary)]">Open the docs ↗</span>
            </Link>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="honest-status">
          <p className="evidence-kicker">Known limits</p>
          <h2 id="honest-status" className="evidence-section-title mt-4">What this is not, yet</h2>
          <p className="evidence-copy mt-5">
            No external audit, no certification, and no production deployment. The reference store is in-memory. Digests
            are accepted from the caller, so the engine cannot detect a caller that supplies a digest for bytes it does
            not hold. The event chain is tamper-evident but unsigned. Connecting a real disbursement is deliberately
            future work, not an omission.
          </p>
        </section>

        <p className="evidence-kicker mt-16 border-t border-[var(--border-default)] pt-5">
          {CAPTION} Schema version {GWSG_SCHEMA_VERSION}.
        </p>
      </div>
    </main>
  );
}
