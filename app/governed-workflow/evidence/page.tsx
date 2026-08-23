// app/governed-workflow/evidence/page.tsx
// Server component: the operator view renders scenarios that run at build time
// against the real engine, so what a reader sees is engine output rather than
// hand-written illustration. No 'use client' and no fetch — there is nothing
// live to fetch, and pretending otherwise would misrepresent a prototype.

import React from 'react';
import Link from 'next/link';

import { sanitizeEvidence, sanitizeTimeline } from '@/lib/governed-workflow/audit';
import { verifyEventChain } from '@/lib/governed-workflow/engine';
import { GWSG_EVIDENCE } from '@/lib/governed-workflow/fixtures';
import { runAllScenarios } from '@/lib/governed-workflow/scenarios';
import { GWSG_SCHEMA_VERSION } from '@/lib/governed-workflow/types';

const SITE_URL = 'https://www.mahastrategies.com';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Governed Workflow evidence — worked scenarios | Maha Strategies',
  description:
    'A read-only operator view over a governed, evidence-bounded workflow state graph. Ten worked scenarios rendered from engine output. Synthetic evaluation corpus: metadata, digests and policy decisions only, with no source document content retained.',
  alternates: { canonical: '/governed-workflow/evidence' },
  robots: { index: true, follow: true },
};

const CAPTION = 'Synthetic evaluation corpus — not a customer result — evaluation-grade prototype, not a compliance certification.';

function Digest({ value }: { value: string | null }) {
  if (!value) return <span className="text-[var(--text-muted)]">—</span>;
  const short = value.replace('sha256:', '').slice(0, 12);
  return (
    <code title={value} className="font-mono text-xs text-[var(--text-secondary)]">
      {short}…
    </code>
  );
}

/**
 * A terminal state is not the same kind of fact as a halted one, so the chip
 * modifier carries that distinction rather than a decorative colour.
 */
const STATE_TONE: Record<string, string> = {
  closed: 'verified', approved: 'verified', action_completed: 'verified', action_authorized: 'verified',
  denied: 'unverified', failed_final: 'unverified', expired: 'boundary', replay_blocked: 'boundary',
  needs_human_review: 'boundary', failed_recoverable: 'boundary',
};

function StateChip({ state }: { state: string }) {
  const tone = STATE_TONE[state];
  return <span className={`evidence-chip${tone ? ` evidence-chip--${tone}` : ''}`}>{state}</span>;
}

