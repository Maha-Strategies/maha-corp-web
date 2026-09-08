import type { Metadata } from 'next'
import Link from 'next/link'
import {
  POLICY_COMMERCIAL_LINKS,
  POLICY_DISCOVERY_GROUPS,
  POLICY_FEDERATION_LINKS,
  POLICY_PAGES,
  POLICY_SITE_URL,
  POLICY_TOPICS,
  policyPagesForDiscovery,
  policyTopicDefinitionUrl,
} from '@/lib/policy-front-door'

export const policyFrontDoorMetadata: Metadata = {
  title: { absolute: 'Maha Policy — Source-bounded governance intelligence' },
  description: 'Navigate 300 governed policy pages across AI accountability, agent governance, evidence, identity, auditability, standards, privacy, and semiconductor policy.',
  alternates: { canonical: POLICY_SITE_URL },
  openGraph: {
    type: 'website',
    url: POLICY_SITE_URL,
    siteName: 'Maha Policy',
    title: 'Maha Policy — Source-bounded governance intelligence',
    description: 'Policy definitions, current-law summaries, mechanisms, implementation guidance, machine rules, evidence, trade-offs, and uncertainty with explicit boundaries.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${POLICY_SITE_URL}/#collection`,
  url: POLICY_SITE_URL,
  name: 'Maha Policy',
  description: policyFrontDoorMetadata.description,
  isPartOf: { '@id': 'https://www.mahastrategies.com/#organization' },
  numberOfItems: POLICY_PAGES.length,
  hasPart: POLICY_DISCOVERY_GROUPS.map((group) => ({
    '@type': 'CollectionPage',
    url: `${POLICY_SITE_URL}/discover/${group.slug}`,
    name: group.label,
  })),
}

export default function PolicyFrontDoor() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="evidence-container">
        <header className="max-w-4xl border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3"><span>Maha Policy</span><span>300 governed pages · 30 policy topics</span></p>
          <h1 className="evidence-title">Know what governs a decision—and what the evidence cannot decide.</h1>
          <p className="evidence-lede mt-7">Maha Policy is a source-bounded clearing layer for policy questions involving AI, evidence, identity, auditability, standards, privacy, and strategic technology.</p>
          <p className="evidence-copy mt-5">Each page separates current law from standards, observed evidence, implementation guidance, Maha proposals, trade-offs, and uncertainty. It is designed for research and machine retrieval; it is not legal advice and never treats a proposal as enacted law.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/discover/definitions" className="evidence-action evidence-action--primary">Start with definitions ↗</Link>
            <Link href="/discover/current-law" className="evidence-action evidence-action--secondary">Browse current law ↗</Link>
          </div>
        </header>

        <section id="topics" className="evidence-section" aria-labelledby="topics-heading">
          <p className="evidence-kicker">Priority topics</p>
          <h2 id="topics-heading" className="evidence-section-title mt-4">Eight paths into the policy graph.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {POLICY_TOPICS.map((topic) => (
              <Link key={topic.slug} href={policyTopicDefinitionUrl(topic.slug)} className="evidence-card group">
                <h3 className="evidence-card-title">{topic.label}</h3>
                <p className="evidence-card-copy mt-3">{topic.description}</p>
                <span className="evidence-kicker mt-5 inline-block text-[var(--text-primary)]">Open definition ↗</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="discovery-heading">
          <p className="evidence-kicker">Discover by question type</p>
          <h2 id="discovery-heading" className="evidence-section-title mt-4">Do not mix definition, law, mechanism, evidence, and implementation.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {POLICY_DISCOVERY_GROUPS.map((group) => (
              <Link key={group.slug} href={`/discover/${group.slug}`} className="evidence-card">
                <p className="evidence-kicker">{policyPagesForDiscovery(group.slug).length} pages</p>
                <h3 className="evidence-card-title mt-3">{group.label}</h3>
                <p className="evidence-card-copy mt-3">{group.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="federation-heading">
          <p className="evidence-kicker">Federated applications</p>
          <h2 id="federation-heading" className="evidence-section-title mt-4">Follow concepts into research, publishing, and operating systems.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {POLICY_FEDERATION_LINKS.map((item) => <ExternalCard key={item.href} {...item} />)}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="services-heading">
          <div className="evidence-inset">
            <p className="evidence-kicker">From public guidance to governed evidence</p>
            <h2 id="services-heading" className="evidence-section-title mt-4">Need a claim or document assessed for a real decision?</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {POLICY_COMMERCIAL_LINKS.map((item) => <ExternalCard key={item.href} {...item} />)}
            </div>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="boundary-heading">
          <p className="evidence-kicker">Property boundary</p>
          <h2 id="boundary-heading" className="evidence-section-title mt-4">What this property does not establish.</h2>
          <div className="mt-6 max-w-4xl border-l border-[var(--status-unverified)] pl-5">
            <p className="evidence-copy">Maha Policy does not provide legal advice, certify compliance, predict regulatory outcomes, or convert a voluntary standard into law. Current-law pages can become stale; implementation pages do not prove an organization has implemented a control; machine rules apply only within their stated executable contract.</p>
          </div>
        </section>
      </div>
    </main>
  )
}

function ExternalCard({ href, label, description }: { href: string; label: string; description: string }) {
  return <a href={href} className="evidence-card"><h3 className="evidence-card-title">{label}</h3><p className="evidence-card-copy mt-3">{description}</p><span className="evidence-kicker mt-5 inline-block text-[var(--text-primary)]">Open property ↗</span></a>
}
