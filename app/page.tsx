import Link from 'next/link'
import type { Metadata } from 'next'
import { TrackedLink } from '@/components/ConversionTracker'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'Verified Research Briefs | Maha Strategies',
  description:
    'Decision-ready, evidence-tagged research briefs for teams evaluating technology, markets, policy, and high-stakes claims. Fixed scope, $2,500, delivered in 10 business days.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Maha Strategies',
    title: 'Verified Research Briefs | Maha Strategies',
    description:
      'Evidence-tagged research for decisions that cannot absorb a fabricated claim. Fixed scope, $2,500, delivered in 10 business days.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Strategies — Verified Research Briefs' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Verified Research Briefs | Maha Strategies',
    description:
      'Decision-ready, evidence-tagged research for high-stakes technology, market, and policy decisions.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const capabilities = [
  {
    number: '01',
    title: 'Technology & AI',
    href: '/consulting/ai-infrastructure',
    copy: 'Assess a technology bet, vendor claim, AI deployment path, or emerging technical risk before it reaches a board memo or investment committee.',
  },
  {
    number: '02',
    title: 'Markets & Supply Chains',
    href: '/consulting/semiconductor-supply-chain',
    copy: 'Map semiconductor, manufacturing, and infrastructure exposure with the sources and uncertainty made visible—not buried in a polished narrative.',
  },
  {
    number: '03',
    title: 'Policy & Evidence',
    href: '/consulting/evidence-policy',
    copy: 'Turn a contested question into a decision-ready brief with claims that legal, governance, and policy reviewers can trace.',
  },
]

const work = [
  {
    category: 'OPEN EDITION',
    title: 'The Orbital Mind',
    copy: 'A systems psychology of attention, desire, agency, limit, imagination, and integration.',
    href: '/books/the-orbital-mind',
  },
  {
    category: 'OPEN EDITION',
    title: 'The Synthetic Self',
    copy: 'A book about language models, human judgment, and the record we are teaching machines to reflect.',
    href: '/books/the-synthetic-self',
  },
  {
    category: 'OPEN EDITION',
    title: 'The Unfinished Species',
    copy: 'A book about evolution, self-design, and the conditions intelligence creates for its own development.',
    href: '/books/the-unfinished-species',
  },
  {
    category: 'OPEN EDITION',
    title: 'The Imagined Life',
    copy: 'A book about dreaming, imagination, and the work of turning a possible future into an actual one.',
    href: '/books/the-imagined-life',
  },
  {
    category: 'INTERACTIVE PROTOTYPE',
    title: 'Overclock',
    copy: 'A five-round risk game about escalating stakes, imperfect information, and knowing when to bank a decision.',
    href: '/overclock',
  },
  {
    category: 'SEMICONDUCTOR STRATEGY',
    title: 'U.S. Foundry Sovereignization',
    copy: 'A public analysis of the commercial and geopolitical friction around Intel IDM 2.0 and domestic advanced-node capacity.',
    href: '/intelligence/briefs/us-foundry-sovereignization',
  },
  {
    category: 'AI INFRASTRUCTURE',
    title: 'The Generative AI Silicon Cycle',
    copy: 'A public analysis of capacity expansion, the next downturn, and where supply-chain resilience is likely to diverge.',
    href: '/intelligence/briefs/generative-ai-silicon-cycle-recalibration',
  },
]

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  '@id': `${SITE_URL}/#verified-research-brief`,
  name: 'Verified Research Brief',
  serviceType: 'Evidence-tagged strategic research',
  description:
    'A decision-ready, evidence-tagged research synthesis for technology, market, policy, and high-stakes claims.',
  provider: {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'Maha Strategies LLC',
    url: SITE_URL,
  },
  areaServed: 'Worldwide',
  offers: {
    '@type': 'Offer',
    price: '2500',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    url: `${SITE_URL}/consulting`,
  },
}

