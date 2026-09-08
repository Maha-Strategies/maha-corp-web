import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  POLICY_DISCOVERY_GROUPS,
  POLICY_SITE_URL,
  policyDiscoveryGroup,
  policyPagesForDiscovery,
} from '@/lib/policy-front-door'

type Props = { params: Promise<{ group: string }> }

export const dynamicParams = false
export function generateStaticParams() { return POLICY_DISCOVERY_GROUPS.map((group) => ({ group: group.slug })) }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { group: slug } = await params
  const group = policyDiscoveryGroup(slug)
  if (!group) return {}
  const url = `${POLICY_SITE_URL}/discover/${group.slug}`
  return {
    title: group.label,
    description: group.description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, siteName: 'Maha Policy', title: `${group.label} | Maha Policy`, description: group.description },
  }
}

export default async function PolicyDiscoveryPage({ params }: Props) {
  const { group: slug } = await params
  const group = policyDiscoveryGroup(slug)
  if (!group) notFound()
  const pages = policyPagesForDiscovery(slug)
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    url: `${POLICY_SITE_URL}/discover/${group.slug}`, name: `${group.label} | Maha Policy`,
    description: group.description, numberOfItems: pages.length,
    hasPart: pages.map((page) => ({ '@type': 'TechArticle', url: page.canonicalUrl, name: page.title })),
  }
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="evidence-container">
        <header className="max-w-4xl border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker"><Link href="/">Maha Policy</Link> · discovery index</p>
          <h1 className="evidence-title">{group.label}</h1>
          <p className="evidence-lede mt-7">{group.description}</p>
          <p className="evidence-copy mt-5">This index contains {pages.length} active, exact-revision Policy pages. Inclusion does not transfer evidence, authority, jurisdiction, or review from one topic to another.</p>
        </header>
        <nav className="evidence-section" aria-label="Policy discovery indexes">
          <div className="flex flex-wrap gap-3">
            {POLICY_DISCOVERY_GROUPS.map((item) => <Link key={item.slug} href={`/discover/${item.slug}`} className={item.slug === slug ? 'evidence-action evidence-action--primary' : 'evidence-action evidence-action--secondary'}>{item.label}</Link>)}
          </div>
        </nav>
        <section className="evidence-section" aria-labelledby="pages-heading">
          <h2 id="pages-heading" className="evidence-section-title">{pages.length} governed pages</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {pages.map((page) => (
              <Link key={page.candidateId} href={page.canonicalUrl} className="evidence-card">
                <h3 className="evidence-card-title">{page.title}</h3>
                <p className="evidence-card-copy mt-3">{page.directAnswer}</p>
                <span className="evidence-kicker mt-5 inline-block text-[var(--text-primary)]">Read governed page ↗</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
