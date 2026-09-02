import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/briefs-data'
import {
  KNOWLEDGE_INTEGRATIONS_PATH,
  NSGOODS_PREFLIGHT_V3_EVIDENCE,
  NSGOODS_PREFLIGHT_V3_EVIDENCE_PATH,
} from '@/lib/knowledge-integration-evidence'

export const metadata: Metadata = {
  title: 'NSGoods Preflight v3 Fixture Validation | Maha Strategies',
  description: NSGOODS_PREFLIGHT_V3_EVIDENCE.summary,
  alternates: { canonical: NSGOODS_PREFLIGHT_V3_EVIDENCE_PATH },
  openGraph: {
    title: 'NSGoods Preflight v3 Fixture Validation | Maha Strategies',
    description: NSGOODS_PREFLIGHT_V3_EVIDENCE.summary,
    url: `${SITE_URL}${NSGOODS_PREFLIGHT_V3_EVIDENCE_PATH}`,
    siteName: 'Maha Strategies',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'NSGoods preflight v3 fixture validation' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NSGoods Preflight v3 Fixture Validation | Maha Strategies',
    description: 'Offline, fixture-only verification with explicit scope boundaries.',
    images: ['/og-master.png'],
  },
}

const coverage = [
  ['Fixture digests verified', '6'],
  ['Component signatures verified', '9'],
  ['Envelope signatures verified', '3'],
  ['Subject-equality checks', '9'],
  ['Tamper cases rejected', '9 / 9'],
  ['Cross-version rejection', '4 v1 + 5 v2 fixtures'],
] as const

export default function NsgoodsPreflightV3ValidationPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: NSGOODS_PREFLIGHT_V3_EVIDENCE.title,
    description: NSGOODS_PREFLIGHT_V3_EVIDENCE.summary,
    url: `${SITE_URL}${NSGOODS_PREFLIGHT_V3_EVIDENCE_PATH}`,
    datePublished: '2026-09-02',
    dateCreated: NSGOODS_PREFLIGHT_V3_EVIDENCE.auditedAt,
    version: NSGOODS_PREFLIGHT_V3_EVIDENCE.schemaVersion,
    isPartOf: {
      '@type': 'CollectionPage',
      name: 'Maha Strategies Integration Evidence',
      url: `${SITE_URL}${KNOWLEDGE_INTEGRATIONS_PATH}`,
    },
    associatedMedia: [{
      '@type': 'DataDownload',
      name: 'Sanitized NSGoods preflight v3 fixture validation record',
      contentUrl: `${SITE_URL}${NSGOODS_PREFLIGHT_V3_EVIDENCE.validationRecordPath}`,
      encodingFormat: 'application/json',
    }],
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-cyan-400 selection:text-black">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article>
        <header className="border-b border-zinc-800 px-6 py-20 sm:px-12">
          <div className="mx-auto max-w-5xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-emerald-300">[ Published validation // Fixture only ]</p>
            <h1 className="mt-7 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">NSGoods composite preflight v3 fixture validation</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-400">{NSGOODS_PREFLIGHT_V3_EVIDENCE.summary}</p>
            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              <span>Status · passed</span>
              <span>Audited 2026-09-01</span>
              <span>Published 2026-09-02</span>
            </div>
            <Link href={KNOWLEDGE_INTEGRATIONS_PATH} className="mt-8 inline-block font-mono text-xs uppercase tracking-widest text-cyan-300 hover:text-cyan-100">← Integration evidence index</Link>
          </div>
        </header>

        <section className="border-b border-zinc-900 px-6 py-14 sm:px-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-semibold text-white">Verified coverage</h2>
            <dl className="mt-7 grid gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-2 lg:grid-cols-3">
              {coverage.map(([label, value]) => (
                <div key={label} className="bg-[#0a0a0c] p-5">
                  <dt className="text-xs leading-5 text-zinc-500">{label}</dt>
                  <dd className="mt-2 font-mono text-sm text-emerald-300">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-sm leading-6 text-zinc-400">Signer authorization was resolved through the pinned proof manifest for composite signer <span className="break-all font-mono text-xs text-zinc-300">{NSGOODS_PREFLIGHT_V3_EVIDENCE.authorizedCompositeSigner}</span>.</p>
          </div>
        </section>

        <section className="border-b border-zinc-900 px-6 py-14 sm:px-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-semibold text-white">Evidence and contract links</h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {[
                ['Sanitized validation record', NSGOODS_PREFLIGHT_V3_EVIDENCE.validationRecordPath, 'Maha · machine-readable JSON'],
                ['Binding contract', NSGOODS_PREFLIGHT_V3_EVIDENCE.contractUrl, 'NSGoods · preflight_v3'],
                ['JSON Schema', NSGOODS_PREFLIGHT_V3_EVIDENCE.schemaUrl, 'NSGoods · machine-readable'],
                ['Fixture digest', NSGOODS_PREFLIGHT_V3_EVIDENCE.fixtureDigestUrl, 'NSGoods · frozen bundle'],
                ['Proof manifest', NSGOODS_PREFLIGHT_V3_EVIDENCE.proofManifestUrl, 'NSGoods · signer authority'],
              ].map(([label, href, kind]) => (
                <a key={label} href={href} className="border border-zinc-800 bg-zinc-950/70 p-5 hover:border-cyan-500/60">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{kind}</p>
                  <p className="mt-3 font-semibold text-white">{label} ↗</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-14 sm:px-12">
          <div className="mx-auto max-w-5xl border-l-2 border-amber-600/70 bg-amber-950/10 p-6">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-amber-200">Scope boundary</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-400">
              <li>This is an offline validation of frozen fixtures and their consumer contract—not a live-endpoint result.</li>
              <li>The verifier made no network calls, used no credentials and made no payment.</li>
              <li>The record does not assert current payability, sanctions status, trust status, payment authorization or escrow-release safety.</li>
              <li>The separately attempted paid canary is not included because its response was not captured and independently verified.</li>
              <li>This is external integration evidence, not certification, endorsement, customer work or commercial validation.</li>
            </ul>
          </div>
        </section>
      </article>
    </main>
  )
}