export default function CorporateHomepage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />

      <div className="max-w-4xl mx-auto px-6 py-20 sm:py-28">
        <section className="max-w-3xl">
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-5">
            [ Maha Strategies // Verified Research Briefs ]
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-white leading-[1.08] tracking-tight mb-7">
            Evidence you can defend in the room.
          </h1>
          <p className="text-xl sm:text-2xl text-zinc-300 font-light leading-relaxed mb-5">
            We turn complex technology, market, and policy questions into decision-ready research briefs with every claim clearly tagged to its evidence.
          </p>
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl mb-10">
            Built for operators, investors, policy teams, and anyone whose work will be challenged, audited, or acted upon. No anonymous synthesis. No citations you cannot trace.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <TrackedLink
              href="/contact"
              event="cta_homepage_commission_brief"
              className="inline-block bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-7 py-4 hover:bg-zinc-200 transition-colors text-center"
            >
              Commission a Brief — $2,500 ↗
            </TrackedLink>
            <Link
              href="/consulting#sample"
              className="inline-block border border-zinc-600 text-zinc-200 font-mono font-bold text-xs tracking-widest uppercase px-7 py-4 hover:border-white hover:text-white transition-colors text-center"
            >
              See a Tagged Page ↓
            </Link>
          </div>
          <p className="font-mono text-xs text-zinc-400 tracking-widest uppercase">
            Fixed scope · 10 business days · one revision round · sources linked in the document
          </p>
        </section>

        <section className="mt-24 border-t border-zinc-800 pt-10">
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-8">
            [ What we help you decide ]
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {capabilities.map((capability) => (
              <Link key={capability.number} href={capability.href} className="group border-t border-zinc-700 pt-5 hover:border-zinc-400 transition-colors">
                <p className="font-mono text-[10px] text-zinc-600 tracking-widest mb-3">{capability.number}</p>
                <h2 className="text-white text-lg mb-3 group-hover:text-indigo-300 transition-colors">{capability.title}</h2>
                <p className="text-sm text-zinc-400 leading-relaxed">{capability.copy}</p>
                <span className="inline-block mt-4 font-mono text-xs text-zinc-400 group-hover:text-white tracking-widest uppercase">Explore this brief ↗</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-24 border border-indigo-900/50 bg-indigo-950/20 p-7 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-indigo-500" />
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">
            [ The deliverable ]
          </p>
          <h2 className="text-2xl sm:text-3xl font-light text-white mb-5">
            A brief that shows its work.
          </h2>
          <p className="text-zinc-400 leading-relaxed max-w-2xl mb-7">
            Each 10–15 page brief separates what is sourced, independently verified, illustrative, and still unverified. Your team sees the strength of the evidence before it sees the conclusion.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-[10px] tracking-widest">
            {['SOURCED', 'VERIFIED', 'ILLUSTRATIVE', 'UNVERIFIED'].map((tag) => (
              <span key={tag} className="border border-zinc-700 px-3 py-2 text-zinc-300 text-center">{tag}</span>
            ))}
          </div>
          <Link href="/consulting" className="inline-block mt-8 text-xs font-mono text-indigo-300 hover:text-white tracking-widest uppercase transition-colors">
            Explore the methodology ↗
          </Link>
          <div className="mt-5 flex flex-col sm:flex-row gap-x-6 gap-y-3 font-mono text-[10px] tracking-widest uppercase">
            <Link href="/audit" className="text-zinc-400 hover:text-white transition-colors">Try the live auditor ↗</Link>
            <Link href="/mps" className="text-zinc-400 hover:text-white transition-colors">Read the MPS/0.1 standard ↗</Link>
          </div>
        </section>

        <section className="mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-3">[ Published work ]</p>
              <h2 className="text-2xl sm:text-3xl font-light text-white">Books, essays, and public analysis.</h2>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3 font-mono text-xs tracking-widest uppercase">
              <Link href="/books" className="text-indigo-300 hover:text-white transition-colors">View all books ↗</Link>
              <Link href="/intelligence" className="text-zinc-400 hover:text-white transition-colors">View market intelligence ↗</Link>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {work.map((item) => (
              <Link key={item.title} href={item.href} className="group border border-zinc-800 p-6 hover:border-zinc-500 hover:bg-zinc-900/30 transition-colors">
                <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">{item.category}</p>
                <h3 className="text-lg text-zinc-100 group-hover:text-white mb-3">{item.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{item.copy}</p>
                <span className="inline-block mt-5 font-mono text-xs text-zinc-400 group-hover:text-white tracking-widest uppercase">
                  {item.category === 'OPEN EDITION' ? 'Explore book ↗' : item.category === 'INTERACTIVE PROTOTYPE' ? 'Play prototype ↗' : 'Read analysis ↗'}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-24 border-t border-zinc-800 pt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-3">[ Independent research ]</p>
            <h2 className="text-xl text-white mb-3">Systemic sovereignty</h2>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Maha Strategies also publishes independent work on semiconductor resilience, edge AI, human autonomy, and the systems that connect them.
            </p>
            <Link href="/research" className="font-mono text-xs text-zinc-400 hover:text-white tracking-widest uppercase transition-colors">Browse research ↗</Link>
          </div>
          <div>
            <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-3">[ The Maha Principle ]</p>
            <h2 className="text-xl text-white mb-3">The architecture of human flourishing</h2>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Our book examines the biological, cognitive, and relational foundations of independence in an extractive world.
            </p>
            <a href="https://www.themahaprinciple.com" target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-zinc-400 hover:text-white tracking-widest uppercase transition-colors">Read the book brief ↗</a>
          </div>
        </section>

        <section className="mt-24 border border-indigo-900/50 bg-indigo-950/20 p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-indigo-500" />
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">[ Start with the decision ]</p>
          <h2 className="text-2xl sm:text-3xl font-light text-white mb-4">What do you need to know before you act?</h2>
          <p className="text-zinc-400 leading-relaxed max-w-2xl mb-8">
            Send the question, the decision it informs, and the deadline you are working to. We reply within two business days with a scope—or tell you plainly if we are not the right fit.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <TrackedLink href="/contact" event="cta_homepage_start_inquiry" className="inline-block bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-7 py-4 hover:bg-zinc-200 transition-colors text-center">Start an Inquiry ↗</TrackedLink>
            <Link href="/contact" className="inline-block border border-zinc-600 text-zinc-200 font-mono font-bold text-xs tracking-widest uppercase px-7 py-4 hover:border-white hover:text-white transition-colors text-center">Contact Maha Strategies ↗</Link>
          </div>
        </section>
      </div>

      <footer className="border-t border-zinc-900 px-6 py-10 text-center">
        <p className="font-mono text-[10px] text-zinc-700 tracking-widest uppercase">© {new Date().getFullYear()} Maha Strategies LLC</p>
      </footer>
    </main>
  )
}
