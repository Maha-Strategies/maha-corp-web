import Link from 'next/link'

/**
 * One renderer for both knowledge sections that use the evidence-article
 * shape: a direct answer, the mechanism, an example, what the evidence
 * establishes, what it does not, practical checks, and the sources with their
 * locators. Server-rendered with no client JavaScript, so the whole article is
 * readable with scripting disabled.
 */

export type EvidenceSource = {
  title: string
  url: string
  locator: string
  inspected: string
  claim: string
  boundary: string
  rights: string
}

export type EvidenceArticleData = {
  slug: string
  title: string
  answer: string
  explanation: string
  example: string
  establishes: string
  boundary: string
  checks: string[]
  sources: string[]
  related: string[]
  crossLinks?: { path: string; label: string }[]
}

type Props = {
  article: EvidenceArticleData
  sources: Record<string, EvidenceSource>
  sectionPath: string
  sectionLabel: string
  /** Title lookup for the related links. */
  titleOf: (slug: string) => string
  /** Shown under the heading: what this section is and is not. */
  sectionBoundary: string
}

export function EvidenceArticle({ article, sources, sectionPath, sectionLabel, titleOf, sectionBoundary }: Props) {
  const used = article.sources.map((id) => sources[id]).filter(Boolean)
  return (
    <main className="evidence-page">
      <article className="evidence-container evidence-container--narrow">
        <nav aria-label="Breadcrumb" className="text-sm">
          <Link className="evidence-link" href="/knowledge">Knowledge</Link>
          <span aria-hidden="true"> / </span>
          <Link className="evidence-link" href={sectionPath}>{sectionLabel}</Link>
        </nav>

        <header className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">
            {sectionLabel} · evidence and evaluation
          </p>
          <h1 className="mt-4 text-3xl font-light leading-tight tracking-tight text-[var(--text-primary)] sm:text-4xl">{article.title}</h1>
          <p className="mt-6 text-xl leading-relaxed text-[var(--text-primary)]">{article.answer}</p>
        </header>

        <section className="mt-12" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="evidence-section-title text-xl">How it works</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">{article.explanation}</p>
        </section>

        <section className="mt-10" aria-labelledby="example">
          <h2 id="example" className="evidence-section-title text-xl">A concrete case</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">{article.example}</p>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2" aria-labelledby="what-it-shows">
          <div className="border border-[var(--border-default)] p-6">
            <h2 id="what-it-shows" className="text-lg text-[var(--text-primary)]">What this establishes</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{article.establishes}</p>
          </div>
          <div className="border border-[var(--border-strong)] p-6">
            <h2 className="text-lg text-[var(--text-primary)]">What it does not</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{article.boundary}</p>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="checks">
          <h2 id="checks" className="evidence-section-title text-xl">Questions worth asking</h2>
          <ul className="mt-4 list-none space-y-3 p-0">
            {article.checks.map((check) => (
              <li key={check} className="border-l border-[var(--border-strong)] pl-4 leading-relaxed text-[var(--text-secondary)]">{check}</li>
            ))}
          </ul>
        </section>

        {used.length > 0 ? (
          <section className="mt-10" aria-labelledby="sources">
            <h2 id="sources" className="evidence-section-title text-xl">Sources</h2>
            <ul className="mt-4 list-none space-y-6 p-0">
              {used.map((source) => (
                <li key={source.url}>
                  <a className="evidence-link" href={source.url} target="_blank" rel="noreferrer noopener">{source.title} ↗</a>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{source.claim}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">Boundary: {source.boundary}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs uppercase tracking-widest text-[var(--text-muted)]">Locator and reuse basis</summary>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                      Read at: {source.locator}. Inspected {source.inspected}. {source.rights}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="mt-10" aria-labelledby="sources">
            <h2 id="sources" className="evidence-section-title text-xl">Sources</h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
              This page proposes a method rather than reporting a finding about the world, so it cites no external source. Where it
              describes something published, that page carries the citation.
            </p>
          </section>
        )}

        {article.related.length > 0 ? (
          <section className="mt-10" aria-labelledby="continue">
            <h2 id="continue" className="evidence-section-title text-xl">Continue</h2>
            <ul className="mt-4 list-none space-y-2 p-0">
              {article.related.map((slug) => (
                <li key={slug}>
                  <Link className="evidence-link" href={`${sectionPath}/${slug}`}>{titleOf(slug)}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {article.crossLinks && article.crossLinks.length > 0 ? (
          <section className="mt-8" aria-labelledby="elsewhere">
            <h2 id="elsewhere" className="evidence-section-title text-xl">Elsewhere on this site</h2>
            <ul className="mt-4 list-none space-y-2 p-0">
              {article.crossLinks.map((link) => (
                <li key={link.path}>
                  <Link className="evidence-link" href={link.path}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="mt-12 border-t border-[var(--border-default)] pt-6 text-sm leading-relaxed text-[var(--text-muted)]">{sectionBoundary}</p>
      </article>
    </main>
  )
}
