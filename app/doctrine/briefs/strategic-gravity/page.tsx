import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Strategic Gravity: The Architecture of Tension | Doctrine',
  description: 'An analysis of power, spatial vacuums, and the strategic deployment of tension over reactive high-frequency activity.',
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "Strategic Gravity: The Architecture of Tension",
    "description": "An analysis of power, spatial vacuums, and the strategic deployment of tension over reactive high-frequency activity.",
    "proficiencyLevel": "Expert",
    "publisher": {
      "@type": "Organization",
      "name": "Maha Strategies LLC",
      "url": "https://mahastrategies.com"
    },
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
          [ TACTICAL BRIEF 05 // STRATEGIC.GRAVITY ]
        </p>
        <h1 className="text-4xl text-white font-light tracking-wide uppercase leading-tight m-0">
          Strategic Gravity:<br />The Architecture of Tension
        </h1>
      </header>

      {/* Prose Matrix */}
      <article className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed space-y-6">
        <p>
          There is a persistent misunderstanding about where power comes from. The amateur believes power is the product of volume—maximum activity, maximum noise, maximum visible effort. To be formidable, you must fill every available space.
        </p>

        <p className="text-zinc-200 font-medium border-l-2 border-indigo-500 pl-4 italic my-8 text-lg">
          The master understands the opposite. Power comes from space.
        </p>

        <p>
          In music, the heaviest moment in a piece is not the moment of maximum activity. It is the moment of maximum impact—the drop. But the drop is only possible because of what precedes it. The musicians must have the discipline to hold back, to let tension build, to resist the impulse to fill every beat. They create a vacuum of anticipation. When they finally release—one chord, one beat, one massive impact—the room moves. This is the Architecture of Tension. The power is not in the note. It is in the silence surrounding it.
        </p>

        <p>
          Think of this in terms of frequency:
        </p>

        {/* Frequency Comparison Block */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-sm">
            <h3 className="font-mono text-xs text-rose-500 uppercase tracking-widest mb-2 m-0">
              // HIGH FREQUENCY (TREBLE)
            </h3>
            <p className="text-sm text-zinc-400 m-0">
              Fast, anxious, and short-lived. They dissipate quickly and require constant re-broadcasting to maintain energy. They are the domain of the reactive person: the instant reply, the reflexive comment, the argument that must be won right now.
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-sm">
            <h3 className="font-mono text-xs text-indigo-500 uppercase tracking-widest mb-2 m-0">
              // LOW FREQUENCY (BASS)
            </h3>
            <p className="text-sm text-zinc-400 m-0">
              Slow, physical, and foundational. They sustain. They are the domain of the strategic person: metabolic health, skill depth, long-term relationships, the principles held when it is costly to hold them.
            </p>
          </div>
        </div>

        <p>
          A person operating primarily in the treble range has a high centre of gravity. They are reactive, easily destabilised, vibrating with nervous energy that dissipates before it can accumulate into anything. A person operating from the bass register has a low centre of gravity. They move slowly, but when they move, the room moves with them.
        </p>

        <p>
          Most people are over-playing. They answer every message instantly, respond to every provocation, fill every silence with stimulation. The strategist practices something harder: sitting in tension without breaking it prematurely. 
        </p>
        
        <p>
          When a problem emerges, the treble-heavy person rushes to resolve it with ten small moves that each dissipate energy without changing the underlying structure. The strategic person waits—holds the weight of the uncertainty—until the true nature of the problem becomes legible. Then makes one move. Because they waited, it lands like thunder.
        </p>
      </article>

      {/* Footer System Anchor */}
      <footer className="mt-16 pt-8 border-t border-zinc-900 text-center font-mono text-[10px] text-zinc-600 tracking-widest">
        SYSTEM MONITOR: RUNNING // GRAVIMETRIC.STABILITY.ACHIEVED
      </footer>
    </main>
  );
}