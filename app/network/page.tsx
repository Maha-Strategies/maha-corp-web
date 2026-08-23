import type { Metadata } from 'next'
import Link from 'next/link'
import { MAHA_ORGANIZATION_ID, MAHA_SITE_URL, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'

const pageUrl = `${MAHA_SITE_URL}/network`

export const metadata: Metadata = {
  title: 'Maha Knowledge Network | Projects, research, and tools',
  description: 'A transparent map of the public research, educational tools, publishing systems, and books connected to Maha Strategies and Mayone Maha Rajan.',
  alternates: { canonical: pageUrl },
  openGraph: {
    title: 'Maha Knowledge Network',
    description: 'A transparent map of the public research, educational tools, publishing systems, and books connected to Maha Strategies.',
    url: pageUrl,
    type: 'website',
  },
}

const nodes = [
  {
    label: 'Educational field trip',
    name: 'Mayon Rajan',
    href: 'https://mayonrajan.com/learn/sources/',
    description: 'A free, true-scale educational visualization of Mayon Volcano, with a public methods record and claim-level source registry.',
    relationship: 'Published and maintained by Maha Strategies. Its volcanology context is complemented—but not validated—by the Volcanic Engine working paper.',
  },
  {
    label: 'Open research',
    name: 'Maha Strategies Research',
    href: 'https://research.mahastrategies.com/',
    description: 'Working papers and synthesis projects, visibly labelled with provenance, verification state, and non-peer-reviewed status where applicable.',
    relationship: 'An independent research surface for hypotheses and references; it links to Mayon only as an educational companion where relevant.',
  },
  {
    label: 'Publishing system',
    name: 'Agentic Book Publishing',
    href: 'https://publish.mahastrategies.com/guides/agentic-publishing-architecture',
    description: 'Tools and technical documentation for source-aware, accountable publishing workflows and author query preparation.',
    relationship: 'A Maha Strategies product line. It is not a source of scientific authority for the research or educational projects.',
  },
  {
    label: 'Book and program',
    name: 'The Maha Principle',
    href: 'https://themahaprinciple.com/framework',
    description: 'A book-led research program by Mayone Maha Rajan, with public framework, research, and application references.',
    relationship: 'Book text remains governed by its publishing terms; this network links only to permitted marketing, framework, research, and app material.',
  },
]

const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'CollectionPage', '@id': `${pageUrl}#page`, url: pageUrl, name: 'Maha Knowledge Network', isPartOf: { '@id': `${MAHA_SITE_URL}/#website` }, about: [{ '@id': MAHA_ORGANIZATION_ID }, { '@id': MAYONE_MAHA_RAJAN_ID }] },
    { '@type': 'Organization', '@id': MAHA_ORGANIZATION_ID, name: 'Maha Strategies LLC', url: MAHA_SITE_URL, subjectOf: { '@id': `${pageUrl}#page` } },
    { '@type': 'WebApplication', '@id': 'https://mayonrajan.com/#application', name: 'Mayon Rajan', url: 'https://mayonrajan.com/', applicationCategory: 'EducationalApplication', publisher: { '@id': MAHA_ORGANIZATION_ID }, isAccessibleForFree: true },
    { '@type': 'ScholarlyArticle', '@id': 'https://research.mahastrategies.com/papers/the-volcanic-engine-thesis#article', name: 'The Volcanic Engine', url: 'https://research.mahastrategies.com/papers/the-volcanic-engine-thesis', isPartOf: { '@type': 'WebSite', url: 'https://research.mahastrategies.com/' }, creativeWorkStatus: 'Preprint' },
    { '@type': 'SoftwareApplication', '@id': 'https://publish.mahastrategies.com/#application', name: 'Agentic Book Publishing', url: 'https://publish.mahastrategies.com/', publisher: { '@id': MAHA_ORGANIZATION_ID } },
    { '@type': 'Book', '@id': 'https://themahaprinciple.com/#book', name: 'The Maha Principle: The Architecture of Human Flourishing', url: 'https://themahaprinciple.com/', author: { '@id': MAYONE_MAHA_RAJAN_ID } },
  ],
}

export default function KnowledgeNetworkPage() {
  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, '\\u003c') }} />
        <section className="evidence-section">
          <p className="evidence-kicker">[ Public entity and relationship map ]</p>
          <h1 className="evidence-title">The Maha Knowledge Network</h1>
          <p className="evidence-lede mt-7">
            A transparent guide to the public projects connected to Maha Strategies and Mayone Maha Rajan — what each one is for, who
            operates it, and where its authority begins and ends.
          </p>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">[ Interpretation policy ]</p>
          <p className="evidence-copy">
            A shared founder or publisher does not make one project evidence for another. Mayon&apos;s educational visualization follows
            its own methods and source record. Research papers state their own verification status. Publishing tools describe workflow
            infrastructure. Book material is limited to what may be made public under its publishing terms.
          </p>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">[ Public public nodes ]</p>
          <div className="grid gap-4">
            {nodes.map((node) => (
              <article key={node.name} className="evidence-card">
                <p className="evidence-kicker">{`[ ${node.label} ]`}</p>
                <h2 className="evidence-card-title mt-3">
                  <a className="hover:text-[var(--text-primary)]" href={node.href}>
                    {node.name}
                  </a>
                </h2>
                <p className="evidence-card-copy mt-3">{node.description}</p>
                <p className="evidence-card-copy mt-4">Relationship: {node.relationship}</p>
                <Link href={node.href} className="evidence-link mt-5 inline-block">
                  Open the relevant public page ↗
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section">
          <h2 className="evidence-section-title">Primary operator</h2>
          <p className="evidence-copy mt-4">
            Maha Strategies LLC is an independent research, publishing, and technology-architecture organization and the operating
            organization for the public applications and publishing tools above. <Link href="/about" className="evidence-link">Read about Maha
              Strategies and Mayone Maha Rajan</Link>, or use the project-specific pages above for purpose, evidence, and contact
            boundaries.
          </p>
        </section>
      </div>
    </main>
  )
}
