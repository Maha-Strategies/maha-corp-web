import KnowledgeHub from '@/components/knowledge/KnowledgeHub'
import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_ORGANIZATION_ID, MAHA_SITE_URL } from '@/lib/entity'
import { NANO_ARTICLES, NANO_PATH, NANO_RELEASE_DATE, NANO_SOURCES } from '@/lib/nanotechnology-knowledge'

const title = 'Nanotechnology: evidence and evaluation | Maha Strategies'
const description =
  'How nanoscale materials are made, measured and claimed — and how to judge the evidence. Seventeen sourced explanations and a runnable surface-area calculation, from a publisher that makes no materials and certifies nothing.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: NANO_PATH },
  openGraph: { title, description, url: `${MAHA_SITE_URL}${NANO_PATH}`, type: 'website', siteName: 'Maha Strategies' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${MAHA_SITE_URL}${NANO_PATH}#collection`,
  url: `${MAHA_SITE_URL}${NANO_PATH}`,
  name: 'Nanotechnology: evidence and evaluation',
  description,
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  dateModified: NANO_RELEASE_DATE,
  hasPart: NANO_ARTICLES.map((article) => ({
    '@type': 'Article',
    '@id': `${MAHA_SITE_URL}${NANO_PATH}/${article.slug}`,
    headline: article.title,
    description: article.answer,
  })),
}


const groups = [["foundations","Nanoscale foundations",["what-nanoscale-means","surface-area-to-volume","nanomaterial-classes","quantum-confinement"]],["making-measuring","Making and measuring",["top-down-and-bottom-up","characterisation-what-each-method-sees","reporting-size-with-uncertainty","batch-to-batch-variability","scale-up-constraints"]],["applications","Properties and applications",["structure-property-claims","surface-functionalisation","nano-sensing","energy-storage-claims"]],["evaluation","Evidence and evaluation",["exposure-and-safety-evidence","regulatory-status-is-not-safety","vendor-claim-checks","surface-area-example"]]]
export default function Hub() {
 const card = (slug: string) => { const a = NANO_ARTICLES.find(a => a.slug === slug)!; return { href: `${NANO_PATH}/${slug}`, title: a.title, description: a.answer, label: 'Source-linked explanation' } }
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} /><KnowledgeHub title="Nanotechnology" breadcrumb="Nanotechnology" eyebrow="Evidence and evaluation" introduction="Explore nanoscale materials through their mechanisms, measurements and evidence. Start with a question, then follow a connected topic group." boundary="Maha makes no materials and certifies nothing. These guides are not safety assessments, exposure limits or medical advice." groups={groups.map(([id, title, slugs]) => ({ id: id as string, title: title as string, description: 'Explore the questions, methods and boundaries below.', cards: (slugs as string[]).map(card) }))} featured={["what-nanoscale-means","surface-area-example","vendor-claim-checks"].map(card)} related={[["/knowledge/physical-ai","Physical AI"],["/knowledge/robotics","Robotics"],["/knowledge/computational-architecture","Computational Architecture"]].map(([href, title]) => ({ href, title, description: 'Continue into this connected knowledge domain.' }))}>
        <section className="mt-12" aria-labelledby="run-it">
          <h2 id="run-it" className="evidence-section-title text-xl">Run the arithmetic yourself</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
            The section ships a unit-aware surface-area-to-volume calculator for idealised particles, with its assumptions and
            dimensional checks printed beside every result. It refuses zero dimensions, unsupported units and zero density rather than
            returning a number that looks plausible.
          </p>
          <pre className="mt-5 overflow-x-auto border border-[var(--border-default)] p-4 text-sm">
{`node --experimental-strip-types scripts/nanoscale-surface-area.ts \\
  --shape sphere --size 10 --unit nm --density 4 --density-unit g/cm3`}
          </pre>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
            Geometry predicts area, not reactivity, toxicity or performance — see{' '}
            <Link className="evidence-link" href={`${NANO_PATH}/surface-area-example`}>what the calculator cannot tell you</Link>.
          </p>
        </section>

        <section className="mt-12" aria-labelledby="elsewhere">
          <h2 id="elsewhere" className="evidence-section-title text-xl">Related sections</h2>
          <ul className="mt-4 list-none space-y-2 p-0">
            <li><Link className="evidence-link" href="/knowledge/suppliers">Semiconductor process and supplier map</Link> — top-down patterning, which this section does not restate.</li>
            <li><Link className="evidence-link" href="/knowledge/neuromorphic-biocomputing">Neuromorphic and biocomputing</Link> — memristive and in-memory devices built from these materials.</li>
            <li><Link className="evidence-link" href="/knowledge/physical-ai">Physical AI</Link> — the evaluation discipline applied to learned systems that act.</li>
            <li><Link className="evidence-link" href="/knowledge/robotics">Robotics evidence and evaluation</Link> — measurement and evidence records for machines.</li>
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="sources">
          <h2 id="sources" className="evidence-section-title text-xl">Sources read for this section</h2>
          <ul className="mt-4 list-none space-y-4 p-0">
            {Object.values(NANO_SOURCES).map((source) => (
              <li key={source.url}>
                <a className="evidence-link" href={source.url} target="_blank" rel="noreferrer noopener">{source.title} ↗</a>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">Read at: {source.locator} · inspected {source.inspected}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-[var(--text-muted)]">
            Nothing here is a safety assessment, an exposure limit, a product approval or medical advice. Regulatory questions belong
            to the relevant agency; workplace exposure belongs to qualified occupational-health practice.
          </p>
        </section>

<p>We run no synthesis or characterisation laboratory and provide no materials certification.</p>
</KnowledgeHub></>
}
