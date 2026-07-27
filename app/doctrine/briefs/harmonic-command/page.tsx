import React from 'react';
import Link from 'next/link';
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

export const metadata = {
  title: 'The Harmonic Command: Leadership as Enablement | Doctrine',
  description: 'An operational critique of brittle centralization, structural trust, and governance frameworks that optimize for systemic emergence.',
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "The Harmonic Command: Leadership as Enablement",
    "description": "An operational critique of brittle centralization, structural trust, and governance frameworks that optimize for systemic emergence.",
    "proficiencyLevel": "Expert",
    "publisher": { "@id": MAHA_ORGANIZATION_ID },
    "datePublished": "2026-05-29"
  };

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans p-8 md:p-24 selection:bg-indigo-500 selection:text-white max-w-3xl mx-auto">
      {/* AI Agent / SEO Crawler Payload */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Navigation Layer */}
      <div className="mb-12">
        <Link 
          href="/doctrine" 
          className="font-mono text-xs uppercase tracking-widest text-indigo-500 hover:text-indigo-400 transition-colors no-underline flex items-center gap-2"
        >
          ← ESCAPE TO DOCTRINE ROOT
        </Link>
      </div>

      {/* Header Block */}
      <header className="border-b border-zinc-800 pb-8 mb-12">
        <p className="font-mono text-xs text-indigo-500 uppercase tracking-widest mb-3">
          [ TACTICAL BRIEF 06 // HARMONIC.COMMAND ]
        </p>
        <h1 className="text-4xl text-white font-light tracking-wide uppercase leading-tight m-0">
          The Harmonic Command:<br />Leadership as Enablement
        </h1>
      </header>

      {/* Prose Matrix */}
      <article className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed space-y-6">
        <p>
          We usually imagine a strong leader as a soloist—the figure who plays every instrument themselves, who demands total submission to their tempo, who controls every variable. This model produces order, but brittle order: a system that depends entirely on the energy and judgment of one person, collapses when that person is wrong, and kills the initiative of everyone around them.
        </p>

        {/* Structural Paradox Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-sm">
            <h3 className="font-mono text-xs text-rose-500 uppercase tracking-widest mb-2 m-0">
              // THE SOLOIST Archetype
            </h3>
            <p className="text-sm text-zinc-400 m-0">
              Demands comprehensive micromanagement and absolute synchronization to a single point of failure. The layout feels secure but crumbles under high-velocity complexity.
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-sm">
            <h3 className="font-mono text-xs text-indigo-500 uppercase tracking-widest mb-2 m-0">
              // THE CONDUCTOR Archetype
            </h3>
            <p className="text-sm text-zinc-400 m-0">
              Makes no native sound. Holds no single instrument. Establishes context, baseline values, and temporal boundaries—then leaves execution to autonomous, specialized components.
            </p>
          </div>
        </div>

        <p>
          Watch a great conductor at work. They make no sound. They hold no instrument. They do not play the music—they make the music possible. Their power is not domination but enablement. They establish the tempo and the key—the vision and the values—and then trust the expertise in the room to do what expertise does. They listen. They adjust. They hold the structure that allows others to improvise within it.
        </p>

        <p className="text-zinc-200 font-medium border-l-2 border-indigo-500 pl-4 italic my-8 text-lg">
          This is what we call Harmonic Command.
        </p>

        <p>
          A leader operating with Harmonic Command creates a pocket—a space of sufficient safety, clarity, and resource—in which the people they are responsible for can function at their best. They do not micromanage the individual performance. They create the conditions for it.
        </p>

        <p>
          In complex music, there is a quality that separates the technically correct from the genuinely alive. A recording can have every note in place and still feel mechanical—grid-locked. A master track breathes. It has what musicians call <em>swing</em>: it operates on a structure, but it moves against that structure with a human touch. It is precise without being rigid. It invites response rather than demanding compliance.
        </p>
        
        <p>
          This is the distinction between governance that manages people and governance that serves them. The grid-locked system demands that the human conform to the metric. The harmonic system builds a structure that serves the human and trusts them to produce the metric as a consequence.
        </p>
      </article>

      {/* Footer System Anchor */}
      <footer className="mt-16 pt-8 border-t border-zinc-900 text-center font-mono text-[10px] text-zinc-600 tracking-widest">
        SYSTEM MONITOR: RUNNING // EMERGENCE.PROTOCOL.ENABLED
      </footer>
    </main>
  );
}