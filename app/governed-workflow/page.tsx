// app/governed-workflow/page.tsx
// Product page. Deliberately short: the technical detail and the ten worked
// scenarios live at /governed-workflow/evidence, so a buyer deciding whether
// this is relevant does not have to read an engine trace to find out.
// Server component — no 'use client', nothing live to fetch.

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
    <main style={{ maxWidth: '48rem', margin: '0 auto', padding: '2.5rem 1.25rem 4rem', color: '#1c2430', lineHeight: 1.6 }}>
      <p style={{ fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8c2f2f', margin: 0 }}>
        Evaluation prototype
      </p>
      <h1 style={{ fontSize: '2.1rem', margin: '0.35rem 0 0.85rem', lineHeight: 1.18 }}>Governed Workflow State Graph</h1>
      <p style={{ fontSize: '1.1rem', color: '#3d4a5c', margin: '0 0 0.85rem' }}>
        A governed, evidence-bounded record of <strong>one</strong> regulated decision — what was decided, on what
        evidence, under which policy, approved by whom, and whether a retry could repeat an effect.
      </p>
      <p style={{ color: '#3d4a5c', margin: 0 }}>
        It is not an agent memory store and not an autonomous runner. It decides and records; it never acts. Every
        side effect is an intent plus a receipt, and in this release the middle is simulated.
      </p>

      <div style={{ border: '1px solid #e0d3b8', background: '#fdf8ec', padding: '0.85rem 1rem', borderRadius: '4px', margin: '1.75rem 0' }}>
        <strong style={{ display: 'block', marginBottom: '0.3rem' }}>{CAPTION}</strong>
        <span style={{ fontSize: '0.92rem', color: '#4a4231' }}>
          The published corpus is invented for evaluation. No real claim, claimant, document, reviewer, or payment is
          involved. This release is not connected to payment: it makes no payments, calls no providers, and dispatches
          no messages.
        </span>
      </div>

      <section aria-labelledby="workflow-fit">
        <h2 id="workflow-fit" style={{ fontSize: '1.35rem', margin: '0 0 0.3rem' }}>Where it fits</h2>
        <p style={{ margin: 0, color: '#3d4a5c' }}>
          For a workflow where an organisation must later answer: what was decided, what evidence was in scope, which
          policy applied, who approved it, and whether a retry could repeat an effect.
        </p>
        <dl style={{ margin: '1rem 0 0' }}>
          {FITS.map((entry) => (
            <div key={entry.title} style={{ borderTop: '1px solid #eef1f4', padding: '0.7rem 0' }}>
              <dt style={{ fontWeight: 600 }}>{entry.title}</dt>
              <dd style={{ margin: '0.2rem 0 0', color: '#4a5566' }}>{entry.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="guarantees" style={{ marginTop: '2.25rem' }}>
        <h2 id="guarantees" style={{ fontSize: '1.35rem', margin: '0 0 0.3rem' }}>What it guarantees</h2>
        <p style={{ margin: 0, color: '#3d4a5c' }}>
          Each of these is enforced by the shape of the model rather than by convention, and each is covered by a test
          that attacks it.
        </p>
        <ul style={{ paddingLeft: '1.15rem', margin: '0.8rem 0 0' }}>
          {GUARANTEES.map(([claim, detail]) => (
            <li key={claim} style={{ marginBottom: '0.55rem' }}>
              <strong>{claim}</strong>{' '}
              <span style={{ color: '#4a5566' }}>{detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="evaluation-walkthrough" style={{ marginTop: '2.25rem' }}>
        <h2 id="evaluation-walkthrough" style={{ fontSize: '1.35rem', margin: '0 0 0.3rem' }}>A bounded evaluation walkthrough</h2>
        <ol style={{ paddingLeft: '1.25rem', margin: '0.75rem 0 0' }}>
          <li><strong>Choose one decision.</strong> For example: approve a claim exception, approve a supplier change, or authorize an agent to prepare—not execute—an action.</li>
          <li><strong>Declare the boundary.</strong> Required evidence references, policy version, approval role, allowed operation, stop conditions, and retention constraints.</li>
          <li><strong>Run the workflow twice.</strong> The normal path, and one adverse path such as changed evidence, expired approval, denied policy, or an interrupted action.</li>
          <li><strong>Review the evidence.</strong> Hash-chained transitions, reason codes, approval binding, uncertainty state, and recovery classification.</li>
          <li><strong>Decide what would be required next.</strong> A production design needs the customer’s identity, storage, key-management, retention, integration, and control-owner decisions. This prototype does not supply them.</li>
        </ol>
        <p style={{ marginTop: '0.9rem' }}>
          <Link href="/contact">Discuss a bounded evaluation</Link>
          {' '}for a customer-shaped workflow. No source documents, provider credentials, payment authority, or live effects are needed for the initial review.
        </p>
      </section>

      <section aria-labelledby="see-for-yourself" style={{ marginTop: '2.25rem', borderTop: '1px solid #e4e8ee', paddingTop: '1.5rem' }}>
        <h2 id="see-for-yourself" style={{ fontSize: '1.35rem', margin: '0 0 0.5rem' }}>See it for yourself</h2>
        <ul style={{ paddingLeft: '1.15rem', margin: 0 }}>
          <li>
            <Link href="/governed-workflow/evidence">Ten worked scenarios</Link> — the normal approved path, denied
            policy, uncertainty, approval expiry, changed evidence, duplicate replay, interrupted recovery, attempted
            bypass, policy conflict, and the metadata-only audit guarantee. Rendered from engine output.
          </li>
          <li>
            <a href={`/schemas/governed-workflow/transition-${GWSG_SCHEMA_VERSION}.json`}>Transition</a>,{' '}
            <a href={`/schemas/governed-workflow/evidence-reference-${GWSG_SCHEMA_VERSION}.json`}>evidence reference</a>, and{' '}
            <a href={`/schemas/governed-workflow/state-graph-${GWSG_SCHEMA_VERSION}.json`}>state graph</a> schemas.
          </li>
          <li><Link href="/docs">API documentation</Link> — the demo surface is stateless and accepts metadata only.</li>
        </ul>
      </section>

      <section aria-labelledby="honest-status" style={{ marginTop: '2.25rem' }}>
        <h2 id="honest-status" style={{ fontSize: '1.35rem', margin: '0 0 0.5rem' }}>What this is not, yet</h2>
        <p style={{ margin: 0, color: '#4a5566' }}>
          No external audit, no certification, and no production deployment. The reference store is in-memory. Digests
          are accepted from the caller, so the engine cannot detect a caller that supplies a digest for bytes it does
          not hold. The event chain is tamper-evident but unsigned. Connecting a real disbursement is deliberately
          future work, not an omission.
        </p>
      </section>

      <p style={{ marginTop: '2.25rem', fontSize: '0.86rem', color: '#6a7280', borderTop: '1px solid #e4e8ee', paddingTop: '1rem' }}>
        {CAPTION} Schema version {GWSG_SCHEMA_VERSION}.
      </p>
    </main>
  );
}
