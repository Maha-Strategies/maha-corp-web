import type { Metadata } from 'next'
import Link from 'next/link'
import { MAHA_DESCRIPTOR } from '@/lib/entity'
import { COMPANY_ACTIVITIES, COMPANY_AREAS, COMPANY_BOUNDARIES, COMPANY_DIRECTION, COMPANY_KNOWLEDGE_FIELDS, COMPANY_PORTFOLIO_PATH, COMPANY_PROFILE_DATE, COMPANY_PROFILE_PATH, COMPANY_PROFILE_SCHEMA_PATH, buildCompanyPortfolioJsonLd } from '@/lib/company-profile'

export const metadata: Metadata = {
  title: 'Technology and research portfolio | Maha Strategies LLC',
  description: 'Maha’s software, publishing and technology-development direction, with explicit distinctions between implemented tools, internal simulations and exploratory research.',
  alternates: { canonical: COMPANY_PORTFOLIO_PATH },
  openGraph: { title: 'Maha Strategies technology and research portfolio', description: COMPANY_DIRECTION, url: COMPANY_PORTFOLIO_PATH },
}

export default function TechnologyPortfolioPage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildCompanyPortfolioJsonLd()).replace(/</g, '\\u003c') }} />
      <div className="evidence-container">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker">Company portfolio · Updated {COMPANY_PROFILE_DATE}</p>
          <h1 className="evidence-title evidence-title--product">From useful software to new technologies.</h1>
          <p className="evidence-lede mt-7">{MAHA_DESCRIPTOR}</p>
          <p className="evidence-copy mt-5">{COMPANY_DIRECTION}</p>
          <nav aria-label="Portfolio formats" className="mt-6 flex flex-wrap gap-5">
            <Link className="evidence-link" href="/about">Company and founder</Link>
            <a className="evidence-link" href={COMPANY_PROFILE_PATH}>Machine-readable company profile</a>
            <a className="evidence-link" href={COMPANY_PROFILE_SCHEMA_PATH}>Profile schema</a>
          </nav>
        </header>
        <section className="evidence-section" aria-labelledby="areas">
          <h2 id="areas" className="evidence-section-title">Three connected areas of work</h2>
          <p className="evidence-copy mt-4">These describe the company’s activities, not separate legal entities or claims that every research direction is a staffed programme.</p>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {COMPANY_AREAS.map((area) => <article className="evidence-card" key={area.id}><h3 className="evidence-card-title">{area.name}</h3><p className="evidence-card-copy mt-3">{area.description}</p></article>)}
          </div>
        </section>
        <section className="evidence-section" aria-labelledby="activities">
          <h2 id="activities" className="evidence-section-title">Products, experiments and research directions</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {COMPANY_ACTIVITIES.map((activity) => <article id={activity.id} className="evidence-card scroll-mt-24" key={activity.id}>
              <p className="evidence-kicker">{activity.status.replaceAll('-', ' ')}</p>
              <h3 className="evidence-card-title mt-3">{activity.name}</h3>
              <p className="evidence-card-copy mt-3">{activity.summary}</p>
              <p className="evidence-copy mt-4">{activity.boundary}</p>
              <div className="mt-5 flex flex-wrap gap-4">{activity.links.map((path) => <Link className="evidence-link break-words" key={path} href={path}>{path}</Link>)}</div>
            </article>)}
          </div>
        </section>
        <section className="evidence-section" aria-labelledby="fields">
          <h2 id="fields" className="evidence-section-title">Knowledge fields and possible applications</h2>
          <p className="evidence-copy mt-4">This is a map of current assets and questions worth investigating, not a catalogue of 24 finished products. Possible directions are hypotheses; they require suitable expertise, data, testing and a demonstrated user need.</p>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {COMPANY_KNOWLEDGE_FIELDS.map((field) => <article id={`field-${field.id}`} className="evidence-card scroll-mt-24" key={field.id}>
              <p className="evidence-kicker">{field.state.replaceAll('-', ' ')}</p>
              <h3 className="evidence-card-title mt-3">{field.name}</h3>
              <p className="evidence-card-copy mt-3"><strong>Current work:</strong> {field.currentWork}</p>
              <p className="evidence-card-copy mt-3"><strong>Possible direction:</strong> {field.possibleDirection}</p>
            </article>)}
          </div>
        </section>
        <section className="evidence-section" aria-labelledby="boundaries">
          <h2 id="boundaries" className="evidence-section-title">How to interpret this portfolio</h2>
          <ul className="evidence-copy mt-5 list-disc space-y-3 pl-5">{COMPANY_BOUNDARIES.map((boundary) => <li key={boundary}>{boundary}</li>)}</ul>
          <p className="evidence-copy mt-6">For a scoped evaluation or research collaboration, <Link className="evidence-link" href="/contact">contact Maha Strategies</Link>. A prospective collaboration does not imply an existing partnership or commitment.</p>
        </section>
      </div>
    </main>
  )
}
