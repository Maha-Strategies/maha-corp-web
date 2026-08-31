import type { Metadata } from 'next'
import Link from 'next/link'

import { TrackedLink } from '@/components/ConversionTracker'
import { YouTubeLiteEmbed } from '@/components/YouTubeLiteEmbed'
import { FOUNDING_PARTNER } from '@/lib/commercial/context-control-assessment-offer'

const SITE_URL = 'https://www.mahastrategies.com'
const VIDEO_URL = 'https://www.youtube.com/watch?v=zDNs0Ndwx3Y'
const title = 'The Evidence Layer for Autonomous Systems | Maha Strategies'
const description = 'A six-minute investor and partner demonstration of Maha Strategies’ governed evidence, context, agent-control, and machine-commerce infrastructure.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/demo' },
  openGraph: {
    type: 'video.other',
    url: `${SITE_URL}/demo`,
    siteName: 'Maha Strategies',
    title,
    description,
    images: [{ url: '/demo/evidence-layer-thumbnail.png', width: 1280, height: 720, alt: 'The evidence layer for autonomous systems' }],
    videos: [{ url: VIDEO_URL, width: 1280, height: 720 }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/demo/evidence-layer-thumbnail.png'] },
}

const chapters = [
  { time: '00:00', seconds: 0, title: 'Why autonomous systems need an evidence layer' },
  { time: '00:42', seconds: 42, title: 'From governed knowledge to bounded action' },
  { time: '01:44', seconds: 104, title: 'Deterministic evidence and context infrastructure' },
  { time: '03:13', seconds: 193, title: 'Independent integrations and machine commerce' },
  { time: '04:45', seconds: 285, title: 'The design-partner path' },
] as const

const videoJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  '@id': `${SITE_URL}/demo#video`,
  name: 'The evidence layer for autonomous systems',
  description,
  thumbnailUrl: [`${SITE_URL}/demo/evidence-layer-thumbnail.png`],
  uploadDate: '2026-08-31',
  duration: 'PT5M58S',
  contentUrl: VIDEO_URL,
  embedUrl: 'https://www.youtube-nocookie.com/embed/zDNs0Ndwx3Y',
  publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Maha Strategies LLC', url: SITE_URL },
}

