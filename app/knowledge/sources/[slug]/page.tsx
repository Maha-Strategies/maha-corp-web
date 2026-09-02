import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { MAHA_SITE_URL } from '@/lib/entity'
import { projectSourceReference, SOURCE_ROUTE_PREFIX } from '@/lib/source-reference-projection'

/*
 * Rendered per request, never cached.
 *
 * The page is a projection of canonical releases that live in the database, so
 * a cached copy would keep asserting a claim after its record was withdrawn -
 * which is the one failure Model A exists to prevent. Cache Components is not
 * enabled in this repository, so the documented mechanism is the route-segment
 * config below, the same one sitemap.ts and llms.txt already use for
 * release-backed output.
 */
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const page = await projectSourceReference(slug)
  if (!page) return { title: 'Source reference', robots: { index: false, follow: false } }
  return {
    title: `${page.title} — source evidence reference`,
    description: `What ${page.title} establishes, the exact sections inspected, and what it does not establish.`,
    alternates: { canonical: `${MAHA_SITE_URL}${page.route}` },
  }
}

export default async function SourceReferencePage({ params }: Params) {
  const { slug } = await params
  const page = await projectSourceReference(slug)
  // Not "render a smaller page". A source that has lost a required released
  // claim has no page at all, and says so with a 404.
  if (!page) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    name: page.title,
    author: page.authors.map((name) => ({ '@type': 'Person', name })),
    publisher: page.publisher ? { '@type': 'Organization', name: page.publisher } : undefined,
    datePublished: page.publishedAt ?? undefined,
    identifier: page.sourceId,
    url: `${MAHA_SITE_URL}${page.route}`,
    citation: page.relatedReleasedRecords.map((record) => `${MAHA_SITE_URL}${record.route}`),
    isBasedOn: page.sourceId.startsWith('10.') ? `https://doi.org/${page.sourceId}` : page.sourceId,
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <p className="text-sm uppercase tracking-wide text-neutral-500">Source evidence reference</p>
      <h1 className="mt-2 text-3xl font-semibold">{page.title}</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {page.authors.join(', ')}
        {page.publisher ? ` · ${page.publisher}` : ''}
        {page.publishedAt ? ` · ${page.publishedAt}` : ''}
      </p>
      <p className="mt-1 text-sm text-neutral-600">
        Identifier <code>{page.sourceId}</code> · version inspected: {page.versionInspected}
      </p>

      <p className="mt-6 rounded border border-neutral-300 bg-neutral-50 p-4 text-sm">{page.projectionNotice}</p>

      <h2 className="mt-10 text-xl font-semibold">What the source investigates</h2>
      <p className="mt-2">{page.researchQuestion}</p>
      <p className="mt-2 text-sm text-neutral-600">Evidence type: {page.evidenceType}</p>

      <h2 className="mt-10 text-xl font-semibold">Sections inspected</h2>
      <ul className="mt-2 list-disc pl-6">
        {page.inspectedLocators.map((locator) => <li key={locator}>{locator}</li>)}
      </ul>
      <p className="mt-2 text-sm text-neutral-600">Access and rights basis: {page.rightsBasis}</p>

      <h2 className="mt-10 text-xl font-semibold">Findings carried from released records</h2>
      <ul className="mt-2 space-y-3">
        {page.findings.map((finding) => (
          <li key={finding.recordId}>
            <p>{finding.statement}</p>
            <p className="text-sm text-neutral-600">
              <a className="underline" href={finding.recordRoute}>Released record</a> · {finding.locator}
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-semibold">What this source does not establish</h2>
      <ul className="mt-2 list-disc pl-6">
        {page.doesNotEstablish.map((item) => <li key={item}>{item}</li>)}
      </ul>

      <h2 className="mt-10 text-xl font-semibold">Limitations</h2>
      <ul className="mt-2 list-disc pl-6">
        {page.limitations.map((item) => <li key={item}>{item}</li>)}
      </ul>

      {page.bridges.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-semibold">Typed bridges</h2>
          <ul className="mt-2 list-disc pl-6">
            {page.bridges.map((bridge) => (
              <li key={bridge.bridgeId}>{bridge.bridgeType}: {bridge.targetRecordId}</li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-10 text-xl font-semibold">Related released records</h2>
      <ul className="mt-2 list-disc pl-6">
        {page.relatedReleasedRecords.map((record) => (
          <li key={record.recordId}><a className="underline" href={record.route}>{record.route}</a></li>
        ))}
      </ul>

      <p className="mt-10 text-xs text-neutral-500">
        Provenance digest <code>{page.provenanceDigest}</code> · route {SOURCE_ROUTE_PREFIX}/{page.slug}
      </p>
    </main>
  )
}
