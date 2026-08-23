import React from 'react';
import Link from 'next/link';
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

export const metadata = {
  title: 'The Asymmetric Soundscape: Learning to Hear the Polyrhythm | Doctrine',
  description: 'An analysis of polyrhythmic environments, signal resolution, and anchoring to physical and biological realities over narrative chaos.',
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "The Asymmetric Soundscape: Learning to Hear the Polyrhythm",
    "description": "An analysis of polyrhythmic environments, signal resolution, and anchoring to physical and biological realities over narrative chaos.",
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
          [ TACTICAL BRIEF 07 // ASYMMETRIC.SOUNDSCAPE ]
        </p>
        <h1 className="text-4xl text-[var(--text-primary)] font-light tracking-wide uppercase leading-tight m-0">
          The Asymmetric Soundscape:<br />Learning to Hear the Polyrhythm
        </h1>
      </header>

      {/* Prose Matrix */}
      <article className="prose max-w-none font-light tracking-wide leading-relaxed space-y-6">
        <p>
          With the two prerequisites established—fuel and state—we can introduce the navigational framework.
        </p>

        <p>
          In music, a polyrhythm occurs when two or more conflicting time signatures play simultaneously. A drummer's right hand holds a steady 4/4 beat while the left hand plays a jagged 7/8 riff. The beats do not align. They clash and cross and occasionally converge before diverging again. To the untrained ear, this sounds like a mistake—like someone has lost the beat. The instinct is to force one rhythm to submit to the other, to find the one true beat and lock onto it.
        </p>

        <p>
          But the master musician does not try to resolve the polyrhythm. They listen deeper. They hear that beneath the conflicting surface rhythms, there is a mathematical convergence point—a macro-beat that holds the whole structure together. They find that pulse and anchor to it. From there, the complexity is not chaos. It is architecture.
        </p>

        <p className="text-[var(--text-primary)] font-medium border-l-2 border-[var(--status-sourced)] pl-4 italic my-8 text-lg">
          This is the exact structure of the modern environment. 
        </p>

        <ul className="list-none pl-0 space-y-3 font-mono text-xs uppercase tracking-wider text-[var(--text-secondary)] border-t border-b border-[var(--border-default)] py-4 my-6">
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[var(--status-sourced)] rounded-full"></span> The stock market hits record highs—a steady, optimistic 4/4 beat.</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[var(--status-sourced)] rounded-full"></span> Your grocery bill has doubled—a grinding, anxious 7/8 riff.</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[var(--status-sourced)] rounded-full"></span> Technology connects you to the sum of human knowledge—one beat.</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[var(--status-sourced)] rounded-full"></span> Loneliness is at epidemic levels—another, conflicting one.</li>
        </ul>

        <p>
          The official health guidance says one thing. The research literature says something more complicated. The pundits are playing their own instruments with no regard for anyone else's tempo.
        </p>

        {/* Structural Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
          <div className="bg-[var(--surface-raised)] border border-[var(--border-default)] p-5 rounded-sm">
            <h3 className="font-mono text-xs text-[var(--status-unverified)] uppercase tracking-widest mb-2 m-0">
              // THE AMATEUR RESPONSE
            </h3>
            <p className="text-sm text-[var(--text-secondary)] m-0">
              Forces resolution. Picks one beat, declares it correct, and ignores everything that contradicts it. Produces binary tribal thinking and false clarity—the clarity of a person who has covered their ears.
            </p>
          </div>

          <div className="bg-[var(--surface-raised)] border border-[var(--border-default)] p-5 rounded-sm">
            <h3 className="font-mono text-xs text-[var(--status-sourced)] uppercase tracking-widest mb-2 m-0">
              // THE ASYMMETRIC NAVIGATOR
            </h3>
            <p className="text-sm text-[var(--text-secondary)] m-0">
              Does not wait for the polyrhythm to resolve into a simple pop song. Listens for the hidden macro-pulse that organizes the apparent chaos—and anchors there.
            </p>
          </div>
        </div>

        <p>
          Finding the macro-pulse requires asking a different kind of question. Not: <em>which narrative is correct?</em> But: <em>what physical reality underlies all of these conflicting narratives?</em> Not: <em>who is winning the argument?</em> But: <em>what is actually happening to actual people in actual bodies?</em> 
        </p>

        <p>
          The stable signal is almost always biological and material—the price of protein, the energy level of the population, the actual condition of the soil. These are the beats that do not lie.
        </p>
      </article>

      {/* Footer System Anchor */}
      <footer className="mt-16 pt-8 border-t border-[var(--border-default)] text-center font-mono text-[10px] text-[var(--text-muted)] tracking-widest">
        SYSTEM MONITOR: RUNNING // MACRO-PULSE.ISOLATED
      </footer>
          </div>
    </main>
  );
}