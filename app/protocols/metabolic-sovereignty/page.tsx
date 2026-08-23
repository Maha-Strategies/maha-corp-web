'use client';

import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';

export default function AlgorithmicTranceProtocol() {
  return (
    <main className="evidence-page">
      <div className="evidence-container">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3">
            <span>[SYSTEM DOCTRINE]</span>
            <span>Maha Strategies · Protocol Node v2.0</span>
          </p>
          <h1 className="evidence-title evidence-title--product mt-5">The Algorithmic Trance &amp; Metabolic Sovereignty</h1>
          <div className="evidence-inset mt-8">
            <p className="evidence-kicker">Vector: Cognitive Extraction and Substrate Defense</p>
            <p className="evidence-copy mt-3">Status: Active</p>
            <p className="evidence-copy mt-3">A protocol for structured attention control, token-safe telemetry framing, and substrate-level resilience.</p>
          </div>
        </header>

        <article className="evidence-section">
          <h2 className="evidence-section-title mt-0">I. The Mathematics of Attentional Captivity</h2>
          <p className="evidence-copy mt-5">
            For decades, the technology sector has categorized distraction as a psychological failing. The prevailing narrative operates on a false premise: if you cannot sustain deep work, your executive function lacks discipline.
            Willpower is not the governing control primitive for engineered environments.
          </p>
          <p className="mt-6 font-medium text-[var(--text-primary)]">We are not experiencing distraction; we are operating under attentional capture.</p>
          <p className="evidence-copy mt-4">
            The platforms we interact with are high-frequency extraction systems, not neutral tools. Infinite-scroll loops can become measurable physiological pressure that degrades clarity and increases cognitive load.
          </p>

          <p className="evidence-copy mt-6">
            A local edge-compute defense can estimate this shift with a readiness heuristic:
          </p>

          <div className="evidence-code my-6 border rounded-sm p-5 text-center">
            <BlockMath math="Readiness\ Score = \frac{RHR_{baseline}}{RHR_{current}} \times (1 - V_{interaction})" />
          </div>

          <p className="evidence-copy mt-5">
            When the ratio drifts below your accepted threshold, a forced intervention posture is required before trust boundaries are reopened.
          </p>
          <p className="evidence-copy mt-5">
            In that boundary state, passive prompts are insufficient; the protocol requires explicit state transitions and explicit recovery checks before operations resume.
          </p>

          <h2 className="evidence-section-title mt-10">II. Metabolic Purity: The Substrate of Sovereignty</h2>
          <p className="evidence-copy mt-5">
            There is a fatal architectural blind spot in modern systems design: technology optimization is treated independently from the operator’s biological substrate.
            A resilient platform must optimize both.
          </p>
          <ul className="evidence-copy mt-5 list-disc space-y-3 pl-6 marker:text-[var(--text-muted)]">
            <li><strong>The Incentive Check:</strong> Is the input shaped by incentive structures that benefit from dependency?</li>
            <li><strong>The Biological Check:</strong> Does the input improve or degrade state quality over time?</li>
            <li><strong>The Source Check:</strong> Are the producers also exposed to the same effects?</li>
          </ul>
          <p className="evidence-copy mt-5">This is not a wellness doctrine; it is an operations-first control model for sustained cognition.</p>
        </article>

        <section className="evidence-section">
          <div className="evidence-inset">
            <p className="evidence-kicker">Operational bridge</p>
            <p className="evidence-copy mt-3">
              You can use this protocol as a reference for local gating behavior and recovery checks where model output, operator state, and operational continuity intersect.
            </p>
            <a
              href="https://play.google.com/store/apps/details?id=com.maha.os"
              target="_blank"
              rel="noopener noreferrer"
              className="evidence-link mt-6 inline-block"
            >
              Deploy local kinetic intervention tool ↗
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
