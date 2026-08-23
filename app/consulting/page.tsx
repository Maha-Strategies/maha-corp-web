// app/consulting/page.tsx
// Verified Research Brief — productized services page.
// On the shared paper system: .evidence-page shell, .evidence-container
// rhythm, and the --status-* tokens in place of the old indigo/emerald/amber
// accents, so the accent colour now carries the same meaning as elsewhere.

import Link from 'next/link'
import type { Metadata } from 'next'
import { TrackedLink } from '@/components/ConversionTracker'
import EngagementPath from '@/components/EngagementPath'
import { MAHA_ORGANIZATION_ID, MAHA_SITE_URL } from '@/lib/entity'

export const metadata: Metadata = {
  title: 'Verified Research Brief — Maha Strategies LLC',
  description:
    'A provenance-tagged research synthesis for decisions that cannot absorb a fabricated claim. Every claim tagged SOURCED, VERIFIED, ILLUSTRATIVE, or UNVERIFIED, with linked evidence. Fixed scope, fixed price, 10 business days.',
}

// ProfessionalService is used here because this page sells a defined, priced
// engagement. The offers below mirror the prices and turnarounds stated in the
// visible copy; they must be updated together.
const consultingJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  '@id': `${MAHA_SITE_URL}/consulting#service`,
  name: 'Verified Research Brief',
  url: `${MAHA_SITE_URL}/consulting`,
  serviceType: 'Provenance-tagged research synthesis',
  description:
    'A research synthesis in which every claim carries a provenance tag — SOURCED, VERIFIED, ILLUSTRATIVE, or UNVERIFIED — with linked evidence, so reviewers can check rather than trust each statement.',
  provider: { '@id': MAHA_ORGANIZATION_ID },
  areaServed: 'Worldwide',
  availableLanguage: 'English',
  offers: [
    {
      '@type': 'Offer',
      name: 'Verified Research Brief',
      price: '2500',
      priceCurrency: 'USD',
      description: 'Fixed scope, fixed price, delivered within 10 business days.',
      url: `${MAHA_SITE_URL}/contact?service=verified_research`,
    },
    {
      '@type': 'Offer',
      name: 'Rapid Intelligence Brief',
      price: '500',
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'PriceSpecification',
        minPrice: '500',
        priceCurrency: 'USD',
      },
      description: 'Starting price. Fixed scope, delivered within five business days.',
      url: `${MAHA_SITE_URL}/rapid-intelligence-brief`,
    },
  ],
}

// ---------------------------------------------------------------------------
// Provenance tag system — the product, shown rather than described.
// ---------------------------------------------------------------------------

const TAGS = [
  {
    key: 'SOURCED',
    color: 'text-[var(--status-verified)] border-[var(--status-verified)] bg-[var(--surface-raised)]',
    dot: 'bg-[var(--status-verified)]',
    definition:
      'Traceable to a primary source. The citation is linked, and the source actually says what the claim says.',
  },
  {
    key: 'VERIFIED',
    color: 'text-sky-400 border-sky-800/60 bg-sky-950/30',
    dot: 'bg-sky-400',
    definition:
      'Independently checked — recomputed, cross-referenced against a second source, or reproduced from the underlying data.',
  },
  {
    key: 'ILLUSTRATIVE',
    color: 'text-[var(--status-boundary)] border-[var(--status-boundary)] bg-[var(--surface-raised)]',
    dot: 'bg-[var(--status-boundary)]',
    definition:
      'An example, analogy, or estimate used for clarity. Useful for reasoning; not evidence.',
  },
  {
    key: 'UNVERIFIED',
    color: 'text-rose-400 border-rose-800/60 bg-rose-950/30',
    dot: 'bg-rose-400',
    definition:
      'Could not be confirmed within scope. Flagged instead of hidden — so you know exactly where the ice is thin.',
  },
] as const

