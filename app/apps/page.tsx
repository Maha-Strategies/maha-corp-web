import type { Metadata } from 'next'
import Link from 'next/link'
import { APP_STORE_LINKS } from '@/lib/app-store-links'

const pageUrl = 'https://www.mahastrategies.com/apps'

export const metadata: Metadata = {
  title: 'Apps | Maha Strategies',
  description: 'Public documentation, support, and privacy information for educational applications from Maha Strategies.',
  alternates: { canonical: pageUrl },
  openGraph: {
    title: 'Apps | Maha Strategies',
    description: 'Public documentation and support for educational applications from Maha Strategies.',
    url: pageUrl,
    type: 'website',
  },
}

export default function AppsPage() {
  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <section className="evidence-section">
          <p className="evidence-kicker">[ Public application documentation ]</p>
          <h1 className="evidence-title">Apps from Maha Strategies</h1>
          <p className="evidence-lede mt-7">Explore the products, documentation, privacy information, and support boundaries behind Maha Strategies&apos; public applications.</p>
        </section>

        <section className="evidence-section">
          <div className="grid gap-6">
            <article className="evidence-card">
              <p className="evidence-kicker">[ Educational volcano explorer ]</p>
              <h2 className="evidence-card-title mt-2">Mayon</h2>
              <p className="evidence-card-copy mt-3">A free, true-scale exploration of Mayon Volcano for learners, educators, and curious visitors. It combines terrain, historical chapters, and clearly bounded hazard scenarios.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/apps/mayon" className="evidence-action evidence-action--secondary">Read documentation</Link>
                <a href={APP_STORE_LINKS.mayon.ios} className="evidence-link" target="_blank" rel="noreferrer">Download for iOS</a>
                <a href={APP_STORE_LINKS.mayon.android} className="evidence-link" target="_blank" rel="noreferrer">Get it for Android</a>
                <a href={APP_STORE_LINKS.mayon.web} className="evidence-link" target="_blank" rel="noreferrer">Open the web experience</a>
              </div>
            </article>

            <article className="evidence-card">
              <p className="evidence-kicker">[ Local-first mobile app ]</p>
              <h2 className="evidence-card-title mt-2">Maha OS</h2>
              <p className="evidence-card-copy mt-3">A local-first companion for focus and metabolic awareness. It is designed to minimize non-essential off-device telemetry and give your device a more intentional default.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/apps/maha-os" className="evidence-action evidence-action--primary">Explore Maha OS</Link>
                <a href={APP_STORE_LINKS.mahaOs.ios} className="evidence-link" target="_blank" rel="noreferrer">Download for iOS</a>
                <a href={APP_STORE_LINKS.mahaOs.android} className="evidence-link" target="_blank" rel="noreferrer">Get it for Android</a>
              </div>
            </article>

            <article className="evidence-card">
              <p className="evidence-kicker">[ Companion experience ]</p>
              <h2 className="evidence-card-title mt-2">The Dream Engine</h2>
              <p className="evidence-card-copy mt-3">Read <em>The Imagined Life</em>, then use a quiet, private practice for attention, reflection, and ordinary action. Available now on iOS and Android.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/apps/the-engine" className="evidence-action evidence-action--secondary">Explore The Dream Engine</Link>
                <a href={APP_STORE_LINKS.dreamEngine.ios} className="evidence-link" target="_blank" rel="noreferrer">Download for iOS</a>
                <a href={APP_STORE_LINKS.dreamEngine.android} className="evidence-link" target="_blank" rel="noreferrer">Get it for Android</a>
              </div>
            </article>
          </div>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">[ Context and provenance ]</p>
          <h2 className="evidence-section-title">See how the public projects relate</h2>
          <p className="evidence-copy mt-3">The applications, research, publishing tools, and book program share an operator or author in different ways. Their evidence and claims are separate. The public map makes those relationships and boundaries explicit.</p>
          <Link href="/network" className="evidence-link mt-5 inline-block">Open the Maha Knowledge Network</Link>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">[ Evidence-led operating notes ]</p>
          <h2 className="evidence-section-title">What is live, and where boundaries are</h2>
          <p className="evidence-copy mt-3">Our case studies link to the live public work and distinguish documented product behavior from future plans or broader claims.</p>
          <Link href="/case-studies#apps" className="evidence-link mt-5 inline-block">Read the Apps case study</Link>
        </section>
      </div>
    </main>
  )
}
