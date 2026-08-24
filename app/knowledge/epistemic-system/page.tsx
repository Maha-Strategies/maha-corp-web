import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_SITE_URL } from '@/lib/entity'
import { EPISTEMIC_MIGRATION_INVENTORY } from '@/lib/epistemic-adapters'
import {
  BRIDGE_TYPES,
  CLAIM_KINDS,
  EPISTEMIC_SCHEMA_DESCRIPTOR,
  EVIDENCE_MATURITIES,
  REVIEW_STATES,
} from '@/lib/epistemic-schema'
import {
  EPISTEMIC_DOMAINS,
  EPISTEMIC_RECORDS,
  EPISTEMIC_RELEASE_DATE,
  EPISTEMIC_SYSTEM_PATH,
  PUBLIC_EPISTEMIC_RECORDS,
} from '@/lib/epistemic-pilots'

export const metadata: Metadata = {
  metadataBase: new URL(MAHA_SITE_URL),
  title: 'Epistemic Publication System | Maha Strategies',
  description: 'The enforceable schema and publication gateway separating claim type, evidence maturity, review state, source rights, uncertainty, and public promotion.',
  alternates: { canonical: EPISTEMIC_SYSTEM_PATH },
  openGraph: {
    type: 'website',
    title: 'Maha Epistemic Publication System',
    description: 'Only canonical, source-bounded records cross from the underlying graph into crawlable Knowledge pages.',
    url: `${MAHA_SITE_URL}${EPISTEMIC_SYSTEM_PATH}`,
    siteName: 'Maha Strategies',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: 'Maha Epistemic Publication System',
    description: 'An enforceable publication boundary between machine records and canonical public knowledge.',
    images: [],
  },
}

const Axis = ({ name, values, meaning }: { name: string; values: readonly string[]; meaning: string }) => (
  <article className="evidence-card">
    <p className="evidence-kicker text-[var(--status-sourced)]">{name}</p>
    <p className="evidence-card-copy mt-3">{meaning}</p>
    <div className="mt-5 flex flex-wrap gap-2">
      {values.map((value) => <span key={value} className="evidence-chip">{value.replaceAll('-', ' ')}</span>)}
    </div>
  </article>
)

