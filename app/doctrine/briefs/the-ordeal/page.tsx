import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'The Ordeal: Earned Identity | Doctrine',
  description: 'An operational framework for establishing authentic identity through hormetic stress, witnessed capacity, and deliberate neurological adaptation.',
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "The Ordeal: Earned Identity",
    "description": "An operational framework for establishing authentic identity through hormetic stress, witnessed capacity, and deliberate neurological adaptation.",
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
          [ TACTICAL BRIEF 09 // THE.ORDEAL ]
        </p>
        <h1 className="text-4xl text-white font-light tracking-wide uppercase leading-tight m-0">
          The Ordeal: Earned Identity
        </h1>
      </header>

      {/* Prose Matrix */}
      <article className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed space-y-6">
        <p>
          Identity is cheap in the modern world. You can list any credential in a bio without demonstrating it. You can claim any value without living it. The Maha Individual rejects the self-assigned identity. The title is earned through demonstrated capacity, not through agreement with the philosophy.
        </p>

        <p>
          The Ordeal is the principle by which that earning happens. Once—to enter the identity—and annually—to renew it. Its specific form scales to the individual, but its structure is consistent: you choose a challenge at the genuine edge of your current capacity, not comfortably within it. You complete it in the presence of others who can witness both the attempt and the completion. You finish.
        </p>

        {/* Biological Mechanism Block */}
        <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-sm my-8">
          <h3 className="font-mono text-xs text-indigo-500 uppercase tracking-widest mb-4 m-0 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full inline-block"></span>
            BIOLOGICAL MECHANISM: HORMESIS
          </h3>
          <p className="text-sm text-zinc-400 m-0 mb-4">
            A hormetic response is the beneficial adaptation produced by exposure to a controlled stressor at a dose that would be harmful if sustained but is adaptive when applied acutely and followed by adequate recovery.
          </p>
          <ul className="list-none pl-0 space-y-2 font-mono text-[11px] text-zinc-500 uppercase tracking-wider m-0">
            <li>// MODERATE EXERCISE: Triggers repair and structural overcompensation.</li>
            <li>// COLD EXPOSURE: Triggers noradrenaline release and mitochondrial biogenesis.</li>
            <li>// CONTROLLED FASTING: Triggers autophagy and improved insulin sensitivity.</li>
          </ul>
        </div>

        <p>
          In each case, the stress is the signal. The adaptation is the response. The Ordeal is hormesis applied at the neurological and psychological level: a deliberately engineered acute stressor designed to force the system to overcompensate—to build the specific callus that only forms when you have passed through something genuinely hard and chose not to stop.
        </p>

        <p>
          For one person this is completing something they have been avoiding for years—the business registration, the medical appointment, the difficult conversation that has been accumulating weight. The Ordeal is not always physical; its signature is the moment you considered stopping and continued anyway. 
        </p>
        
        <p>
          For another, it is twenty-four hours of water fasting combined with a sustained physical load—a long march carrying weight, or six hours of continuous manual labor. For another, it is five days in the wilderness alone with nothing to read and no device. The form is secondary. 
        </p>

        <p className="text-zinc-200 font-medium border-l-2 border-indigo-500 pl-4 italic my-8 text-lg">
          The witness is not—the Ordeal is completed in front of someone who knows what you were attempting and can confirm that you did not stop when stopping became attractive.
        </p>

        <p>
          The function of the Ordeal is not punishment. It is the specific neurological and psychological process by which a human being discovers what they are made of under conditions they did not design and cannot control. 
        </p>

        <p>
          The moment when the glycogen is depleted, the body is uncomfortable, and the mind begins suggesting reasons to stop—and you keep going anyway—is the moment the callus forms. That callus is not physical. It is the knowledge, confirmed by experience rather than assumed by belief, that you can endure what you need to endure.
        </p>
      </article>

      {/* Footer System Anchor */}
      <footer className="mt-16 pt-8 border-t border-zinc-900 text-center font-mono text-[10px] text-zinc-600 tracking-widest">
        SYSTEM MONITOR: RUNNING // NEUROLOGICAL.CALLUS.FORMED
      </footer>
    </main>
  );
}