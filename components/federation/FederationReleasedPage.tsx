import Link from 'next/link'
import type { PublishedFederationPage } from '@/lib/federation-publication'
import styles from './FederationReleasedPage.module.css'

function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export default function FederationReleasedPage({ page }: { page: PublishedFederationPage }) {
  const jsonLd = { ...page.structuredData, headline: page.title, url: page.canonicalUrl, mainEntity: page.boundedAnswers.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }
  return (
    <main className={styles.main}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      {page.siteId === 'maha-policy' && <nav className={styles.propertyNav} aria-label="Maha Policy">
        <Link href="https://policy.mahastrategies.com/" className={styles.propertyBrand}>Maha Policy</Link>
        <div>
          <Link href="https://policy.mahastrategies.com/discover/definitions">Definitions</Link>
          <Link href="https://policy.mahastrategies.com/discover/current-law">Current law</Link>
          <Link href="https://policy.mahastrategies.com/discover/evidence">Evidence</Link>
          <Link href="https://policy.mahastrategies.com/discover/implementation">Implementation</Link>
        </div>
      </nav>}
      <header>
        <p className={styles.eyebrow}>{page.siteId === 'maha-policy' ? 'Maha Policy' : page.siteId.replaceAll('-', ' ')} · governed federation</p>
        <h1 className={styles.title}>{page.title}</h1>
        <p className={styles.answer}>{page.directAnswer}</p>
        <p className={styles.release}>Active canonical release · {page.release.releaseId} · exact revision {page.contentDigest}</p>
      </header>
      <div className={styles.grid}>
        <article>
          {page.sections.map((section, index) => (
            <section className={styles.section} key={`${section.heading}-${index}`}>
              <span className={styles.sectionKind}>{section.kind}</span>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph, paragraphIndex) => <p className={section.kind === 'limitations' ? styles.boundary : undefined} key={paragraphIndex}>{paragraph}</p>)}
            </section>
          ))}
          <section className={styles.section}>
            <span className={styles.sectionKind}>bounded answers</span>
            <h2>Questions this page can answer</h2>
            {page.boundedAnswers.map((item) => <div key={item.question}><p className={styles.question}>{item.question}</p><p>{item.answer}</p></div>)}
          </section>
        </article>
        <aside className={styles.aside}>
          <div className={styles.card}>
            <h2>Evidence</h2>
            {page.sources.map((source) => (
              <div key={source.sourceId}>
                <p><strong>{source.url ? <a href={source.url} rel="noreferrer">{source.title}</a> : source.title}</strong><br />Locator: {source.locator}</p>
                <p className={styles.boundary}>Boundary: {source.doesNotEstablish}</p>
                <p>Rights: {source.rightsBasis}</p>
              </div>
            ))}
          </div>
          {page.relatedLinks.length > 0 && <div className={styles.card}>
            <h2>Related concepts</h2>
            <ul className={styles.list}>{page.relatedLinks.map((link) => <li key={`${link.url}-${link.relationship}`}><Link href={link.url}>{link.relationship.replaceAll('-', ' ')}</Link></li>)}</ul>
          </div>}
        </aside>
      </div>
    </main>
  )
}