export default function EpistemicSystemPage() {
  const withheld = EPISTEMIC_RECORDS.length - PUBLIC_EPISTEMIC_RECORDS.length
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'Maha Epistemic Publication System',
    description: metadata.description,
    datePublished: EPISTEMIC_RELEASE_DATE,
    dateModified: EPISTEMIC_RELEASE_DATE,
    mainEntityOfPage: `${MAHA_SITE_URL}${EPISTEMIC_SYSTEM_PATH}`,
    hasPart: EPISTEMIC_DOMAINS.map((domain) => ({
      '@type': 'CollectionPage',
      name: domain.name,
      url: `${MAHA_SITE_URL}/knowledge/${domain.slug}`,
    })),
  }

  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="evidence-container">
        <nav aria-label="Breadcrumb" className="evidence-kicker">
          <Link href="/knowledge" className="evidence-link">Knowledge</Link>
          <span className="px-2">/</span>
          <span>Epistemic publication system</span>
        </nav>

        <header className="mt-10 max-w-5xl">
          <p className="evidence-kicker text-[var(--status-sourced)]">Phase 1 · publication gateway · {EPISTEMIC_SCHEMA_DESCRIPTOR.version}</p>
          <h1 className="evidence-title">The public page is the result of a passed gate.</h1>
          <p className="evidence-lede mt-7">Maha’s underlying graph may contain drafts, hypotheses, conflicts, and incomplete records. Only records with explicit epistemic axes, source rights, locators, uncertainty, boundaries, and an approving review event become crawlable Knowledge pages.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={`${EPISTEMIC_SYSTEM_PATH}/schema`} className="evidence-action evidence-action--primary">Open JSON schema</a>
            <Link href={`${EPISTEMIC_SYSTEM_PATH}/migrations`} className="evidence-action evidence-action--secondary">Inspect legacy migration</Link>
          </div>
        </header>

        <section className="evidence-section" aria-labelledby="gateway-heading">
          <p className="evidence-kicker">Iceberg boundary</p>
          <h2 id="gateway-heading" className="evidence-section-title mt-3">Publication is a controlled state transition.</h2>
          <div className="mt-7 grid gap-px border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-3">
            <div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Graph records</p><p className="mt-3 font-mono text-3xl text-[var(--text-primary)]">{EPISTEMIC_RECORDS.length}</p><p className="evidence-card-copy mt-2">Canonical and withheld pilot records.</p></div>
            <div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker text-[var(--status-verified)]">Public canonical</p><p className="mt-3 font-mono text-3xl text-[var(--status-verified)]">{PUBLIC_EPISTEMIC_RECORDS.length}</p><p className="evidence-card-copy mt-2">Records that generate pages and sitemap rows.</p></div>
            <div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker text-[var(--status-boundary)]">Withheld</p><p className="mt-3 font-mono text-3xl text-[var(--status-boundary)]">{withheld}</p><p className="evidence-card-copy mt-2">Visible only as gate decisions, not public claims.</p></div>
          </div>
          <div className="evidence-status-surface evidence-status-surface--boundary mt-6">
            <p className="evidence-status-label">Non-transfer rule</p>
            <p className="evidence-copy mt-2">Peer review does not mean independent replication. A formal model does not establish hardware readiness. A cell-system result does not establish clinical benefit. Each proposition retains its own evidence axis.</p>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="ingestion-heading">
          <p className="evidence-kicker">Persistent ingestion and expert review</p>
          <h2 id="ingestion-heading" className="evidence-section-title mt-3">Five legacy systems now meet the same gate.</h2>
          <p className="evidence-copy mt-5 max-w-4xl">The semiconductor, mathematics, astronomy, religion, and neuromorphic adapters preserve {EPISTEMIC_MIGRATION_INVENTORY.counts.sourceRecords} source records as immutable candidates. Each batch survives deployments, and every expert decision binds a versioned identity, one review scope, and the candidate’s frozen content hash.</p>
          <div className="mt-7 grid gap-px border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-3">
            <div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Adapters</p><p className="mt-3 font-mono text-3xl text-[var(--text-primary)]">{EPISTEMIC_MIGRATION_INVENTORY.counts.adapters}</p></div>
            <div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker">Imported candidates</p><p className="mt-3 font-mono text-3xl text-[var(--text-primary)]">{EPISTEMIC_MIGRATION_INVENTORY.counts.sourceRecords}</p></div>
            <div className="bg-[var(--surface-raised)] p-6"><p className="evidence-kicker text-[var(--status-boundary)]">Withheld pending review</p><p className="mt-3 font-mono text-3xl text-[var(--status-boundary)]">{EPISTEMIC_MIGRATION_INVENTORY.counts.withheld}</p></div>
          </div>
          <Link href={`${EPISTEMIC_SYSTEM_PATH}/migrations`} className="evidence-action evidence-action--primary mt-7">Open migration ledger</Link>
        </section>

        <section className="evidence-section" aria-labelledby="axes-heading">
          <p className="evidence-kicker">Independent axes</p>
          <h2 id="axes-heading" className="evidence-section-title mt-3">No single confidence label can carry all meanings.</h2>
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <Axis name="Claim kind" values={CLAIM_KINDS} meaning="What kind of proposition is being made, independently of how much evidence supports it." />
            <Axis name="Evidence maturity" values={EVIDENCE_MATURITIES} meaning="What the compiled evidence establishes about testing, replication, conflict, or formal verification." />
            <Axis name="Review state" values={REVIEW_STATES} meaning="Where the record sits in Maha’s editorial lifecycle; this is not a scientific evidence score." />
            <Axis name="Bridge type" values={BRIDGE_TYPES} meaning="Whether a cross-domain link is exact, mechanistic, statistical, analogical, instrumental, or strategic." />
          </div>
        </section>

        <section id="pilots" className="evidence-section scroll-mt-24" aria-labelledby="pilots-heading">
          <p className="evidence-kicker">Adversarial pilots</p>
          <h2 id="pilots-heading" className="evidence-section-title mt-3">Two domains, two different failure modes.</h2>
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {EPISTEMIC_DOMAINS.map((domain) => (
              <Link key={domain.slug} href={`/knowledge/${domain.slug}`} className="evidence-card group">
                <p className="evidence-kicker text-[var(--status-sourced)]">Phase 1 pilot</p>
                <h3 className="evidence-card-title mt-4 group-hover:underline">{domain.name}</h3>
                <p className="evidence-card-copy mt-3">{domain.description}</p>
                <p className="mt-5 border-l-2 border-[var(--status-boundary)] pl-4 text-sm leading-6 text-[var(--text-secondary)]">{domain.stressPoint}</p>
                <p className="evidence-kicker mt-6">Open governed domain →</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="machine-heading">
          <p className="evidence-kicker">Single-source outputs</p>
          <h2 id="machine-heading" className="evidence-section-title mt-3">One record, several synchronized surfaces.</h2>
          <pre className="knowledge-machine-panel mt-7 overflow-x-auto p-6 text-xs leading-6"><code>{`canonical record
  ├─ public HTML page (only after gate passes)
  ├─ Schema.org JSON-LD
  ├─ domain registry entry
  ├─ provenance.json + SHA-256 content hash
  ├─ sitemap row
  └─ llms.txt orientation link`}</code></pre>
        </section>
      </div>
    </main>
  )
}
