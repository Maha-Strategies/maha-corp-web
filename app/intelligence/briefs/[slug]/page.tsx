// app/intelligence/briefs/[slug]/page.tsx
// SERVER component — generateMetadata works here, which is the canonical fix.
// Renders every BriefSection content type: paragraphs, tables, blockquotes,
// card lists (listItems), section tags, an optional intro block, and the
// protocol patch. ExportButton is shown on every brief.

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  SITE_URL,
  getBriefBySlug,
  getAllBriefSlugs,
  type BriefSection,
} from '@/lib/briefs-data';
import ExportButton from './ExportButton';
import { TrackedLink } from '@/components/ConversionTracker';
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'
import { KNOWLEDGE_KIND_META, knowledgeArticlePath } from '@/lib/knowledge-data'
import { knowledgeSupplierPath } from '@/lib/knowledge-process-profiles'
import {
  getSupportingKnowledgeObjects,
  type IntelligenceKnowledgeRelationship,
} from '@/lib/intelligence-knowledge-links'

const relationshipLabels: Record<IntelligenceKnowledgeRelationship, string> = {
  'technical-foundation': 'Technical foundation',
  'process-dependency': 'Process dependency',
  'risk-control': 'Risk and control',
  'supplier-context': 'Supplier context',
}

export function generateStaticParams() {
  return getAllBriefSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const brief = getBriefBySlug(slug);
  if (!brief) return {};
  const url = `${SITE_URL}/intelligence/briefs/${brief.slug}`;
  const seoTitle = brief.seoTitle ?? `${brief.title} | Intelligence | Maha Strategies`;
  return {
    metadataBase: new URL(SITE_URL),
    title: seoTitle,
    description: brief.description,
    alternates: { canonical: `/intelligence/briefs/${brief.slug}` },
    openGraph: {
      type: 'article',
      url,
      siteName: 'Maha Strategies',
      title: brief.title,
      description: brief.description,
      publishedTime: brief.datePublished,
      modifiedTime: brief.dateModified ?? brief.datePublished,
      images: [{ url: '/og-master.png', width: 1200, height: 630, alt: brief.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: brief.title,
      description: brief.description,
      images: ['/og-master.png'],
    },
  };
}

function SectionBody({ section }: { section: BriefSection }) {
  return (
    <>
      {section.tag && (
        <span className="inline-block font-mono text-[10px] tracking-widest uppercase text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 mb-3 not-prose">
          {section.tag}
        </span>
      )}
      {section.level === 2 ? (
        <h2 className="text-2xl text-white font-sans uppercase tracking-widest border-l-2 border-indigo-500 pl-4 mt-8 mb-6 not-prose">
          {section.heading}
        </h2>
      ) : (
        <h3 className="text-xl text-white font-sans font-bold uppercase tracking-widest mt-12 mb-4">
          {section.heading}
        </h3>
      )}

      {section.paragraphs?.map((p, j) => <p key={j}>{p}</p>)}

      {section.blockquote && (
        <blockquote className="border-l-2 border-neutral-700 pl-4 my-6 text-neutral-400 italic not-prose">
          {section.blockquote}
        </blockquote>
      )}

      {section.listItems && (
        <ul className="space-y-4 font-mono text-sm text-neutral-400 list-none pl-0 my-6 not-prose">
          {section.listItems.map((item, j) => (
            <li key={j} className="border border-neutral-800 p-4 bg-[#111113] leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      )}

      {section.table && (
        <div className="overflow-x-auto border border-neutral-800 bg-[#111113] my-6 not-prose">
          {section.table.caption && (
            <div className="font-mono text-xs tracking-widest text-amber-500 uppercase p-3 border-b border-neutral-800">
              {section.table.caption}
            </div>
          )}
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900 text-neutral-400">
                {section.table.header.map((h, k) => (
                  <th key={k} className="p-3 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {section.table.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className={c === 0 ? 'p-3 font-bold text-white' : 'p-3'}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default async function BriefPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const brief = getBriefBySlug(slug);
  if (!brief) notFound();
  const supportingObjects = getSupportingKnowledgeObjects(brief.slug);
  const supportingKnowledge = supportingObjects.filter((item) => item.objectType === 'knowledge' && item.article !== undefined);
  const supportingSuppliers = supportingObjects.filter((item) => item.objectType === 'supplier' && item.supplier !== undefined);

  const url = `${SITE_URL}/intelligence/briefs/${brief.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: brief.title,
    description: brief.description,
    author: { '@id': MAHA_ORGANIZATION_ID },
    publisher: { '@id': MAHA_ORGANIZATION_ID },
    datePublished: brief.datePublished,
    dateModified: brief.dateModified ?? brief.datePublished,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    isBasedOn: supportingObjects.map((item) => item.objectType === 'knowledge'
      ? `${SITE_URL}${knowledgeArticlePath(item.article!)}`
      : `${SITE_URL}${knowledgeSupplierPath(item.supplier!)}`),
  };

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] py-16 px-6 sm:px-12 selection:bg-indigo-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="max-w-6xl mx-auto">
        <header className="font-mono text-xs sm:text-sm text-gray-500 mb-12 border-b border-gray-800 pb-4 flex justify-between">
          <span>[ INTELLIGENCE BRIEF // ACTIVE AUDIT ]</span>
          <span className="text-red-400">STATUS: {brief.status}</span>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
          <article className="lg:col-span-2 prose prose-invert prose-lg font-serif leading-relaxed text-gray-300 max-w-none">
            <h1 className="font-sans text-3xl sm:text-5xl font-bold tracking-tight mb-4 text-white uppercase not-prose">
              {brief.title}
            </h1>
            <p className="font-mono text-sm text-indigo-400 mb-12 uppercase tracking-widest not-prose">
              {brief.kicker}
            </p>

            {brief.intro && (
              <div className="text-neutral-400 italic border-l-2 border-neutral-700 pl-4 mb-8 not-prose">
                {brief.intro}
              </div>
            )}

            <aside className="border border-zinc-800 bg-zinc-950/60 p-5 mb-10 not-prose">
              <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-2">[ Evidence status ]</p>
              <p className="text-sm text-zinc-400 leading-relaxed mb-3">
                This public brief is Maha Strategies&rsquo; analytical view of an active issue. Use it to frame questions and test assumptions, not as a substitute for source-verified diligence on a live decision.
              </p>
              <div className="flex flex-col sm:flex-row gap-x-5 gap-y-2 font-mono text-[10px] tracking-widest uppercase">
                <Link href="/consulting" className="text-indigo-300 hover:text-white transition-colors">Request a source-tagged brief ↗</Link>
                <Link href="/mps" className="text-zinc-500 hover:text-white transition-colors">How MPS classifies claims ↗</Link>
              </div>
            </aside>

            {supportingObjects.length > 0 && (
              <aside className="border border-cyan-900/60 bg-cyan-950/10 p-5 mb-10 not-prose">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-mono text-[10px] text-cyan-300 tracking-widest uppercase">[ Supporting Knowledge graph ]</p>
                  <span className="border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-cyan-200">
                    {relationshipLabels[supportingObjects[0].relationship]}
                  </span>
                </div>
                <p className="mt-4 text-sm text-zinc-400 leading-relaxed">
                  {supportingObjects[0].rationale}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {supportingKnowledge.map(({ article }) => (
                    <Link key={article!.id} href={knowledgeArticlePath(article!)} className="border border-zinc-800 bg-zinc-950/70 p-4 hover:border-cyan-500/50 transition-colors">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">{KNOWLEDGE_KIND_META[article!.kind].label}</span>
                      <span className="mt-2 block text-sm font-semibold text-white">{article!.shortTitle} →</span>
                      <span className="mt-2 block text-xs leading-5 text-zinc-500">{article!.description}</span>
                    </Link>
                  ))}
                </div>
                {supportingSuppliers.length > 0 && (
                  <div className="mt-5 border-t border-zinc-800 pt-5">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">Supplier capability context</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {supportingSuppliers.map(({ supplier }) => (
                        <Link key={supplier!.id} href={knowledgeSupplierPath(supplier!)} className="border border-zinc-800 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-zinc-400 hover:border-cyan-500/50 hover:text-cyan-200 transition-colors">
                          {supplier!.name} →
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            )}

            {brief.sections.map((section, i) => (
              <SectionBody key={i} section={section} />
            ))}

            {brief.protocolPatch && (
              <div className="p-6 my-8 border border-gray-800 bg-black/40 not-prose">
                <h4 className="font-sans font-bold text-sm text-red-400 mb-2 uppercase tracking-widest">
                  {brief.protocolPatch.title}
                </h4>
                {brief.protocolPatch.paragraphs.map((p, j) => (
                  <p key={j} className="font-serif text-gray-400 mt-2">{p}</p>
                ))}
                {brief.protocolPatch.emphasis && (
                  <p className="font-serif text-white mt-4 font-bold">{brief.protocolPatch.emphasis}</p>
                )}
              </div>
            )}
          </article>

          <aside className="lg:col-span-1">
            <div className="sticky top-12 space-y-8">
              <div className="p-6 border border-gray-800 bg-black">
                <h3 className="font-sans text-sm font-bold text-white uppercase tracking-widest mb-2">
                  Need a focused answer first?
                </h3>
                <p className="font-serif text-xs text-gray-400 mb-4">
                  Commission a Rapid Intelligence Brief for one defined market, technology, or policy question — a concise memo with stated assumptions and linked sources, delivered within five business days.
                </p>
                <TrackedLink href="/rapid-intelligence-brief" event="cta_brief_rapid_intelligence" className="block text-center border border-gray-600 bg-gray-900 text-white font-mono text-[10px] tracking-widest py-3 hover:bg-white hover:text-black transition-colors uppercase">
                  Rapid Intelligence Brief · From $500 &#8599;
                </TrackedLink>
                <Link href="/consulting" className="block mt-3 text-center text-neutral-400 font-mono text-[9px] tracking-widest hover:text-white transition-colors uppercase">
                  Need full diligence? View the Verified Research Brief &#8599;
                </Link>
              </div>

              <div className="p-6 border border-indigo-900/50 bg-indigo-950/10">
                <h3 className="font-sans text-sm font-bold text-indigo-400 uppercase tracking-widest mb-2">
                  Test the evidence method
                </h3>
                <p className="font-serif text-xs text-gray-400 mb-4">
                  Paste a passage into the Maha Provenance Auditor to see how claims are classified before they become decisions.
                </p>
                <Link href="/audit" className="block text-center border border-indigo-500 text-indigo-400 font-mono text-[10px] tracking-widest py-3 hover:bg-indigo-500 hover:text-white transition-colors uppercase">
                  Run the Live Auditor &#8599;
                </Link>
                <Link href="/mps" className="block mt-3 text-center text-neutral-400 font-mono text-[9px] tracking-widest hover:text-white transition-colors uppercase">
                  Read the MPS/0.1 standard &#8599;
                </Link>
              </div>

              <ExportButton />
            </div>
          </aside>
        </div>

        <div className="mt-20 pt-8 border-t border-gray-900 text-center">
          <Link href="/intelligence" className="font-mono text-xs text-gray-600 hover:text-white transition-colors uppercase tracking-widest">
            [ &larr; Return to Intelligence Grid ]
          </Link>
        </div>
      </div>
    </main>
  );
}
