import type { Metadata } from 'next'
import Link from 'next/link'

const pageUrl = 'https://www.mahastrategies.com/case-studies'

export const metadata: Metadata = {
  title: 'Case Studies | Maha Strategies',
  description: 'Evidence-led accounts of public work by Maha Strategies: Mayon, Agentic Publishing, and privacy-conscious applications.',
  alternates: { canonical: pageUrl },
  openGraph: {
    title: 'Case Studies | Maha Strategies',
    description: 'Public work that can be inspected: educational visualization, accountable publishing infrastructure, and privacy-conscious apps.',
    url: pageUrl,
    type: 'website',
  },
}

const studies = [
  {
    id: 'mayon',
    label: 'Public-interest education',
    title: 'Mayon: a free educational volcano experience',
    summary: 'Maha Strategies built and maintains a free, true-scale Mayon Volcano experience for learners, educators, and curious visitors. It pairs terrain, historical chapters, explanatory interior diagrams, and bounded hazard scenarios with a teacher kit and published methods.',
    live: [
      'A public interactive, classroom materials, and an explorable historical and hazard-learning experience.',
      'A methods and data page describing terrain, imagery, inferred-interior limits, scenario assumptions, update policy, and official-source boundaries.',
    ],
    boundary: 'It is not a live warning, monitoring, forecast, evacuation, or location-specific decision system. Interior features and hazard corridors are explanatory inferences and teaching overlays. Current conditions and instructions belong to PHIVOLCS and local authorities.',
    links: [
      { label: 'Open the Mayon experience ↗', href: 'https://mayonrajan.com', external: true },
      { label: 'Read methods and data ↗', href: 'https://mayonrajan.com/methods/', external: true },
      { label: 'Open the Teacher Kit ↗', href: 'https://mayonrajan.com/teachers/', external: true },
    ],
  },
  {
    id: 'agentic-publishing',
    label: 'Accountable-release infrastructure',
    title: 'Agentic Publishing: making a release inspectable',
    summary: 'Maha Strategies operates an experimental publishing environment that treats a published work as a versioned, reviewable object rather than a static file alone. The public materials make the proposed architecture, source boundaries, and release artifacts inspectable.',
    live: [
      'A public technical architecture guide and a read-only Context Pack Explorer with a release manifest, source ledger, exclusions, and machine-readable JSON.',
      'A release model designed around human approval, auditability, and deliberately bounded public metadata rather than automatic publication by a model.',
    ],
    boundary: 'The public explorer is a demonstration of the release contract, not a claim that every source text is public or that an AI system can guarantee truth. The longer-term architecture remains a roadmap where it is not yet implemented.',
    links: [
      { label: 'Visit Agentic Publishing ↗', href: 'https://publish.mahastrategies.com', external: true },
      { label: 'Read the architecture guide ↗', href: 'https://publish.mahastrategies.com/guides/agentic-publishing-architecture', external: true },
      { label: 'Inspect a Context Pack ↗', href: 'https://publish.mahastrategies.com/context-packs/the-maha-principle', external: true },
    ],
  },
  {
    id: 'apps',
    label: 'Privacy-conscious tools',
    title: 'Apps: useful defaults, documented boundaries',
    summary: 'Maha Strategies publishes public documentation for Mayon, Maha OS, and The Dream Engine. The products are designed around understandable scope, user agency, and public privacy information rather than opaque data collection as a default.',
    live: [
      'Maha OS, The Dream Engine, and Mayon are available on iOS and Android; Mayon also remains available as a public web experience.',
      'Each product has a public description, support route, and privacy documentation or stated data boundary that visitors can inspect before they use it.',
    ],
    boundary: 'Privacy-conscious does not mean that no data can ever leave a device. Product-specific documentation explains the relevant limits, and user-initiated features or third-party platforms have their own terms and practices.',
    links: [
      { label: 'Browse the Apps hub', href: '/apps', external: false },
      { label: 'Read the Mayon privacy notice', href: '/apps/mayon/privacy', external: false },
      { label: 'Read The Dream Engine privacy notice', href: '/apps/the-engine/privacy', external: false },
    ],
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Maha Strategies Case Studies',
  url: pageUrl,
  description: 'Evidence-led accounts of public work by Maha Strategies.',
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: studies.map((study, position) => ({
      '@type': 'ListItem',
      position: position + 1,
      item: {
        '@type': 'CreativeWork',
        name: study.title,
        description: study.summary,
        url: `${pageUrl}#${study.id}`,
      },
    })),
  },
}

export default function CaseStudiesPage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="evidence-container">
        <p className="evidence-kicker">[ Case studies ]</p>
        <h1 className="evidence-title evidence-title--product">Work that can be inspected.</h1>
        <p className="evidence-lede mt-7">
          These are selected public examples of work operated by Maha Strategies. Each account links to the live work, says what is actually available, and states the boundary we do not want visitors to mistake for a promise.
        </p>

        <section className="evidence-section">
          <p className="evidence-kicker">[ A note on evidence ]</p>
          <p className="evidence-card">
            These are not performance claims, client testimonials, or a substitute for independent review. They are operating notes: public artifacts, their intended use, and their limits.
          </p>
        </section>

        <div className="mt-14 space-y-8">
          {studies.map((study) => (
            <section
              key={study.id}
              id={study.id}
              className="evidence-section scroll-mt-24 bg-[var(--surface-elevated)] p-1"
            >
              <p className="evidence-kicker">[ {study.label} ]</p>
              <h2 className="evidence-section-title mt-4">{study.title}</h2>
              <p className="evidence-copy mt-4">{study.summary}</p>
              <div className="mt-8 grid gap-7 md:grid-cols-2">
                <div>
                  <p className="evidence-kicker">What is live</p>
                  <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--text-primary)]">
                    {study.live.map((item) => <li key={item}>— {item}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="evidence-kicker">Operating boundary</p>
                  <p className="evidence-copy mt-4">{study.boundary}</p>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm">
                {study.links.map((link) => link.external ? (
                  <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="evidence-link">
                    {link.label}
                  </a>
                ) : (
                  <Link key={link.href} href={link.href} className="evidence-link">
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="evidence-section">
          <h2 className="evidence-section-title">The operating entity</h2>
          <p className="evidence-copy mt-4">
            Maha Strategies is the operator and publisher connecting these public projects. Their evidence, data practices, audiences, and claims remain distinct. The <Link href="/network" className="evidence-link">Maha Knowledge Network</Link> maps the relevant relationships; the underlying sites remain the primary source for each project.
          </p>
        </section>
      </article>
    </main>
  )
}
