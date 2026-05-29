import React from 'react';
import Link from 'next/link';

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
          [ TACTICAL BRIEF 07 // ASYMMETRIC.SOUNDSCAPE ]
        </p>
        <h1 className="text-4xl text-white font-light tracking-wide uppercase leading-tight m-0">
          The Asymmetric Soundscape:<br />Learning to Hear the Polyrhythm
        </h1>
      </header>

      {/* Prose Matrix */}
      <article className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed space-y-6">
        <p>
          With the two prerequisites established—fuel and state—we can introduce the navigational framework.
        </p>

        <p>
          In music, a polyrhythm occurs when two or more conflicting time signatures play simultaneously. A drummer's right hand holds a steady 4/4 beat while the left hand plays a jagged 7/8 riff. The beats do not align. They clash and cross and occasionally converge before diverging again. To the untrained ear, this sounds like a mistake—like someone has lost the beat. The instinct is to force one rhythm to submit to the other, to find the one true beat and lock onto it.
        </p>

        <p>
          But the master musician does not try to resolve the polyrhythm. They listen deeper. They hear that beneath the conflicting surface rhythms, there is a mathematical convergence point—a macro-beat that holds the whole structure together. They find that pulse and anchor to it. From there, the complexity is not chaos. It is architecture.
        </p>

        <p className="text-zinc-200 font-medium border-l-2 border-indigo-500 pl-4 italic my-8 text-lg">
          This is the exact structure of the modern environment. 
        </p>

        <ul className="list-none pl-0 space-y-3 font-mono text-xs uppercase tracking-wider text-zinc-400 border-t border-b border-zinc-900 py-4 my-6">
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> The stock market hits record highs—a steady, optimistic 4/4 beat.</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> Your grocery bill has doubled—a grinding, anxious 7/8 riff.</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> Technology connects you to the sum of human knowledge—one beat.</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> Loneliness is at epidemic levels—another, conflicting one.</li>
        </ul>

        <p>
          The official health guidance says one thing. The research literature says something more complicated. The pundits are playing their own instruments with no regard for anyone else's tempo.
        </p>

        {/* Structural Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-sm">
            <h3 className="font-mono text-xs text-rose-500 uppercase tracking-widest mb-2 m-0">
              // THE AMATEUR RESPONSE
            </h3>
            <p className="text-sm text-zinc-400 m-0">
              Forces resolution. Picks one beat, declares it correct, and ignores everything that contradicts it. Produces binary tribal thinking and false clarity—the clarity of a person who has covered their ears.
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-sm">
            <h3 className="font-mono text-xs text-indigo-500 uppercase tracking-widest mb-2 m-0">
              // THE ASYMMETRIC NAVIGATOR
            </h3>
            <p className="text-sm text-zinc-400 m-0">
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
      <footer className="mt-16 pt-8 border-t border-zinc-900 text-center font-mono text-[10px] text-zinc-600 tracking-widest">
        SYSTEM MONITOR: RUNNING // MACRO-PULSE.ISOLATED
      </footer>
    </main>
  );
}