export default function GovernedWorkflowEvidencePage() {
  const scenarios = runAllScenarios();
  const evidence = sanitizeEvidence([GWSG_EVIDENCE.claimForm, GWSG_EVIDENCE.policyDocument, GWSG_EVIDENCE.assessorNote]);

  return (
    <main className="evidence-page">
      <div className="evidence-container">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3">
            <span><Link href="/governed-workflow" className="evidence-link">Governed Workflow State Graph</Link> · Evidence</span>
            <span>Schema {GWSG_SCHEMA_VERSION}</span>
          </p>
          <h1 className="evidence-title evidence-title--product">Worked scenarios</h1>
          <p className="evidence-lede mt-7">
            Ten scenarios run against the real engine at build time, so what you read below is engine output rather
            than illustration. Each shows what was decided, what evidence the decision was bound to, what remained
            uncertain, who approved it, and how an interrupted run recovers.
          </p>
        </header>

        <section className="evidence-section" aria-labelledby="evidence-boundary">
          <div className="evidence-inset" style={{ borderLeftColor: 'var(--status-boundary)' }}>
            <h2 id="evidence-boundary" className="evidence-card-title">{CAPTION}</h2>
            <p className="evidence-copy mt-4">
              Every workflow below is invented for evaluation. No real claim, claimant, document, reviewer, or payment is
              involved. This is not a deployed enterprise control plane, and it makes no payments and calls no providers —
              side effects are recorded as an intent plus a receipt, and the middle is simulated.
            </p>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="shows-heading">
          <p className="evidence-kicker">Retention</p>
          <h2 id="shows-heading" className="evidence-section-title mt-4">What this view shows and does not show</h2>
          <p className="evidence-copy mt-5">
            The durable event shape has no field that can hold document text. What an operator sees is references, digests,
            bounded classifications and caller-supplied labels — enough to audit a decision without reading the file it was
            made about.
          </p>

          <h3 className="evidence-card-title mt-9">Evidence in the reference workflow</h3>
          <div className="evidence-table-wrap mt-4">
            <table className="evidence-table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Digest</th>
                  <th scope="col">Bytes</th>
                  <th scope="col">Established</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((entry) => (
                  <tr key={entry.evidenceId}>
                    <td><code className="font-mono text-xs">{entry.evidenceId}</code></td>
                    <td>{entry.kind}</td>
                    <td><Digest value={entry.contentSha256} /></td>
                    <td className="is-numeric">{entry.contentBytes.toLocaleString()}</td>
                    <td>structure + digest form only</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="evidence-copy mt-5">
            A digest commits two parties to the same bytes. It does <strong>not</strong> establish that those bytes are
            true, that the document is authentic, or that any provider executed anything. Those three properties are
            recorded as <code className="font-mono text-xs">false</code> on every reference, because this prototype does not verify them.
          </p>
        </section>

        <section className="evidence-section" aria-labelledby="timelines-heading">
          <p className="evidence-kicker">Engine output</p>
          <h2 id="timelines-heading" className="evidence-section-title mt-4">Scenario timelines</h2>
          <p className="evidence-copy mt-5">
            Each timeline below is produced by running the engine, not written by hand. The chain-integrity column is
            recomputed for every render.
          </p>

          {scenarios.map((scenario) => {
            const timeline = sanitizeTimeline(scenario.timeline);
            const integrity = verifyEventChain(scenario.timeline);
            return (
              <article key={scenario.scenarioId} className="mt-10 border-t border-[var(--border-subtle)] pt-6">
                <h3 className="evidence-card-title flex flex-wrap items-center gap-3">
                  {scenario.title} <StateChip state={scenario.instance.currentState} />
                </h3>
                <p className="evidence-card-copy mt-3">{scenario.demonstrates}</p>
                <p className="evidence-kicker mt-4 flex flex-wrap gap-x-5 gap-y-2">
                  <span>Recovery: {scenario.recovery.classification}</span>
                  <span>Chain integrity: {integrity.valid ? 'verified' : `broken at ${integrity.brokenAt}`}</span>
                  {scenario.recovery.lastSafeCheckpoint ? <span>Last safe checkpoint: {scenario.recovery.lastSafeCheckpoint.state}</span> : null}
                </p>
                <div className="evidence-table-wrap mt-4">
                  <table className="evidence-table">
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Transition</th>
                        <th scope="col">Actor</th>
                        <th scope="col">Uncertainty</th>
                        <th scope="col">Authorization</th>
                        <th scope="col">Approval</th>
                        <th scope="col">Evidence set</th>
                        <th scope="col">Reason codes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeline.map((event) => (
                        <tr key={event.transitionSha256}>
                          <td className="is-numeric">{event.sequence}</td>
                          <td className="whitespace-nowrap">
                            <StateChip state={event.priorState} /> <span className="text-[var(--text-muted)]">→</span> <StateChip state={event.nextState} />
                          </td>
                          <td>{event.actor.actorRole}</td>
                          <td>{event.uncertaintyStatus}</td>
                          <td>{event.authorizationResult}</td>
                          <td>{event.approvalState}</td>
                          <td><Digest value={event.evidenceSetSha256} /></td>
                          <td><code className="font-mono text-xs">{event.reasonCodes.join(', ')}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </section>

        <section className="evidence-section" aria-labelledby="schemas-heading">
          <p className="evidence-kicker">Machine-readable</p>
          <h2 id="schemas-heading" className="evidence-section-title mt-4">Schemas and documentation</h2>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 font-mono text-xs uppercase tracking-widest">
            <a href={`/schemas/governed-workflow/transition-${GWSG_SCHEMA_VERSION}.json`} className="evidence-link">Transition record schema ↗</a>
            <a href={`/schemas/governed-workflow/evidence-reference-${GWSG_SCHEMA_VERSION}.json`} className="evidence-link">Evidence reference schema ↗</a>
            <a href={`/schemas/governed-workflow/state-graph-${GWSG_SCHEMA_VERSION}.json`} className="evidence-link">Reference state graph schema ↗</a>
            <Link href="/docs" className="evidence-link">Documentation index ↗</Link>
          </div>
        </section>

        <p className="evidence-kicker mt-16 border-t border-[var(--border-default)] pt-5">
          {CAPTION} Schema version {GWSG_SCHEMA_VERSION}.
        </p>
      </div>
    </main>
  );
}