function Tag({ label }: { label: (typeof TAGS)[number]['key'] }) {
  const t = TAGS.find((x) => x.key === label)!
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-1.5 py-0.5 font-mono text-[10px] tracking-widest align-middle ${t.color}`}
    >
      <span className={`w-1.5 h-1.5 inline-block ${t.dot}`} />
      {t.key}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ConsultingPage() {
  return (
    <main className="evidence-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(consultingJsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="evidence-container evidence-container--narrow">

        {/* ================= HERO ================= */}
        <p className="evidence-kicker mb-4">
          [ CONSULTING // VERIFIED RESEARCH BRIEF ]
        </p>
        <h1 className="evidence-title evidence-title--product mb-6">
          Research you can put your name on.
        </h1>
        <p className="text-xl text-[var(--text-secondary)] font-light leading-relaxed max-w-2xl mb-4">
          AI has made research synthesis fast — and unaccountable. Over a thousand
          documented court cases now involve fabricated AI citations. Regulators,
          courts, and boards no longer ask whether you used AI. They ask whether
          you verified it.
        </p>
        <p className="text-xl text-[var(--text-secondary)] font-light leading-relaxed max-w-2xl mb-12">
          The Verified Research Brief answers that question in the document itself:
          every claim carries a provenance tag and linked evidence, so your
          reviewers can see — not trust — where each statement comes from.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-24">
          <TrackedLink
            href="/contact?service=verified_research"
            event="cta_consulting_commission_brief"
            className="evidence-action evidence-action--primary"
          >
            Commission a Brief — $2,500
          </TrackedLink>
          <a
            href="#sample"
            className="evidence-action evidence-action--secondary"
          >
            See a Tagged Page ↓
          </a>
        </div>

        <EngagementPath offer="verified" tone="paper" className="mb-24" />

        <section className="mb-24 border border-[var(--status-sourced)] bg-[var(--surface-raised)] p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[var(--status-sourced)]" />
          <p className="evidence-kicker mb-4">[ Need a faster, narrower answer? ]</p>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-end">
            <div>
              <h2 className="text-2xl text-[var(--text-primary)] font-light mb-3">Rapid Intelligence Brief</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed max-w-2xl">
                One defined market, technology, or policy question. A concise 2–3 page research memo with linked sources, stated assumptions, and decision implications — right-sized for an early decision before it becomes a full diligence program.
              </p>
              <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-widest uppercase mt-5">Starting at $500 · delivered within five business days · fixed scope</p>
            </div>
            <TrackedLink
              href="/rapid-intelligence-brief"
              event="cta_consulting_rapid_brief"
              className="inline-block border border-[var(--text-muted)] text-[var(--text-primary)] font-mono font-bold text-xs tracking-widest uppercase px-7 py-4 hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-colors no-underline text-center"
            >
              Explore Rapid Brief ↗
            </TrackedLink>
          </div>
        </section>

        <section className="mb-24 border-t border-[var(--border-default)] pt-8">
          <p className="font-mono text-[10px] text-[var(--status-sourced)] tracking-widest uppercase mb-5">[ Common research scopes ]</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/consulting/semiconductor-supply-chain" className="border border-[var(--border-default)] p-5 hover:border-[var(--text-muted)] transition-colors">
              <h2 className="text-[var(--text-primary)] text-sm mb-2">Semiconductor supply chains</h2>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">Foundry, packaging, regional diversification, and concentration risk.</p>
            </Link>
            <Link href="/consulting/ai-infrastructure" className="border border-[var(--border-default)] p-5 hover:border-[var(--text-muted)] transition-colors">
              <h2 className="text-[var(--text-primary)] text-sm mb-2">AI infrastructure &amp; edge AI</h2>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">Deployment paths, hardware constraints, and AI economics.</p>
            </Link>
            <Link href="/consulting/evidence-policy" className="border border-[var(--border-default)] p-5 hover:border-[var(--text-muted)] transition-colors">
              <h2 className="text-[var(--text-primary)] text-sm mb-2">Evidence &amp; policy</h2>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">Contested claims, policy exposure, and decision-critical evidence.</p>
            </Link>
          </div>
        </section>

        {/* ================= THE DELIVERABLE ================= */}
        <section className="mb-24">
          <h2 className="evidence-kicker mb-8">
            [ 01 // WHAT YOU RECEIVE ]
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="border-t border-[var(--border-default)] pt-6">
              <h3 className="text-[var(--text-primary)] text-sm tracking-widest uppercase mb-3">
                The Brief
              </h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                A 10–15 page synthesis of the evidence on one question you define —
                a technology bet, a market claim, a scientific literature, a
                competitor&rsquo;s assertion. Written to be read by decision-makers,
                structured to be audited by reviewers.
              </p>
            </div>
            <div className="border-t border-[var(--border-default)] pt-6">
              <h3 className="text-[var(--text-primary)] text-sm tracking-widest uppercase mb-3">
                The Evidence Layer
              </h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Every claim tagged <span className="text-[var(--status-verified)]">SOURCED</span>,{' '}
                <span className="text-sky-400">VERIFIED</span>,{' '}
                <span className="text-[var(--status-boundary)]">ILLUSTRATIVE</span>, or{' '}
                <span className="text-rose-400">UNVERIFIED</span>, with linked
                citations. Nothing laundered, nothing hidden — including what we
                could not confirm.
              </p>
            </div>
            <div className="border-t border-[var(--border-default)] pt-6">
              <h3 className="text-[var(--text-primary)] text-sm tracking-widest uppercase mb-3">
                The Terms
              </h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Fixed scope. Fixed price: <span className="text-[var(--text-primary)]">$2,500</span>.
                Delivered in <span className="text-[var(--text-primary)]">10 business days</span> from
                a scoped question. One revision round included. If the question
                needs narrowing, we narrow it together before you commit.
              </p>
            </div>
          </div>
        </section>

        {/* ================= TAG LEGEND ================= */}
        <section className="mb-24">
          <h2 className="evidence-kicker mb-8">
            [ 02 // THE PROVENANCE SYSTEM ]
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TAGS.map((t) => (
              <div key={t.key} className="border border-[var(--border-default)]/70 p-5">
                <div className="mb-3">
                  <Tag label={t.key} />
                </div>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{t.definition}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ================= WORKED SAMPLE ================= */}
        <section id="sample" className="mb-24 scroll-mt-24">
          <h2 className="evidence-kicker mb-4">
            [ 03 // A TAGGED PAGE, NOT A PROMISE ]
          </h2>
          <p className="text-sm text-[var(--text-muted)] max-w-2xl mb-8 leading-relaxed">
            Excerpt adapted from our published Planet Nine detection forecast
            (Zenodo, DOI&nbsp;
            <a
              href="https://doi.org/10.5281/zenodo.20621056"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--status-sourced)] hover:text-[var(--status-sourced)] underline underline-offset-2"
            >
              10.5281/zenodo.20621056
            </a>
            ). This is what every page of a Verified Research Brief looks like.
          </p>

          <div className="border border-[var(--status-sourced)] bg-[var(--surface-raised)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[var(--status-sourced)]" />
            <div className="p-8 sm:p-10 font-light leading-loose text-[var(--text-secondary)]">
              <p className="mb-6">
                The Vera C. Rubin Observatory&rsquo;s LSST survey is the dominant
                near-term instrument for a wide-area outer solar system search{' '}
                <Tag label="SOURCED" />. Under our Monte Carlo model, the cumulative
                probability of detecting a Planet Nine–class perturber reaches
                71.9% by 2036 <Tag label="VERIFIED" /> — a figure revised upward
                from 61.3% after Revision&nbsp;3 corrected an error in the survey&rsquo;s
                declination cutoff <Tag label="SOURCED" />. For scale, that is
                roughly the difference between a coin flip and a loaded die{' '}
                <Tag label="ILLUSTRATIVE" />. Claims that existing infrared surveys
                have already excluded the candidate orbital range could not be
                confirmed against the primary literature within scope{' '}
                <Tag label="UNVERIFIED" />.
              </p>
              <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-widest uppercase">
                Note the correction trail: Revision 3 moved our own headline number.
                Auditable research means the errors are on the record too.
              </p>
            </div>
          </div>
        </section>

        {/* ================= WHO IT IS FOR ================= */}
        <section className="mb-24">
          <h2 className="evidence-kicker mb-8">
            [ 04 // BUILT FOR HIGH-STAKES CONTEXTS ]
          </h2>
          <p className="text-[var(--text-secondary)] font-light leading-relaxed max-w-2xl mb-6">
            The brief is designed for teams whose documents get audited:
            governance and compliance functions preparing evidence for review,
            legal and policy teams that cannot cite what they cannot trace,
            regulatory and medical writers working under human-in-the-loop
            mandates, and investors or operators making a decision where one
            fabricated claim is more expensive than the entire engagement.
          </p>
          <p className="text-[var(--text-secondary)] font-light leading-relaxed max-w-2xl">
            If your reviewers use words like grounding, audit trail, citation
            verification, or model risk — this document is shaped for their
            checklist.
          </p>
        </section>

        {/* ================= WHY US ================= */}
        <section className="mb-24">
          <h2 className="evidence-kicker mb-8">
            [ 05 // THE METHOD IS PUBLIC ]
          </h2>
          <p className="text-[var(--text-secondary)] font-light leading-relaxed max-w-2xl mb-6">
            We did not invent this methodology for clients. We built it for our own
            published research — pre-registered studies, DOI-archived revisions,
            and an audit paper documenting how AI systems fabricate — and have
            applied it uniformly across astrophysics forecasts, cognitive science
            experiments, and technology market intelligence. Every method claim on
            this page can be checked against the public record at{' '}
            <a
              href="https://research.mahastrategies.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--status-sourced)] hover:text-[var(--status-sourced)] underline underline-offset-2"
            >
              research.mahastrategies.com
            </a>
            .
          </p>
          <p className="font-mono text-xs text-[var(--status-sourced)] font-semibold tracking-widest uppercase">
            [ Zero fabrication. Explicit AI disclosure. Errors corrected on the record. ]
          </p>
        </section>

        {/* ================= CTA ================= */}
        <section className="mb-8">
          <div className="border border-[var(--status-sourced)] bg-[var(--surface-raised)] p-8 sm:p-12 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[var(--status-sourced)]" />
            <h2 className="evidence-kicker mb-4">
              [ COMMISSION // VERIFIED RESEARCH BRIEF ]
            </h2>
            <p className="text-[var(--text-secondary)] text-lg mb-2 font-light max-w-2xl">
              Send the question you need answered and the decision it feeds.
              We reply within two business days with a scoped statement of work —
              or a referral elsewhere if the fit is wrong.
            </p>
            <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-widest uppercase mb-8">
              $2,500 · 10 business days · one revision round · fixed scope
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <TrackedLink
                href="/contact"
                event="cta_consulting_start_conversation"
                className="evidence-action evidence-action--primary"
              >
                Start the Conversation ↗
              </TrackedLink>
              <Link
                href="/contact"
                className="evidence-action evidence-action--secondary"
              >
                Secure Channel / Contact ↗
              </Link>
            </div>
          </div>
        </section>

        {/* ================= FOOTNOTE ================= */}
        <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-widest uppercase text-center mt-16">
          &copy; {new Date().getFullYear()} Maha Strategies LLC · Wyoming, USA · Operating from Colombo
        </p>
      </div>
    </main>
  )
}
