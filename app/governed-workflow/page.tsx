// app/governed-workflow/page.tsx
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
  title: 'Governed Workflow State Graph — evaluation prototype | Maha Strategies',
  description:
    'A read-only operator view over a governed, evidence-bounded workflow state graph. Synthetic evaluation corpus: metadata, digests and policy decisions only, with no source document content retained.',
  alternates: { canonical: '/governed-workflow' },
  robots: { index: true, follow: true },
};

const CAPTION = 'Synthetic evaluation corpus — not a customer result — evaluation-grade prototype, not a compliance certification.';

function Digest({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: '#8a8a8a' }}>—</span>;
  const short = value.replace('sha256:', '').slice(0, 12);
  return (
    <code title={value} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.78rem', color: '#3d4a5c' }}>
      {short}…
    </code>
  );
}

const STATE_TONE: Record<string, string> = {
  closed: '#1f6f43', approved: '#1f6f43', action_completed: '#1f6f43', action_authorized: '#1f6f43',
  denied: '#8c2f2f', failed_final: '#8c2f2f', expired: '#8a5a1f', replay_blocked: '#8a5a1f',
  needs_human_review: '#8a5a1f', failed_recoverable: '#8a5a1f',
};

function StateChip({ state }: { state: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '0.1rem 0.45rem', borderRadius: '3px', fontSize: '0.76rem',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      background: '#f1f3f6', color: STATE_TONE[state] ?? '#3d4a5c', border: '1px solid #dfe3e9',
    }}>{state}</span>
  );
}

