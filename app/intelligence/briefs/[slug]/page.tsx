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
import styles from '../../intelligence-cyber-light.module.css';
import { semanticForStatus } from '../../status-semantics';
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

const STATUS_CHIP: Record<string, string> = {
  verified: styles.chipVerified,
  sourced: styles.chipSourced,
  boundary: styles.chipBoundary,
  illustrative: styles.chipIllustrative,
  unverified: styles.chipUnverified,
};

function SectionBody({ section }: { section: BriefSection }) {
  return (
    <>
      {section.tag && (
        <span className={`${styles.chip} ${styles.chipBoundary} mb-3 not-prose`}>
          {section.tag}
        </span>
      )}
      {section.level === 2 ? (
        <h2 className={`${styles.sectionHeading} not-prose`}>{section.heading}</h2>
      ) : (
        <h3 className={styles.subHeading}>{section.heading}</h3>
      )}

      {section.paragraphs?.map((p, j) => <p key={j}>{p}</p>)}

      {section.blockquote && (
        <blockquote className={`${styles.quote} not-prose`}>{section.blockquote}</blockquote>
      )}

      {section.listItems && (
        <ul className={`${styles.listPanel} not-prose`}>
          {section.listItems.map((item, j) => (
            <li key={j} className={styles.listItem}>{item}</li>
          ))}
        </ul>
      )}

      {section.table && (
        <div className={`${styles.dataPanel} not-prose`}>
          {section.table.caption && (
            <div className={styles.dataPanelHeading}>{section.table.caption}</div>
          )}
          <div className={styles.dataScroll}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  {section.table.header.map((h, k) => (
                    <th key={k}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.table.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className={styles.shellNarrow}>
        <header className={`${styles.header} mb-12 flex flex-wrap justify-between gap-3`}>
          <span className={styles.metaMuted}>[ INTELLIGENCE BRIEF // ACTIVE AUDIT ]</span>
          <span className={`${styles.chip} ${STATUS_CHIP[semanticForStatus(brief.status)]}`}>
            STATUS: {brief.status}
          </span>
        </header>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-16">
          <article className={`${styles.prose} prose prose-lg font-serif leading-relaxed lg:col-span-1`}>
            <h1 className={`${styles.briefTitle} mb-4 not-prose`}>{brief.title}</h1>
            <p className={`${styles.meta} mb-12 not-prose`}>{brief.kicker}</p>

            {brief.intro && (
              <div className={`${styles.quote} mb-8 not-prose`}>{brief.intro}</div>
            )}

            <aside className={`${styles.statusPanel} ${styles.statusPanelSourced} not-prose`}>
              <p className={styles.panelLabel}>[ Evidence status ]</p>
              <p className={`${styles.panelCopy} mt-2 mb-3`}>
                This public brief is Maha Strategies&rsquo; analytical view of an active issue. Use it to frame questions and test assumptions, not as a substitute for source-verified diligence on a live decision.
              </p>
              <div className="flex flex-col gap-x-5 gap-y-2 sm:flex-row">
                <Link href="/consulting" className={styles.quietLink}>Request a source-tagged brief &#8599;</Link>
                <Link href="/mps" className={styles.quietLink}>How MPS classifies claims &#8599;</Link>
              </div>
            </aside>

            {supportingObjects.length > 0 && (
              <aside className={`${styles.statusPanel} ${styles.statusPanelIllustrative} not-prose`}>
                <div className="flex flex-wrap items-center gap-3">
                  <p className={styles.panelLabel}>[ Supporting Knowledge graph ]</p>
                  <span className={`${styles.chip} ${styles.chipIllustrative}`}>
                    {relationshipLabels[supportingObjects[0].relationship]}
                  </span>
                </div>
                <p className={`${styles.panelCopy} mt-4`}>{supportingObjects[0].rationale}</p>
                <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
                  {supportingKnowledge.map(({ article }) => (
                    <Link key={article!.id} href={knowledgeArticlePath(article!)} className={styles.tile}>
                      <span className={styles.category}>{KNOWLEDGE_KIND_META[article!.kind].label}</span>
                      <span className={`${styles.tileTitle} mt-2 block`}>{article!.shortTitle} &rarr;</span>
                      <span className={`${styles.tileCopy} mt-2 block`}>{article!.description}</span>
                    </Link>
                  ))}
                </div>
                {supportingSuppliers.length > 0 && (
                  <div className={`${styles.sectionRule} mt-5 pt-5`}>
                    <p className={styles.metaMuted}>Supplier capability context</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {supportingSuppliers.map(({ supplier }) => (
                        <Link key={supplier!.id} href={knowledgeSupplierPath(supplier!)} className={`${styles.action} ${styles.actionInline}`}>
                          {supplier!.name} &rarr;
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
              <div className={`${styles.statusPanel} ${styles.statusPanelUnverified} my-8 not-prose`}>
                <h4 className={styles.panelLabel}>{brief.protocolPatch.title}</h4>
                {brief.protocolPatch.paragraphs.map((p, j) => (
                  <p key={j} className={`${styles.panelCopy} mt-2 font-serif`}>{p}</p>
                ))}
                {brief.protocolPatch.emphasis && (
                  <p className="mt-4 font-serif font-bold text-[var(--text-primary)]">{brief.protocolPatch.emphasis}</p>
                )}
              </div>
            )}
          </article>

          <aside className="lg:col-span-1">
            <div className="sticky top-12 space-y-8">
              <div className={styles.sidePanel}>
                <h3 className={`${styles.sidePanelTitle} mb-2`}>Need a focused answer first?</h3>
                <p className={`${styles.panelCopy} mb-4 font-serif text-xs`}>
                  Commission a Rapid Intelligence Brief for one defined market, technology, or policy question &mdash; a concise memo with stated assumptions and linked sources, delivered within five business days.
                </p>
                <TrackedLink href="/rapid-intelligence-brief" event="cta_brief_rapid_intelligence" className={`${styles.action} ${styles.actionPrimary}`}>
                  Rapid Intelligence Brief &middot; From $500 &#8599;
                </TrackedLink>
                <Link href="/consulting" className={`${styles.quietLink} mt-3 block text-center`}>
                  Need full diligence? View the Verified Research Brief &#8599;
                </Link>
              </div>

              <div className={styles.sidePanel}>
                <h3 className={`${styles.sidePanelTitle} mb-2`}>Test the evidence method</h3>
                <p className={`${styles.panelCopy} mb-4 font-serif text-xs`}>
                  Paste a passage into the Maha Provenance Auditor to see how claims are classified before they become decisions.
                </p>
                <Link href="/audit" className={styles.action}>Run the Live Auditor &#8599;</Link>
                <Link href="/mps" className={`${styles.quietLink} mt-3 block text-center`}>
                  Read the MPS/0.1 standard &#8599;
                </Link>
              </div>

              <ExportButton />
            </div>
          </aside>
        </div>

        <div className={`${styles.sectionRule} mt-20 pt-8 text-center`}>
          <Link href="/intelligence" className={styles.quietLink}>
            [ &larr; Return to Intelligence Grid ]
          </Link>
        </div>
      </div>
    </main>
  );
}
