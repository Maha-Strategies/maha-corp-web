import React from 'react';
import Link from 'next/link';
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

export const metadata = {
  title: 'From Consumer to Producer: The Active Citizen | Doctrine',
  description: 'An operational framework for transitioning from passive consumption to active production, skill redundancy, and the gradual reduction of systemic dependency.',
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "From Consumer to Producer: The Active Citizen",
    "description": "An operational framework for transitioning from passive consumption to active production, skill redundancy, and the gradual reduction of systemic dependency.",
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
          [ TACTICAL BRIEF 10 // ACTIVE.CITIZEN ]
        </p>
        <h1 className="text-4xl text-[var(--text-primary)] font-light tracking-wide uppercase leading-tight m-0">
          From Consumer to Producer:<br />The Active Citizen
        </h1>
      </header>

      {/* Prose Matrix */}
      <article className="prose max-w-none font-light tracking-wide leading-relaxed space-y-6">
        <p>
          The modern economy has spent decades training citizens to be passive consumers of civilization rather than active participants in it. The implicit deal: surrender your agency and competence, and we will provide convenience. The result is a population that is physically adult and functionally dependent—waiting to be fed, waiting to be secured, waiting to be entertained.
        </p>

        <p>
          The Maha community rejects this. The Active Citizen does not ask who will solve the problem. They ask what tools they need to solve it themselves. They are not defined by what they purchase but by what they can build, grow, repair, and teach.
        </p>

        <p>
          For most people, this transition happens while still operating within conventional employment. The path is not immediate escape from the economic mainstream but the gradual construction of an alternative while navigating the existing system with clear eyes.
        </p>

        {/* Strategic Principle Block */}
        <div className="bg-[var(--surface-raised)] border border-[var(--border-default)] p-6 rounded-sm my-8">
          <h3 className="font-mono text-xs text-[var(--status-sourced)] uppercase tracking-widest mb-2 m-0 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[var(--status-sourced)] rounded-full inline-block"></span>
            THE GOVERNING PRINCIPLE
          </h3>
          <p className="text-lg text-[var(--text-primary)] font-medium italic m-0 mb-4">
            Sell excellence, keep loyalty.
          </p>
          <p className="text-sm text-[var(--text-secondary)] m-0">
            Deliver genuinely high-quality work to whoever employs you—the Theology of Craft applies regardless of whether the work feels meaningful. Reserve your deeper loyalty for the household and the community. View the employment relationship accurately: you are a contractor selling services to a client, using the income and skill development to fund the construction of the Stronghold.
          </p>
        </div>

        <p>
          The job is not the destination. It is one of the mine shafts you are working while building toward something else.
        </p>

        <p>
          As individual competence and community mutual reliance deepen, the dependency on the conventional system narrows. The household that grows some of its own food is less exposed to food price volatility. The community with genuine skill redundancy is less dependent on expensive external services. The group with shared assets is less vulnerable to individual economic shocks.
        </p>

        <p className="text-[var(--text-primary)] font-medium border-l-2 border-[var(--status-sourced)] pl-4 italic my-8 text-lg">
          The reduction in dependency is gradual and cumulative—the same compound integrity that governs the individual protocols governs the community's economic evolution.
        </p>
      </article>

      {/* Footer System Anchor */}
      <footer className="mt-16 pt-8 border-t border-[var(--border-default)] text-center font-mono text-[10px] text-[var(--text-muted)] tracking-widest">
        SYSTEM MONITOR: RUNNING // DEPENDENCY.REDUCTION.ACTIVE
      </footer>
          </div>
    </main>
  );
}