export default function DemoPage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd).replace(/</g, '\\u003c') }} />
      <div className="evidence-container evidence-container--narrow">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3"><span>Investor &amp; partner demonstration</span><span>05:58 · August 2026</span></p>
          <h1 className="evidence-title evidence-title--product">The evidence layer for autonomous systems.</h1>
          <p className="evidence-lede mt-7">Maha governs the path from source material to AI context, agent action, payment, delivery, and audit-ready proof.</p>
          <p className="evidence-copy mt-5">This six-minute demonstration explains what is operational, what has been independently exercised, and where a design partner can help turn bounded infrastructure into a real production workflow.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <TrackedLink href="/contact?service=general" event="cta_demo_design_partner" className="evidence-action evidence-action--primary">Discuss a design partnership ↗</TrackedLink>
            <Link href="/developers" className="evidence-action evidence-action--secondary">Inspect the infrastructure ↗</Link>
          </div>
        </header>

        <section className="evidence-section" aria-label="Maha Strategies video demonstration">
          <div className="border border-[var(--border-default)] bg-black p-1"><YouTubeLiteEmbed /></div>
          <p className="mt-4 text-xs leading-6 text-[var(--text-muted)]">The YouTube player loads only after you press play. You can also <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer" className="evidence-link">watch directly on YouTube ↗</a>.</p>
        </section>

        <section className="evidence-section" aria-labelledby="demonstration-map">
          <p className="evidence-kicker">Demonstration map</p>
          <h2 id="demonstration-map" className="evidence-section-title mt-4">A compact view of the operating system.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {chapters.map((chapter) => (
              <a key={chapter.time} href={`${VIDEO_URL}&t=${chapter.seconds}s`} target="_blank" rel="noopener noreferrer" className="evidence-card group">
                <span className="evidence-kicker text-[var(--status-sourced)]">{chapter.time}</span>
                <span className="evidence-card-title mt-3 block text-lg">{chapter.title}</span>
                <span className="evidence-link mt-4 inline-block font-mono text-[10px] uppercase tracking-widest">Open chapter ↗</span>
              </a>
            ))}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="operational-evidence">
          <p className="evidence-kicker">What has been demonstrated</p>
          <h2 id="operational-evidence" className="evidence-section-title mt-4">Evidence with named boundaries.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <EvidenceCard title="Governed knowledge releases" value="64 exact revisions" body="A completed production cohort passed Maha’s governed release lifecycle. The claim is about those exact revisions, not every page or future release." href="/knowledge" action="Inspect the knowledge system" />
            <EvidenceCard title="Fixed-budget context retention" value="60.4% complete retention" body="BM25 preserved a complete human evidence set for 60.4% of 250 answerable QASPER questions under a 2,048-token allowance. The oracle reached 99.6%; this measures evidence availability, not answer correctness." href="/benchmarks/context-retention" action="Review MCRB-1" />
            <EvidenceCard title="Fulcra Flow State" value="Merged contribution" body="Fulcra community PR #33 preserved metadata-only provenance for one bounded Flow State path. The private validation used synthetic media and did not retain or publish creative audio." href="/artifacts/integrations/fulcra-flow-state-pr-33.json" action="Read the sanitized artifact" />
            <EvidenceCard title="CABEZON / Thrivbe" value="Encrypted no-money enquiry" body="One reciprocal CARP onboarding and one encrypted tea enquiry completed with explicit enquiry-only boundaries. No purchase, payment, reservation, escrow, or delivery action occurred." href="/artifacts/carp/thrivbe-tea-enquiry-success-2026-08-28.json" action="Read the sanitized artifact" />
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="partner-path">
          <div className="evidence-inset">
            <p className="evidence-kicker text-[var(--status-boundary)]">Paid design-partner path</p>
            <h2 id="partner-path" className="evidence-section-title mt-4">Turn one consequential workflow into an auditable implementation.</h2>
            <p className="evidence-copy mt-5">A bounded engagement freezes one workflow and its acceptance criteria, then produces human-readable and machine-readable evidence: exact source locators, unsupported-inference checks, provenance digests, reproducibility receipts, and a private Evidence Dossier.</p>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Metric label="Standard assessment" value="$12,500" detail="One customer-supplied workload, three paths, and a written proceed, revise, or stop recommendation." />
              <Metric label="Founding design partner" value={FOUNDING_PARTNER.price} detail={`Limited to ${FOUNDING_PARTNER.limit}, with the published reference-participation conditions.`} />
              <Metric label="Initial boundary" value="One workflow" detail="Scope and acceptance criteria are agreed before either side commits. Implementation beyond the assessment is separate." />
            </div>
            <p className="mt-6 text-xs leading-6 text-[var(--text-muted)]">{FOUNDING_PARTNER.notADiscount}</p>
            <div className="mt-7 flex flex-wrap gap-3"><TrackedLink href="/contact?service=general" event="cta_demo_scope_pilot" className="evidence-action evidence-action--primary">Identify a suitable workflow ↗</TrackedLink><Link href="/pricing#assessment-options" className="evidence-action evidence-action--secondary">Read pricing and boundaries ↗</Link></div>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="ways-to-work">
          <p className="evidence-kicker">Three ways to engage</p>
          <h2 id="ways-to-work" className="evidence-section-title mt-4">Choose the relationship, then define the boundary.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Path title="Design partner" body="Apply the evidence layer to one real workflow and help shape the product through an agreed, paid evaluation." href="/contact?service=general" action="Discuss a workflow" />
            <Path title="Distribution partner" body="Bring Maha’s MCP, evidence, and machine-readable delivery surfaces into an existing developer or enterprise channel." href="/enterprise-mcp-gateway" action="Review the gateway" />
            <Path title="Investor or strategic partner" body="Review the operating evidence, commercial model, and roadmap before a focused conversation with the founder." href="/contact?service=general" action="Contact Maha" />
          </div>
        </section>
      </div>
    </main>
  )
}

function EvidenceCard({ title, value, body, href, action }: { title: string; value: string; body: string; href: string; action: string }) {
  return <article className="evidence-card flex min-h-full flex-col"><p className="evidence-kicker">{title}</p><p className="mt-3 font-mono text-2xl text-[var(--status-verified)]">{value}</p><p className="evidence-card-copy mt-4 flex-1">{body}</p><Link href={href} className="evidence-link mt-6 inline-block font-mono text-[10px] uppercase tracking-widest">{action} ↗</Link></article>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="border-t border-[var(--border-default)] pt-4"><p className="evidence-kicker">{label}</p><p className="mt-3 font-mono text-2xl text-[var(--text-primary)]">{value}</p><p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">{detail}</p></div>
}

function Path({ title, body, href, action }: { title: string; body: string; href: string; action: string }) {
  return <article className="evidence-card flex min-h-full flex-col"><h3 className="evidence-card-title text-lg">{title}</h3><p className="evidence-card-copy mt-4 flex-1">{body}</p><Link href={href} className="evidence-link mt-6 inline-block font-mono text-[10px] uppercase tracking-widest">{action} ↗</Link></article>
}
