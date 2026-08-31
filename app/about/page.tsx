import type { Metadata } from 'next'
import Link from 'next/link'

import {
  MAHA_DESCRIPTOR,
  MAHA_ORGANIZATION_ID,
  MAHA_SITE_URL,
  MAYONE_MAHA_RAJAN_ID,
  mahaOrganizationJsonLd,
  mahaRelatedProjectsJsonLd,
  mayoneMahaRajanJsonLd,
} from '@/lib/entity'

export const metadata: Metadata = {
  title: 'About Maha Strategies LLC',
  description: `${MAHA_DESCRIPTOR} Research on systemic sovereignty across semiconductor supply chains, software and on-device AI, and human attention.`,
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About Maha Strategies LLC',
    description: MAHA_DESCRIPTOR,
    url: '/about',
  },
}

// This page is the canonical entity profile: it carries the Organization and
// Person nodes, and — because it visibly lists the connected projects — the
// relationships to them. Those projects are separate works published or
// authored by the organization, never alternate identities of it, so they are
// linked with publisher/author and hasPart rather than sameAs.
const aboutJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      ...mahaOrganizationJsonLd,
      subjectOf: { '@id': `${MAHA_SITE_URL}/about#page` },
      hasPart: mahaRelatedProjectsJsonLd.map((project) => ({ '@id': project['@id'] })),
    },
    mayoneMahaRajanJsonLd,
    {
      '@type': 'AboutPage',
      '@id': `${MAHA_SITE_URL}/about#page`,
      url: `${MAHA_SITE_URL}/about`,
      name: 'About Maha Strategies LLC',
      description: MAHA_DESCRIPTOR,
      inLanguage: 'en',
      isPartOf: { '@id': `${MAHA_SITE_URL}/#website` },
      mainEntity: { '@id': MAHA_ORGANIZATION_ID },
      about: [{ '@id': MAHA_ORGANIZATION_ID }, { '@id': MAYONE_MAHA_RAJAN_ID }],
    },
    ...mahaRelatedProjectsJsonLd,
  ],
}

const pillars = [
  ['Infrastructure', 'Semiconductor supply chains, assembly capacity, and the strategic conditions for resilient compute.'],
  ['Interface', 'On-device AI, local-first software, and the practical conditions for digital autonomy.'],
  ['Intellect', 'Attention, cognitive liberty, and the human conditions that make autonomy durable.'],
]

export default function AboutPage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd).replace(/</g, '\\u003c') }} />
      <div className="evidence-container">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker">[ Entity profile · Maha Strategies LLC ]</p>
          <h1 className="evidence-title evidence-title--product">Research for systems that can remain autonomous.</h1>
          <p className="evidence-lede mt-7">Maha Strategies LLC is an independent research, publishing, and technology-architecture organization. Its work spans semiconductor supply chains, software, and on-device AI, and the <Link className="evidence-link" href="/mps">evidence standards</Link> that make AI-assisted research reviewable.</p>
        </header>

        <section className="evidence-section" aria-label="The three-layer research model">
          <p className="evidence-kicker">The three-layer research model</p>
          <h2 className="evidence-section-title mt-4">A structure for boundary clarity before claims.</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {pillars.map(([title, description]) => (
              <article key={title} className="evidence-card">
                <p className="evidence-card-title">{title}</p>
                <p className="evidence-card-copy mt-3">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section" aria-label="Leadership">
          <p className="evidence-kicker">Leadership</p>
          <h2 className="evidence-section-title mt-4">Founder and operating boundary</h2>
          <div id="mayone-maha-rajan" className="evidence-card">
            <p className="evidence-card-title">Mayone Maha Rajan</p>
            <p className="evidence-card-copy mt-2 evidence-kicker">Founder and Managing Director</p>
            <p className="evidence-copy mt-5 text-sm">
              Mayone Maha Rajan leads Maha Strategies&rsquo; research, editorial work, and advisory practice. He is responsible for the firm&rsquo;s published arguments, research direction, and the Maha Provenance Standard.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <a className="evidence-link" href="https://www.mayonemaharajan.com" rel="me">Founder dossier ↗</a>
              <a className="evidence-link" href="https://github.com/mayonerajan" rel="me">GitHub ↗</a>
              <a className="evidence-link" href="https://www.linkedin.com/in/mayonrajan/" rel="me">LinkedIn ↗</a>
            </div>
          </div>
        </section>

        <section className="evidence-section" aria-label="Verifiable work">
          <p className="evidence-kicker">Verifiable work</p>
          <h2 className="evidence-section-title mt-4">What we publish as evidence, not marketing.</h2>
          <div className="evidence-card">
            <p className="evidence-copy">
              The <Link className="evidence-link" href="/mps">Maha Provenance Standard (MPS/0.1)</Link> is the firm&rsquo;s claim-level provenance framework for AI-assisted nonfiction. Its public archival record is available through <a className="evidence-link" href="https://doi.org/10.5281/zenodo.21241308">Zenodo DOI 10.5281/zenodo.21241308 ↗</a>.
            </p>
            <p className="evidence-copy mt-5">
              Research and advisory work separate sourced evidence, interpretation, and bounded speculation. <Link className="evidence-link" href="/demo">Watch the investor and partner demonstration</Link>, read the <Link className="evidence-link" href="/method">method</Link>, browse <Link className="evidence-link" href="/intelligence">intelligence</Link>, or <Link className="evidence-link" href="/contact">contact Maha Strategies</Link>.
            </p>
          </div>
        </section>

        <section className="evidence-section" aria-label="Public work">
          <p className="evidence-kicker">Public work</p>
          <h2 className="evidence-section-title mt-4">Projects that are intentionally separated by boundary.</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <a className="evidence-card evidence-card-copy" href="https://research.mahastrategies.com" target="_blank" rel="noopener noreferrer">
              <span className="evidence-card-title">Maha Strategies Research ↗</span>
              <span className="mt-3 block">Open research syntheses and preprints.</span>
            </a>
            <a className="evidence-card evidence-card-copy" href="https://publish.mahastrategies.com" target="_blank" rel="noopener noreferrer">
              <span className="evidence-card-title">Agentic Book Publishing ↗</span>
              <span className="mt-3 block">Tools for authors preparing agent query workflows.</span>
            </a>
            <a className="evidence-card evidence-card-copy" href="https://www.themahaprinciple.com" target="_blank" rel="noopener noreferrer">
              <span className="evidence-card-title">The Maha Principle ↗</span>
              <span className="mt-3 block">A reader-facing framework and book project.</span>
            </a>
            <a className="evidence-card evidence-card-copy" href="https://mayonrajan.com" target="_blank" rel="noopener noreferrer">
              <span className="evidence-card-title">Mayon Volcano ↗</span>
              <span className="mt-3 block">A free educational volcano explorer.</span>
            </a>
          </div>
          <div className="mt-8">
            <a className="evidence-link" href="https://github.com/Maha-Strategies" rel="me">Engineering and repositories ↗</a>
          </div>
        </section>
      </div>
    </main>
  )
}
