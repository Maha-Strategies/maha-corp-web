import Link from 'next/link'
import type { Metadata } from 'next'
import { TrackedLink } from '@/components/ConversionTracker'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'Governed Infrastructure for AI and Machine Commerce | Maha Strategies',
  description: 'Maha Strategies governs the path from evidence and context to agent action, payment, delivery, and audit-ready proof.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website', url: SITE_URL, siteName: 'Maha Strategies', title: 'Governed Infrastructure for AI and Machine Commerce | Maha Strategies',
    description: 'Govern the path from evidence and context to agent action, payment, delivery, and audit-ready proof.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Strategies — Verified Research Briefs' }],
  },
  twitter: { card: 'summary_large_image', title: 'Governed Infrastructure for AI and Machine Commerce | Maha Strategies', description: 'Govern evidence, context, agent action, payment, delivery, and proof.', images: ['/og-master.png'], creator: '@mayonemaha' },
}

const capabilities = [
  { number: '01', title: 'Evidence & Context', href: '/evidence-audit', copy: 'Compress, evaluate, and verify the material an AI system relies on while preserving provenance, uncertainty, and a reviewable evidence boundary.' },
  { number: '02', title: 'Agent Control', href: '/enterprise-mcp-gateway', copy: 'Apply inherited policy, approvals, durable task state, and replay-safe recovery before autonomous tools are allowed to act.' },
  { number: '03', title: 'Machine Commerce', href: '/x402-buyer-policy', copy: 'Govern discovery, trust evaluation, spending authority, payment, delivery, and audit evidence across machine-to-machine transactions.' },
]

const work = [
  { category: 'SEMICONDUCTOR STRATEGY', title: 'U.S. Foundry Sovereignization', copy: 'A public analysis of the commercial and geopolitical friction around Intel IDM 2.0 and domestic advanced-node capacity.', href: '/intelligence/briefs/us-foundry-sovereignization' },
  { category: 'AI INFRASTRUCTURE', title: 'The Generative AI Silicon Cycle', copy: 'A public analysis of capacity expansion, the next downturn, and where supply-chain resilience is likely to diverge.', href: '/intelligence/briefs/generative-ai-silicon-cycle-recalibration' },
]

const serviceJsonLd = {
  '@context': 'https://schema.org', '@type': 'Service', '@id': `${SITE_URL}/#verified-research-brief`, name: 'Verified Research Brief', serviceType: 'Evidence-tagged strategic research',
  description: 'A decision-ready, evidence-tagged research synthesis for technology, market, policy, and high-stakes claims.',
  provider: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Maha Strategies LLC', url: SITE_URL }, areaServed: 'Worldwide',
  offers: { '@type': 'Offer', price: '2500', priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: `${SITE_URL}/consulting` },
}

