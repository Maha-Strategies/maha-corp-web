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
  return {
    metadataBase: new URL(SITE_URL),
    title: `${brief.title} | Intelligence | Maha Strategies`,
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

  const url = `${SITE_URL}/intelligence/briefs/${brief.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: brief.title,
    description: brief.description,
    author: { '@type': 'Organization', name: 'Maha Strategies LLC', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'Maha Strategies LLC',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
    },
    datePublished: brief.datePublished,
    dateModified: brief.dateModified ?? brief.datePublished,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
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
                  Strategic Audit
                </h3>
                <p className="font-serif text-xs text-gray-400 mb-4">
                  Deploy a systemic audit aligned to this brief&rsquo;s domain.
                </p>
                <Link href="/consulting" className="block text-center border border-gray-600 bg-gray-900 text-white font-mono text-[10px] tracking-widest py-3 hover:bg-white hover:text-black transition-colors uppercase">
                  Initiate Audit &#8599;
                </Link>
              </div>

              <div className="p-6 border border-indigo-900/50 bg-indigo-950/10">
                <h3 className="font-sans text-sm font-bold text-indigo-400 uppercase tracking-widest mb-2">
                  Maha OS Alpha
                </h3>
                <p className="font-serif text-xs text-gray-400 mb-4">
                  Enforce the Zero-Payload Policy on local device hardware.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <a href="https://apps.apple.com/us/app/maha-os/id6778333838" target="_blank" rel="noopener noreferrer" className="block text-center border border-indigo-500 text-indigo-400 font-mono text-[10px] tracking-widest py-3 hover:bg-indigo-500 hover:text-white transition-colors uppercase">
                    iOS Client &#8595;
                  </a>
                  <a href="https://play.google.com/store/apps/details?id=com.maha.os" target="_blank" rel="noopener noreferrer" className="block text-center border border-indigo-500 text-indigo-400 font-mono text-[10px] tracking-widest py-3 hover:bg-indigo-500 hover:text-white transition-colors uppercase">
                    Android Client &#8595;
                  </a>
                </div>
                <a href="https://maha-os.com" target="_blank" rel="noopener noreferrer" className="block text-center border border-neutral-800 bg-neutral-900/50 text-neutral-400 font-mono text-[9px] tracking-widest py-2 hover:bg-neutral-800 hover:text-white transition-colors uppercase">
                  View Source Documentation &#8599;
                </a>
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