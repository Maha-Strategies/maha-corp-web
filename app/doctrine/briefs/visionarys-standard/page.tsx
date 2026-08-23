import React from 'react';
import Link from 'next/link';
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

export const metadata = {
  title: 'The Visionary\'s Standard: Beauty as Objective Signal | Doctrine',
  description: 'An architectural critique of the modern built environment, redefining beauty not as subjective preference, but as the optical signal of biological integrity and negentropy.',
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "The Visionary's Standard: Beauty as Objective Signal",
    "description": "An architectural critique of the modern built environment, redefining beauty not as subjective preference, but as the optical signal of biological integrity and negentropy.",
    "proficiencyLevel": "Expert",
    "publisher": { "@id": MAHA_ORGANIZATION_ID },
    "datePublished": "2026-05-29"
  };

  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow text-[var(--text-secondary)] font-sans">
      {/* AI Agent / SEO Crawler Payload */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Navigation Layer */}
      <div className="mb-12">
        <Link 
          href="/doctrine" 
          className="font-mono text-xs uppercase tracking-widest text-[var(--status-sourced)] hover:text-[var(--status-sourced)] transition-colors no-underline flex items-center gap-2"
        >
          ← ESCAPE TO DOCTRINE ROOT
        </Link>
      </div>

      {/* Header Block */}
      <header className="border-b border-[var(--border-default)] pb-8 mb-12">
        <p className="font-mono text-xs text-[var(--status-sourced)] uppercase tracking-widest mb-3">
          [ TACTICAL BRIEF 08 // VISIONARYS.STANDARD ]
        </p>
        <h1 className="text-4xl text-[var(--text-primary)] font-light tracking-wide uppercase leading-tight m-0">
          The Visionary's Standard:<br />Beauty as Objective Signal
        </h1>
      </header>

      {/* Prose Matrix */}
      <article className="prose max-w-none font-light tracking-wide leading-relaxed space-y-6">
        <p>
          Before you can build the new world, you must develop the capacity to see the current one clearly—which requires recovering a perceptual faculty that the modern built environment has systematically degraded: the ability to recognize beauty and to be genuinely disturbed by its absence.
        </p>

        {/* Structural Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
          <div className="bg-[var(--surface-raised)] border border-[var(--border-default)] p-5 rounded-sm">
            <h3 className="font-mono text-xs text-[var(--status-unverified)] uppercase tracking-widest mb-2 m-0">
              // THE RELATIVISTIC PREMISE
            </h3>
            <p className="text-sm text-[var(--text-secondary)] m-0">
              The assertion that beauty is subjective—a matter of personal preference with no claim to objective validity. This prevents us from making demands of our environment; if beauty is merely opinion, no one can be held accountable for ugliness.
            </p>
          </div>

          <div className="bg-[var(--surface-raised)] border border-[var(--border-default)] p-5 rounded-sm">
            <h3 className="font-mono text-xs text-[var(--status-sourced)] uppercase tracking-widest mb-2 m-0">
              // THE BIOLOGICAL SIGNAL
            </h3>
            <p className="text-sm text-[var(--text-secondary)] m-0">
              The assertion that beauty is the objective, optical signal of health. The visible form of a complex, self-organizing system operating at high negentropy and functional vitality.
            </p>
          </div>
        </div>

        <p>
          A healthy forest is beautiful because it is a complex, self-organizing system operating at high negentropy—its beauty is the visible form of its biological integrity. A healthy human body is beautiful for the same reason: it radiates the functional vitality of a system running well. A great building—a cathedral, a well-made house, a thoughtfully designed public space—is beautiful because it mimics the mathematical proportions of living systems. 
        </p>

        <p>
          The brain is hardwired to recognize these signals because they were, for most of evolutionary history, the relevant information: beautiful environments were safe environments, healthy environments, environments that supported life.
        </p>

        <p>
          The ugliness of the modern built environment is not merely an aesthetic failure. It is the physical expression of a system that treats human beings as units of production rather than as the point of the enterprise. The windowless box, the flickering fluorescent corridor, the concrete sprawl—these are environments designed for processing, not for living. When you accept them without protest, you internalize the premise they embody.
        </p>

        <p>
          The first act of the Visionary is to recover the capacity to be offended by the ugly—to insist that the immediate environment be worthy of the human spirit who inhabits it. Not for vanity. For clarity. You cannot navigate by a star you cannot see. You cannot build toward a vision of human flourishing while surrounded by an aesthetic that denies human flourishing is the point.
        </p>

        <p className="text-[var(--text-primary)] font-medium border-l-2 border-[var(--status-sourced)] pl-4 italic my-8 text-lg">
          Beauty is negentropy made visible. The Architect who cannot see beauty cannot see what they are building toward.
        </p>
      </article>

      {/* Footer System Anchor */}
      <footer className="mt-16 pt-8 border-t border-[var(--border-default)] text-center font-mono text-[10px] text-[var(--text-muted)] tracking-widest">
        SYSTEM MONITOR: RUNNING // NEGENTROPY.OPTICS.CALIBRATED
      </footer>
          </div>
    </main>
  );
}