export default function CorporateHomepage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      <div className="evidence-container">
        <header className="max-w-4xl border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3"><span>Maha Strategies</span><span>Governed intelligence · agent infrastructure · machine commerce</span></p>
          <h1 className="evidence-title">Govern the path from evidence to autonomous action.</h1>
          <p className="evidence-lede mt-7">Maha builds infrastructure for AI systems that must reason from traceable context, act within explicit authority, and leave evidence humans can audit.</p>
          <p className="evidence-copy mt-5">One control layer connects evidence and context to policy, approvals, agent execution, payment, delivery, and replay-safe recovery—so autonomy can expand without making accountability disappear.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/developers" className="evidence-action evidence-action--primary">Explore the infrastructure ↗</Link>
            <TrackedLink href="/mps/preflight" event="cta_homepage_mps_preflight" className="evidence-action evidence-action--secondary">Run a private preflight — $49 ↗</TrackedLink>
          </div>
          <p className="evidence-kicker mt-5">Traceable context · bounded authority · controlled payments · durable evidence</p>
        </header>

        <section className="evidence-section" aria-labelledby="decisions-heading">
          <p className="evidence-kicker">One governance path</p>
          <h2 id="decisions-heading" className="evidence-section-title mt-4 max-w-3xl">Control what the system knows, what it may do, and how the result is proven.</h2>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {capabilities.map((capability) => <Link key={capability.number} href={capability.href} className="evidence-card group flex flex-col"><p className="evidence-kicker">{capability.number}</p><h3 className="evidence-card-title mt-4">{capability.title}</h3><p className="evidence-card-copy mt-4 flex-1">{capability.copy}</p><span className="evidence-kicker mt-6 text-[var(--text-primary)]">See how we help ↗</span></Link>)}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="receive-heading">
          <div className="evidence-inset">
            <p className="evidence-kicker">What you receive</p><h2 id="receive-heading" className="evidence-section-title mt-4 max-w-3xl">A clear answer your team can stand behind.</h2>
            <p className="evidence-copy mt-5">In 10–15 pages, you get the decision context, evidence, relevant trade-offs, and a clear boundary between what is established and what still needs judgment.</p>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">{['SOURCED', 'VERIFIED', 'ILLUSTRATIVE', 'UNVERIFIED'].map((tag) => <span key={tag} className="border border-[var(--border-default)] bg-[var(--surface-paper)] px-3 py-2 text-center font-mono text-[10px] tracking-widest text-[var(--text-secondary)]">{tag}</span>)}</div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 font-mono text-xs uppercase tracking-widest"><Link href="/consulting" className="evidence-link">See the method ↗</Link><Link href="/audit" className="evidence-link">Try the live auditor ↗</Link><Link href="/mps" className="evidence-link">Read MPS/0.1 ↗</Link></div>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="work-heading">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="evidence-kicker">Published work</p><h2 id="work-heading" className="evidence-section-title mt-4">Public analysis you can read before you talk to us.</h2></div><div className="flex flex-wrap gap-5 font-mono text-xs uppercase tracking-widest"><Link href="/intelligence" className="evidence-link">Market intelligence ↗</Link><Link href="/case-studies" className="evidence-link">Case studies ↗</Link></div></div>
          <div className="mt-9 grid gap-4 md:grid-cols-2">{work.map((item) => <Link key={item.title} href={item.href} className="evidence-card group"><p className="evidence-kicker">{item.category}</p><h3 className="evidence-card-title mt-3">{item.title}</h3><p className="evidence-card-copy mt-3">{item.copy}</p><span className="evidence-kicker mt-5 inline-block text-[var(--text-primary)]">Read analysis ↗</span></Link>)}</div>
        </section>

        <section className="evidence-section grid gap-8 md:grid-cols-2">
          <article><p className="evidence-kicker">Reproducible evidence</p><h2 className="evidence-card-title mt-4">Check the result before you trust it</h2><p className="evidence-card-copy mt-4 max-w-xl">The WSO2 gateway evaluation publishes every workload as its own row, with the digests and the one command that re-derives each total from them.</p><Link href="/integrations/wso2" className="evidence-link mt-5 inline-block font-mono text-xs uppercase tracking-widest">Review the evaluation ↗</Link></article>
          <article><p className="evidence-kicker">Claim-level provenance</p><h2 className="evidence-card-title mt-4">The Maha Provenance Standard</h2><p className="evidence-card-copy mt-4 max-w-xl">A published, citable standard for tagging the epistemic status of substantive claims, with a free auditor and a public claim registry.</p><Link href="/mps" className="evidence-link mt-5 inline-block font-mono text-xs uppercase tracking-widest">Read MPS/0.1 ↗</Link></article>
        </section>

        <section className="evidence-section" aria-labelledby="tools-heading">
          <p className="evidence-kicker">Self-service tools</p><h2 id="tools-heading" className="evidence-section-title mt-4">Use a focused tool when a full brief is more than you need.</h2><p className="evidence-copy mt-5">Run a receipt-to-CSV batch without an account, or purchase prepaid MPS audit access. These are separate, scoped products—not consulting retainers.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2"><ProductCard href="/utilities/receipts" label="Receipt → CSV" title="Turn receipt photos or text into a CSV" copy="Try a single receipt free, then run a private batch when it parses cleanly." /><ProductCard href="/mps/audit-access" label="MPS audit API" title="Audit claim-level evidence with prepaid access" copy="Purchase a credential scoped only to the MPS audit endpoint—no subscription and no internal access." /></div><Link href="/tools" className="evidence-link mt-6 inline-block font-mono text-xs uppercase tracking-widest">Explore tools & API ↗</Link>
        </section>

        <section className="evidence-section" aria-labelledby="infrastructure-heading"><div className="evidence-inset"><p className="evidence-kicker">Developer infrastructure</p><h2 id="infrastructure-heading" className="evidence-section-title mt-4">Govern tools, bound context, and measure the evidence path.</h2><p className="evidence-copy mt-5">Use Maha&apos;s production APIs for MCP governance, source-linked context compilation, evidence-retention evaluation, bounded optimization, and MPS preflight.</p><div className="mt-7 flex flex-wrap gap-5 font-mono text-xs uppercase tracking-widest"><Link href="/developers" className="evidence-link">Developer infrastructure ↗</Link><Link href="/enterprise-mcp-gateway" className="evidence-link">Enterprise MCP Gateway ↗</Link><Link href="/context-compiler" className="evidence-link">Context Compiler ↗</Link></div></div></section>

        <section className="evidence-section" aria-labelledby="start-heading"><p className="evidence-kicker">Start with the decision</p><h2 id="start-heading" className="evidence-section-title mt-4">What do you need to know before you act?</h2><p className="evidence-copy mt-5">Send the question, the decision it informs, and your deadline. We reply within two business days with a scope—or tell you plainly if we are not the right fit.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><TrackedLink href="/contact?service=verified_research" event="cta_homepage_start_inquiry" className="evidence-action evidence-action--primary">Start an inquiry ↗</TrackedLink><Link href="/contact" className="evidence-action evidence-action--secondary">Contact Maha Strategies ↗</Link></div></section>
      </div>
    </main>
  )
}

function ProductCard({ href, label, title, copy }: { href: string; label: string; title: string; copy: string }) {
  return <Link href={href} className="evidence-card"><p className="evidence-kicker">{label}</p><h3 className="evidence-card-title mt-3">{title}</h3><p className="evidence-card-copy mt-3">{copy}</p></Link>
}
