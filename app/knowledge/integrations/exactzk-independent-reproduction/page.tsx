import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/briefs-data'
import {
  EXACTZK_EVIDENCE,
  EXACTZK_EVIDENCE_PATH,
  KNOWLEDGE_INTEGRATIONS_PATH,
} from '@/lib/knowledge-integration-evidence'

export const metadata: Metadata = {
  title: 'ExactZK Independent Reproduction | Maha Strategies',
  description:
    'Signed, independently verified evidence that Maha reproduced the expected ExactZK MNIST MLP circuit-provenance verifying-key digests at a pinned revision.',
  alternates: { canonical: EXACTZK_EVIDENCE_PATH },
  openGraph: {
    title: 'ExactZK Independent Reproduction | Maha Strategies',
    description: 'A bounded, signed and independently verified circuit-provenance reproduction record.',
    url: `${SITE_URL}${EXACTZK_EVIDENCE_PATH}`,
    siteName: 'Maha Strategies',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'ExactZK independent reproduction evidence' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ExactZK Independent Reproduction | Maha Strategies',
    description: 'Signed and independently verified circuit-provenance reproduction evidence.',
    images: ['/og-master.png'],
  },
}

const digestRows = [
  ['Verifying key · SHA-256', EXACTZK_EVIDENCE.verifyingKeySha256],
  ['Verifying key · Keccak-256', EXACTZK_EVIDENCE.verifyingKeyKeccak256],
  ['Signed attestation file · SHA-256', EXACTZK_EVIDENCE.signedFileSha256],
  ['Canonical signed payload · SHA-256', EXACTZK_EVIDENCE.canonicalPayloadSha256],
] as const

export default function ExactZkEvidencePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: EXACTZK_EVIDENCE.title,
    description: EXACTZK_EVIDENCE.summary,
    url: `${SITE_URL}${EXACTZK_EVIDENCE_PATH}`,
    datePublished: '2026-09-01',
    version: EXACTZK_EVIDENCE.bundleRevision,
    isPartOf: {
      '@type': 'CollectionPage',
      name: 'Maha Strategies Integration Evidence',
      url: `${SITE_URL}${KNOWLEDGE_INTEGRATIONS_PATH}`,
    },
    associatedMedia: [
      { '@type': 'DataDownload', name: 'Signed ExactZK attestation', contentUrl: `${SITE_URL}${EXACTZK_EVIDENCE.signedArtifactPath}`, encodingFormat: 'application/json' },
      { '@type': 'DataDownload', name: 'Maha ExactZK integration record', contentUrl: `${SITE_URL}${EXACTZK_EVIDENCE.integrationRecordPath}`, encodingFormat: 'application/json' },
    ],
    sameAs: EXACTZK_EVIDENCE.upstreamPublication,
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-cyan-400 selection:text-black">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <article>
        <header className="border-b border-zinc-800 px-6 py-20 sm:px-12">
          <div className="mx-auto max-w-5xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-emerald-300">[ Published evidence // Independently verified ]</p>
            <h1 className="mt-7 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">ExactZK independent circuit-provenance reproduction</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-400">{EXACTZK_EVIDENCE.summary}</p>
            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              <span>Recorded 2026-09-01</span>
              <span>EZKL {EXACTZK_EVIDENCE.ezklVersion}</span>
              <span>~7 GB observed memory</span>
            </div>
            <Link href={KNOWLEDGE_INTEGRATIONS_PATH} className="mt-8 inline-block font-mono text-xs uppercase tracking-widest text-cyan-300 hover:text-cyan-100">
              ← Integration evidence index
            </Link>
          </div>
        </header>

        <section className="border-b border-zinc-900 px-6 py-14 sm:px-12">
          <div className="mx-auto grid max-w-5xl gap-px border border-zinc-800 bg-zinc-800 md:grid-cols-2">
            {[
              ['Evidence', `The ExactZK bundle was pinned at revision ${EXACTZK_EVIDENCE.bundleRevision}. Maha rebuilt the MNIST MLP verifying key and obtained both expected digests.`],
              ['Context', `The reproduction used EZKL ${EXACTZK_EVIDENCE.ezklVersion}. The record preserves the bundle revision, digest algorithms, memory observation and explicit exclusions.`],
              ['Authority', `Maha Strategies signed the attestation with ${EXACTZK_EVIDENCE.did} using RFC 8785 canonicalization and an RFC 7797 detached ES256K JWS.`],
              ['Receipt', 'The upstream maintainer independently reconstructed the canonical bytes, derived the public key from the did:key identifier and verified the signature before publishing the attestation.'],
            ].map(([label, copy]) => (
              <div key={label} className="bg-[#0a0a0c] p-6">
                <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{label}</p>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-zinc-900 px-6 py-14 sm:px-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-semibold text-white">Evidence links</h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <a href={EXACTZK_EVIDENCE.signedArtifactPath} className="border border-zinc-800 bg-zinc-950/70 p-5 hover:border-cyan-500/60">
                <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Machine-readable · signed JSON</p>
                <p className="mt-3 font-semibold text-white">Maha attestation</p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">RFC 8785 canonicalized payload with detached ES256K JWS proof.</p>
              </a>
              <a href={EXACTZK_EVIDENCE.integrationRecordPath} className="border border-zinc-800 bg-zinc-950/70 p-5 hover:border-cyan-500/60">
                <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Machine-readable · JSON</p>
                <p className="mt-3 font-semibold text-white">Maha integration record</p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">Pinned revisions, verification methods, digests and non-claims.</p>
              </a>
              <a href={EXACTZK_EVIDENCE.upstreamPublication} className="border border-zinc-800 bg-zinc-950/70 p-5 hover:border-cyan-500/60">
                <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Upstream · immutable commit</p>
                <p className="mt-3 font-semibold text-white">Published independent attestation</p>
                <p className="mt-2 break-all text-xs leading-5 text-zinc-500">Commit {EXACTZK_EVIDENCE.publicationCommit}</p>
              </a>
              <a href={EXACTZK_EVIDENCE.upstreamRepository} className="border border-zinc-800 bg-zinc-950/70 p-5 hover:border-cyan-500/60">
                <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Upstream · source bundle</p>
                <p className="mt-3 font-semibold text-white">ExactZK reproduction repository</p>
                <p className="mt-2 break-all text-xs leading-5 text-zinc-500">Bundle revision {EXACTZK_EVIDENCE.bundleRevision}</p>
              </a>
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-900 px-6 py-14 sm:px-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-semibold text-white">Pinned digests</h2>
            <dl className="mt-7 divide-y divide-zinc-800 border-y border-zinc-800">
              {digestRows.map(([label, value]) => (
                <div key={label} className="grid gap-2 py-4 md:grid-cols-[16rem_1fr]">
                  <dt className="text-sm text-zinc-500">{label}</dt>
                  <dd className="break-all font-mono text-xs leading-5 text-zinc-300">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="px-6 py-14 sm:px-12">
          <div className="mx-auto max-w-5xl border-l-2 border-amber-600/70 bg-amber-950/10 p-6">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-amber-200">Scope boundary</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-400">
              <li>This attestation is limited to reproduction of the identified circuit-provenance verifying-key digests.</li>
              <li>It does not validate the full escrow system or establish that the test SRS is suitable for production.</li>
              <li>It is not a security audit, an application-logic correctness proof, a commercial endorsement or a certification.</li>
            </ul>
          </div>
        </section>
      </article>
    </main>
  )
}
