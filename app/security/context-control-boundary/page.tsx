import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_SITE_URL } from '@/lib/entity'
import {
  BOUNDARY_MARKDOWN_PATH,
  BOUNDARY_VERSION,
  SECTIONS,
  VERIFICATION_COMMANDS,
  type SourceKind,
} from '@/lib/security/context-control-boundary'

const title = 'Context-Control Security and Data Boundary | Maha Strategies'
const description =
  'An evidence summary for a technical or procurement reviewer: what the Maha Context Compiler and its bounded WSO2 interceptor handle, retain, and refuse. Every claim maps to committed source.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/security/context-control-boundary' },
  openGraph: {
    type: 'article',
    url: `${MAHA_SITE_URL}/security/context-control-boundary`,
    title,
    description,
  },
}

/*
 * Rendered from lib/security/context-control-boundary, the same module the
 * generator and validator read. No sentence here is retyped: a claim shown on
 * this page is the committed claim text, and the sources listed under it are
 * the committed files the validator checks the digests of. A claim that loses
 * its source fails the build before it reaches a reviewer.
 */

const KIND_LABEL: Record<SourceKind, string> = {
  code: 'Code',
  test: 'Test',
  doc: 'Doc',
  evidence: 'Evidence',
}

const KIND_CHIP: Record<SourceKind, string> = {
  code: 'evidence-chip evidence-chip--sourced',
  test: 'evidence-chip evidence-chip--verified',
  doc: 'evidence-chip evidence-chip--illustrative',
  evidence: 'evidence-chip evidence-chip--boundary',
}

export default function ContextControlBoundaryPage() {
  const claimCount = SECTIONS.reduce((total, section) => total + section.claims.length, 0)

  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <p className="evidence-kicker">
          <Link href="/security" className="evidence-link">
            &larr; Security
          </Link>
        </p>

        <header className="mt-6">
          <p className="evidence-kicker">[ Evidence summary · version {BOUNDARY_VERSION} ]</p>
          <h1 className="evidence-title mt-4">Context-Control Security and Data Boundary</h1>
          <p className="evidence-lede mt-7">
            An evidence summary for a technical or procurement reviewer. Every statement below is
            traceable to committed source, a test, or a published artifact.
          </p>
          <p className="evidence-copy mt-5">
            It claims no certification, no compliance status, no partnership, and no guaranteed
            outcome. Where a boundary is narrower than it might sound, the narrow version is the one
            written down.
          </p>
        </header>

        <div className="evidence-status-surface evidence-status-surface--boundary mt-10">
          <p className="evidence-status-label">Scope of this document</p>
          <p className="evidence-copy mt-2">
            This describes the Maha Context Compiler and its bounded WSO2 interceptor integration
            only. It is not a security certification, a regulatory attestation, a WSO2 endorsement,
            or a substitute for your own review. It makes no statement about your gateway, model
            provider, cloud account, or deployment.
          </p>
        </div>

        {SECTIONS.map((section) => (
          <section key={section.id} className="evidence-section mt-14" aria-labelledby={`${section.id}-heading`}>
            <h2 id={`${section.id}-heading`} className="evidence-section-title">
              {section.title}
            </h2>
            {section.lead && <p className="evidence-copy mt-3 italic">{section.lead}</p>}

            <ul className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 pl-0">
              {section.claims.map((claim) => (
                <li key={claim.id} className="evidence-card list-none">
                  <p className="evidence-card-copy">{claim.text}</p>
                  <p className="evidence-kicker mt-4">Traceable to</p>
                  <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2 pl-0">
                    {claim.sources.map((source) => (
                      <li
                        key={`${claim.id}-${source.path}-${source.note}`}
                        className="flex list-none flex-wrap items-baseline gap-x-3 gap-y-1 text-sm"
                      >
                        <span className={KIND_CHIP[source.kind]}>{KIND_LABEL[source.kind]}</span>
                        <code className="evidence-code px-2 py-1 text-xs">{source.path}</code>
                        <span className="text-sm text-[var(--text-muted)]">{source.note}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="evidence-section mt-14" aria-labelledby="verify-heading">
          <h2 id="verify-heading" className="evidence-section-title">
            Verify it yourself
          </h2>
          <p className="evidence-copy mt-3">
            No credential is needed for any of the following, and none of them contacts a gateway, a
            model provider, or any Maha production system.
          </p>
          <ul className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 pl-0">
            {VERIFICATION_COMMANDS.map((entry) => (
              <li key={entry.command} className="evidence-card list-none">
                <pre className="evidence-code overflow-x-auto p-3 text-xs">{entry.command}</pre>
                <p className="evidence-card-copy mt-3">{entry.what}</p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="evidence-section mt-14">
          <p className="evidence-copy text-sm text-[var(--text-muted)]">
            {claimCount} claims across {SECTIONS.length} sections. The document of record is{' '}
            <code className="evidence-code px-2 py-1 text-xs">{BOUNDARY_MARKDOWN_PATH}</code> in the
            public repository; this page is generated from the same claim set the validator checks.
            A digest that no longer matches means the claim must be re-checked against the code
            before the document is republished.
          </p>
        </footer>
      </div>
    </main>
  )
}