export default function GovernedWorkflowPage() {
  const scenarios = runAllScenarios();
  const evidence = sanitizeEvidence([GWSG_EVIDENCE.claimForm, GWSG_EVIDENCE.policyDocument, GWSG_EVIDENCE.assessorNote]);

  return (
    <main style={{ maxWidth: '62rem', margin: '0 auto', padding: '2.5rem 1.25rem 4rem', color: '#1c2430', lineHeight: 1.55 }}>
      <p style={{ fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8c2f2f', margin: 0 }}>
        Evaluation prototype
      </p>
      <h1 style={{ fontSize: '2rem', margin: '0.35rem 0 0.75rem', lineHeight: 1.2 }}>Governed Workflow State Graph</h1>
      <p style={{ fontSize: '1.02rem', color: '#3d4a5c', marginTop: 0 }}>
        A governed, evidence-bounded representation of one operational workflow: document approval for a regulated
        decision. It records what was decided, what evidence the decision was bound to, what remained uncertain,
        who approved it, and how an interrupted run recovers.
      </p>

      <div style={{ border: '1px solid #e0d3b8', background: '#fdf8ec', padding: '0.85rem 1rem', borderRadius: '4px', margin: '1.5rem 0' }}>
        <strong style={{ display: 'block', marginBottom: '0.3rem' }}>{CAPTION}</strong>
        <span style={{ fontSize: '0.92rem', color: '#4a4231' }}>
          Every workflow below is invented for evaluation. No real claim, claimant, document, reviewer, or payment is
          involved. This is not a deployed enterprise control plane, and it makes no payments and calls no providers —
          side effects are recorded as an intent plus a receipt, and the middle is simulated.
        </span>
      </div>

      <h2 style={{ fontSize: '1.3rem', marginTop: '2.25rem' }}>What this view shows and does not show</h2>
      <p style={{ marginTop: '0.4rem' }}>
        The durable event shape has no field that can hold document text. What an operator sees is references, digests,
        bounded classifications and caller-supplied labels — enough to audit a decision without reading the file it was
        made about.
      </p>

      <h3 style={{ fontSize: '1.05rem', marginTop: '1.5rem' }}>Evidence in the reference workflow</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.88rem', marginTop: '0.5rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #dfe3e9' }}>
              <th style={{ padding: '0.4rem 0.6rem 0.4rem 0' }}>Reference</th>
              <th style={{ padding: '0.4rem 0.6rem' }}>Kind</th>
              <th style={{ padding: '0.4rem 0.6rem' }}>Digest</th>
              <th style={{ padding: '0.4rem 0.6rem' }}>Bytes</th>
              <th style={{ padding: '0.4rem 0.6rem' }}>Established</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((entry) => (
              <tr key={entry.evidenceId} style={{ borderBottom: '1px solid #eef1f4' }}>
                <td style={{ padding: '0.4rem 0.6rem 0.4rem 0' }}><code style={{ fontSize: '0.82rem' }}>{entry.evidenceId}</code></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>{entry.kind}</td>
                <td style={{ padding: '0.4rem 0.6rem' }}><Digest value={entry.contentSha256} /></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>{entry.contentBytes.toLocaleString()}</td>
                <td style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem', color: '#4a5566' }}>
                  structure + digest form only
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '0.88rem', color: '#4a5566', marginTop: '0.6rem' }}>
        A digest commits two parties to the same bytes. It does <strong>not</strong> establish that those bytes are
        true, that the document is authentic, or that any provider executed anything. Those three properties are
        recorded as <code>false</code> on every reference, because this prototype does not verify them.
      </p>

      <h2 style={{ fontSize: '1.3rem', marginTop: '2.5rem' }}>Scenario timelines</h2>
      <p style={{ marginTop: '0.4rem', color: '#3d4a5c' }}>
        Each timeline below is produced by running the engine, not written by hand. The chain-integrity column is
        recomputed for every render.
      </p>

      {scenarios.map((scenario) => {
        const timeline = sanitizeTimeline(scenario.timeline);
        const integrity = verifyEventChain(scenario.timeline);
        return (
          <section key={scenario.scenarioId} style={{ marginTop: '2rem', borderTop: '1px solid #e4e8ee', paddingTop: '1.25rem' }}>
            <h3 style={{ fontSize: '1.08rem', margin: '0 0 0.2rem' }}>
              {scenario.title} <StateChip state={scenario.instance.currentState} />
            </h3>
            <p style={{ margin: '0.25rem 0 0.75rem', color: '#4a5566', fontSize: '0.92rem' }}>{scenario.demonstrates}</p>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.84rem', color: '#4a5566' }}>
              Recovery: <code>{scenario.recovery.classification}</code>
              {' · '}Chain integrity: <code>{integrity.valid ? 'verified' : `broken at ${integrity.brokenAt}`}</code>
              {scenario.recovery.lastSafeCheckpoint ? <> · Last safe checkpoint: <code>{scenario.recovery.lastSafeCheckpoint.state}</code></> : null}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #dfe3e9' }}>
                    <th style={{ padding: '0.35rem 0.5rem 0.35rem 0' }}>#</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Transition</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Actor</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Uncertainty</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Authorization</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Approval</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Evidence set</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Reason codes</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((event) => (
                    <tr key={event.transitionSha256} style={{ borderBottom: '1px solid #eef1f4' }}>
                      <td style={{ padding: '0.35rem 0.5rem 0.35rem 0' }}>{event.sequence}</td>
                      <td style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap' }}>
                        <StateChip state={event.priorState} /> <span style={{ color: '#9aa4b2' }}>→</span> <StateChip state={event.nextState} />
                      </td>
                      <td style={{ padding: '0.35rem 0.5rem' }}>{event.actor.actorRole}</td>
                      <td style={{ padding: '0.35rem 0.5rem' }}>{event.uncertaintyStatus}</td>
                      <td style={{ padding: '0.35rem 0.5rem' }}>{event.authorizationResult}</td>
                      <td style={{ padding: '0.35rem 0.5rem' }}>{event.approvalState}</td>
                      <td style={{ padding: '0.35rem 0.5rem' }}><Digest value={event.evidenceSetSha256} /></td>
                      <td style={{ padding: '0.35rem 0.5rem' }}>
                        <code style={{ fontSize: '0.78rem' }}>{event.reasonCodes.join(', ')}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <h2 style={{ fontSize: '1.3rem', marginTop: '2.75rem' }}>Schemas and documentation</h2>
      <ul style={{ paddingLeft: '1.15rem' }}>
        <li><a href={`/schemas/governed-workflow/transition-${GWSG_SCHEMA_VERSION}.json`}>Transition record schema</a></li>
        <li><a href={`/schemas/governed-workflow/evidence-reference-${GWSG_SCHEMA_VERSION}.json`}>Evidence reference schema</a></li>
        <li><a href={`/schemas/governed-workflow/state-graph-${GWSG_SCHEMA_VERSION}.json`}>Reference state graph schema</a></li>
        <li><Link href="/docs">Documentation index</Link></li>
      </ul>

      <p style={{ marginTop: '2rem', fontSize: '0.86rem', color: '#6a7280', borderTop: '1px solid #e4e8ee', paddingTop: '1rem' }}>
        {CAPTION} Schema version {GWSG_SCHEMA_VERSION}.
      </p>
    </main>
  );
}
