import Link from 'next/link'
import { APP_STORE_LINKS } from '@/lib/app-store-links'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Maha OS | Local-First Focus and Awareness App',
  description:
    'Maha OS is a local-first mobile app built on edge-compute principles — keeping your data on device and reducing reliance on cloud tracking.',
  alternates: { canonical: 'https://www.mahastrategies.com/software' },
  openGraph: {
    title: 'Maha OS | Local-First Focus and Awareness App',
    description: 'A local-first mobile app designed for a more private, more intentional relationship with your device.',
    url: 'https://www.mahastrategies.com/software',
    type: 'website',
  },
}

const relatedProducts = [
  {
    label: 'Maya',
    description: 'A free, true-scale interactive field trip through Mayon Volcano, its geology, and history.',
    href: '/apps/mayon',
    cta: 'Explore this app →',
  },
  {
    label: 'The Dream Engine',
    description: 'A private companion product focused on reading, reflection, and attention practices.',
    href: '/apps/the-engine',
    cta: 'See the product →',
  },
]

export default function SoftwarePage() {
  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker">[ Local-first infrastructure ]</p>
          <h1 className="evidence-title evidence-title--product">Maha OS</h1>
          <p className="evidence-lede mt-7">A local-first ecosystem for attention and privacy, designed to keep the most personal data and signals on your own device.</p>
          <p className="evidence-copy mt-6">
            Modern platforms increasingly optimize for surveillance and engagement. Maha OS is built around explicit boundaries: on-device processing, encrypted local storage,
            and conservative network use.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href={APP_STORE_LINKS.mahaOs.ios}
              target="_blank"
              rel="noopener noreferrer"
              className="evidence-action evidence-action--primary"
            >
              Download on the App Store
            </a>
            <a
              href={APP_STORE_LINKS.mahaOs.android}
              target="_blank"
              rel="noopener noreferrer"
              className="evidence-action evidence-action--secondary"
            >
              Get it on Google Play
            </a>
          </div>
        </header>

        <section className="evidence-section">
          <p className="evidence-kicker">[ Architectural model ]</p>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="evidence-card">
              <p className="evidence-card-title">Edge compute</p>
              <p className="evidence-card-copy mt-4">Primary inference and processing logic is designed for device-local execution where practical.</p>
            </article>
            <article className="evidence-card">
              <p className="evidence-card-title">Private storage</p>
              <p className="evidence-card-copy mt-4">Sensitive workflow state and behavior metrics remain device-bound with controlled sync boundaries.</p>
            </article>
            <article className="evidence-card">
              <p className="evidence-card-title">Attention safety</p>
              <p className="evidence-card-copy mt-4">Product behavior favors intention-aligned work over endless engagement loops.</p>
            </article>
          </div>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">[ Position statement ]
          </p>
          <p className="evidence-copy">
            Many enterprise and consumer environments assume cloud-first design and optimize for ad-monetized scale. This is incompatible with high-stakes privacy.
            Maha OS exists as a practical counterexample: a local-first baseline for individuals who want data continuity without the same collection model.
          </p>
          <p className="evidence-copy mt-6">
            When used in a regulated workflow, this model can reduce attack surface and simplify governance of behavioral and personal telemetry.
          </p>
          <Link href="/research/architecture-of-attention" className="evidence-link mt-7 block">
            Read: The Architecture of Attention ↗
          </Link>
          <a href="/on-device-ai-vs-cloud" className="evidence-link mt-3 block">
            Read the companion on-device-vs-cloud decision guide ↗
          </a>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">[ Related products ]</p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {relatedProducts.map((item) => (
              <article key={item.label} className="evidence-card">
                <p className="evidence-kicker">{item.label}</p>
                <p className="evidence-card-title mt-3">Companion application</p>
                <p className="evidence-card-copy mt-3">{item.description}</p>
                <Link href={item.href} className="evidence-link mt-5 inline-block">
                  {item.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">[ Next step ]</p>
          <p className="evidence-copy mt-5">
            If your team is evaluating local-first software, we can run a bounded discovery and measurement pass to compare on-device retention, usability, and runtime behavior
            before deployment.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/start" className="evidence-action evidence-action--primary">Request a private architecture read</Link>
            <Link href="/context-compiler" className="evidence-action evidence-action--secondary">See context compiler evidence</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
