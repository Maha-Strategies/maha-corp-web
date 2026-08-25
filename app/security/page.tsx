import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_SITE_URL } from '@/lib/entity'
import { BOUNDARY_VERSION } from '@/lib/security/context-control-boundary'

const title = 'Security | Maha Strategies'
const description =
  'How to report a vulnerability to Maha Strategies, what is in scope, and the design properties the platform already assumes. No certification is claimed.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/security' },
  openGraph: { type: 'website', url: `${MAHA_SITE_URL}/security`, title, description },
}

/*
 * The published form of SECURITY.md. Every statement here is the committed
 * policy in that file; test/security-pages.test.ts fails if the two drift.
 */

const IN_SCOPE = [
  'www.mahastrategies.com and its subdomains',
  'the public and credentialed APIs under /api',
  'the MCP gateway',
  'the Stripe webhook endpoints',
  'the published @mahastrategies/sdk package',
]

const OUT_OF_SCOPE = [
  'the vendor platforms themselves (Vercel, Supabase, Upstash, Modal, Stripe, Sentry, Resend) — report those to the vendor',
  'missing security headers with no demonstrated impact',
  'rate-limit findings on endpoints already documented as rate-limited',
  'social engineering',
]

const ASSUMPTIONS = [
  'Credential secrets are disclosed exactly once at issuance and are stored only as hashes. There is no endpoint that returns a credential secret.',
  'Stripe webhook endpoints each use a distinct signing secret, verify the signature against the exact raw body, and record every evt_ ID under a unique constraint committed in the same transaction as its ledger change. Replaying a captured event is expected to be a no-op.',
  'Ledgers are append-only. Corrections are new rows; refunds are reversal entries. Operator interventions go through audited, idempotent actions rather than direct table writes.',
  'Error and performance telemetry is scrubbed before transmission: request bodies, headers, cookies, identity, query strings, and exception messages are dropped, and spans exclude tenant IDs, keys, and JSON-RPC parameters.',
  'Public rate limiting keys on an HMAC of a visitor fingerprint. The source text submitted to the public MPS preflight is deliberately never persisted, and neither is a hash of it.',
]

export default function SecurityPage() {
  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <header>
          <p className="evidence-kicker">[ Security policy ]</p>
          <h1 className="evidence-title mt-4">Reporting a vulnerability</h1>
          <p className="evidence-lede mt-7">
            Report suspected vulnerabilities privately. Do not open a public issue, and do not
            include working exploit details in any public channel.
          </p>
        </header>

        <section className="evidence-section mt-12" aria-labelledby="report-heading">
          <h2 id="report-heading" className="evidence-section-title">
            How to report
          </h2>
          <p className="evidence-copy mt-4">
            Preferred: GitHub&rsquo;s private vulnerability reporting on the repository
            (<strong>Security &rarr; Report a vulnerability</strong>). Failing that, email{' '}
            <a href="mailto:mayone@mahastrategies.com?subject=SECURITY" className="evidence-link">
              mayone@mahastrategies.com
            </a>{' '}
            with <code className="evidence-code px-2 py-1 text-xs">SECURITY</code> in the subject.
          </p>
          <p className="evidence-copy mt-4">
            Please include the affected URL or endpoint, the request that demonstrates the issue,
            what an attacker gains, and whether you accessed any data that was not your own. A first
            response should be expected within three business days. This is a small team; there is
            no bug bounty and no guaranteed remediation window.
          </p>

          <div className="evidence-status-surface evidence-status-surface--boundary mt-8">
            <p className="evidence-status-label">Testing boundaries</p>
            <p className="evidence-copy mt-2">
              Do not test against production accounts you do not control, do not run load or
              denial-of-service tests, and do not access, modify, or retain another
              customer&rsquo;s data. Stop at the point where you have demonstrated the issue.
            </p>
          </div>

          <div className="evidence-status-surface evidence-status-surface--boundary mt-6">
            <p className="evidence-status-label">Credentials found in a report</p>
            <p className="evidence-copy mt-2">
              Any credential shared in a report is treated as compromised and rotated. Never send a
              live API key, Stripe key, service-role key, or customer credential in plaintext;
              describe it by its prefix and where it was found instead.
            </p>
          </div>
        </section>

        <section className="evidence-section mt-14" aria-labelledby="scope-heading">
          <h2 id="scope-heading" className="evidence-section-title">
            Scope
          </h2>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
            <div className="evidence-card">
              <p className="evidence-card-title">In scope</p>
              <ul className="mt-3 grid gap-2 pl-0">
                {IN_SCOPE.map((item) => (
                  <li key={item} className="evidence-card-copy list-none">
                    &middot; {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="evidence-card">
              <p className="evidence-card-title">Out of scope</p>
              <ul className="mt-3 grid gap-2 pl-0">
                {OUT_OF_SCOPE.map((item) => (
                  <li key={item} className="evidence-card-copy list-none">
                    &middot; {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="evidence-section mt-14" aria-labelledby="assumes-heading">
          <h2 id="assumes-heading" className="evidence-section-title">
            What the platform already assumes
          </h2>
          <p className="evidence-copy mt-3">
            These are deliberate design properties, not oversights. A report that depends on one of
            them being different should say so explicitly.
          </p>
          <ul className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 pl-0">
            {ASSUMPTIONS.map((item) => (
              <li key={item} className="evidence-card list-none">
                <p className="evidence-card-copy">{item}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="evidence-section mt-14" aria-labelledby="isolation-heading">
          <h2 id="isolation-heading" className="evidence-section-title">
            Preview and Production are credential-isolated
          </h2>
          <p className="evidence-copy mt-4">
            Preview and Production share one Vercel project, so a variable defined once for both
            environments carries the same value in both. Preview is the least controlled environment
            &mdash; it builds from every pull request &mdash; so a shared credential means anything
            exposing a Preview deployment exposes Production to the same degree.
          </p>
          <p className="evidence-copy mt-4">
            Every credential is therefore per-environment. Preview has its own Supabase project,
            Redis keyspace, Stripe key, operator tokens, and encryption key; it cannot page the
            on-call, drive Production GPU compute, forge signed Stripe webhooks, or send mail from
            the domain. A scheduled check audits this daily and opens an issue if a credential
            becomes shared. The check reads configuration <em>structure</em> rather than values, so
            it never decrypts or handles a secret.
          </p>
        </section>

        <section className="evidence-section mt-14" aria-labelledby="boundary-heading">
          <h2 id="boundary-heading" className="evidence-section-title">
            Product security boundaries
          </h2>
          <p className="evidence-copy mt-4">
            For a reviewer assessing a specific product rather than the reporting process:
          </p>
          <div className="evidence-card mt-6">
            <p className="evidence-card-title">
              Context-Control Security and Data Boundary &middot; v{BOUNDARY_VERSION}
            </p>
            <p className="evidence-card-copy mt-3">
              What the Maha Context Compiler and its bounded WSO2 interceptor handle, retain, and
              refuse &mdash; with every claim mapped to committed source, a test, or a published
              artifact.
            </p>
            <p className="mt-5">
              <Link href="/security/context-control-boundary" className="evidence-action evidence-action--secondary">
                Read the boundary &rarr;
              </Link>
            </p>
          </div>
        </section>

        <div className="evidence-status-surface evidence-status-surface--boundary mt-14">
          <p className="evidence-status-label">No certification is claimed</p>
          <p className="evidence-copy mt-2">
            Maha Strategies holds no security certification or regulatory attestation. Nothing on
            this page is one, and nothing here is a substitute for your own security review.
          </p>
        </div>
      </div>
    </main>
  )
}
