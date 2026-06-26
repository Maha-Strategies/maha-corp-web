// app/page.tsx
import Link from 'next/link'

// Data extracted from sitemap for active intelligence
const intelligenceBriefs = [
  { id: "INT-01", title: "Angstrom-Era SoC Architecture", href: "/intelligence/briefs/angstrom-era-soc-architecture" },
  { id: "INT-02", title: "US Foundry Sovereignization", href: "/intelligence/briefs/us-foundry-sovereignization" },
  { id: "INT-03", title: "Backside Microchannel Semiconductors", href: "/intelligence/briefs/backside-microchannel-semiconductors" },
  { id: "INT-04", title: "AI Software Cost Trajectory 2040", href: "/intelligence/briefs/ai-software-cost-trajectory-2040" },
];

// Data extracted from sitemap for tactical doctrine
const doctrineBriefs = [
  { id: "DOC-01", title: "The Protocol of Precision", href: "/doctrine/briefs/protocol-of-precision" },
  { id: "DOC-02", title: "Strategic Gravity", href: "/doctrine/briefs/strategic-gravity" },
  { id: "DOC-03", title: "Harmonic Command", href: "/doctrine/briefs/harmonic-command" },
  { id: "DOC-04", title: "The Saturnian Vision", href: "/doctrine/briefs/saturnian-vision" },
];

// Book launch / pre-order block. Links out to Amazon (purchase) and the
// dedicated book site (full details). Verify the TODO-flagged fields.
const BOOK = {
  title: 'The Maha Principle',
  // TODO: confirm exact subtitle as it appears on the Amazon listing.
  subtitle: 'Architecting Personal and National Renewal',
  asin: 'B0H62WLMT5',
  amazonUrl: 'https://www.amazon.com/dp/B0H62WLMT5',
  siteUrl: 'https://www.themahaprinciple.com',
  price: '$2.99',
  format: 'Kindle',
  launchDate: 'July 10, 2026',
  // Cover lives at /public/The_Maha_Principle_cover_v2.jpg
  coverSrc: '/The_Maha_Principle_cover_v2.jpg',
};

export function BookPreorderSection() {
  return (
    <section className="mt-4 mb-20 not-prose">
      <div className="border border-indigo-900/50 bg-indigo-950/20 p-8 sm:p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>

        <h2 className="text-white font-mono text-sm tracking-widest uppercase mb-8 mt-0">
          [ THE BOOK // CORE DOCTRINE ]
        </h2>

        <div className="flex flex-col md:flex-row gap-8 md:gap-12 md:items-center">
          {/* COVER */}
          <div className="shrink-0 w-40 sm:w-48 mx-auto md:mx-0">
            {/* Using a plain <img> to avoid next/image config assumptions. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BOOK.coverSrc}
              alt={`${BOOK.title} — book cover`}
              className="w-full h-auto border border-zinc-800 shadow-2xl shadow-black/60"
            />
          </div>

          {/* DETAILS */}
          <div className="flex-grow">
            <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-3">
              The Book — Launching {BOOK.launchDate}
            </p>
            <h3 className="text-3xl sm:text-4xl font-light text-white mb-2 leading-tight">
              {BOOK.title}
            </h3>
            <p className="text-zinc-400 font-serif italic mb-6">
              {BOOK.subtitle}
            </p>
            <p className="text-zinc-300 font-light mb-8 max-w-xl leading-relaxed">
              {/* TODO: swap for your own one-paragraph pitch from themahaprinciple.com. */}
              The foundational text behind everything Maha Strategies researches:
              metabolic decline, attentional capture, and systemic fragmentation as
              one coupled phenomenon — and a framework for engineering renewal
              at the level of the individual and the nation.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href={BOOK.amazonUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-8 py-4 hover:bg-zinc-200 transition-colors no-underline text-center"
              >
                {/* TODO: before launch use "Pre-order on Amazon"; after, "Get it on Amazon". */}
                Get it on Amazon — {BOOK.price} {BOOK.format} ↗
              </a>
              <a
                href={BOOK.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block border border-zinc-600 text-zinc-200 font-mono font-bold text-xs tracking-widest uppercase px-8 py-4 hover:border-white hover:text-white transition-colors no-underline text-center"
              >
                Read the Full Brief ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProtocolAnchorGrid() {
  const protocols = [
    {
      id: "01",
      title: "Metabolic Sovereignty",
      subtitle: "The Algorithmic Trance & Biological Substrates",
      href: "/protocols/metabolic-sovereignty",
      status: "ACTIVE"
    },
    {
      id: "02",
      title: "The Digital Firewall",
      subtitle: "The Saturnian Perimeter & Cognitive Defense",
      href: "/protocols/digital-firewall",
      status: "ACTIVE"
    },
    {
      id: "03",
      title: "Kinetic Friction",
      subtitle: "The Iron Engine & Engineered Resistance",
      href: "/protocols/kinetic-friction",
      status: "ACTIVE"
    },
    {
      id: "04",
      title: "Hardware Sovereignty",
      subtitle: "Edge-Compute Intelligence & Local Silicon",
      href: "/protocols/hardware-sovereignty",
      status: "ACTIVE"
    },
    {
      id: "05",
      title: "Architecting Renewal",
      subtitle: "The Sovereign Ecosystem Apex Node",
      href: "/protocols/architecting-renewal",
      status: "STABLE",
      isApex: true
    },
    {
      id: "VI",
      title: "Policy & Statecraft",
      subtitle: "The Civilizational Tier & Legislative Architecture",
      href: "/policy",
      status: "DOCTRINE"
    }
  ];

  return (
    <section className="w-full py-20 border-t border-gray-950 bg-[#0a0a0c] text-white">
      <div className="max-w-4xl mx-auto px-6 font-mono">
        
        {/* CLEAR HEADING FIRST */}
        <h2 className="font-sans text-2xl font-bold tracking-tight text-white mb-3 uppercase">
          Core Systemic Doctrines
        </h2>
        <p className="font-sans text-sm text-gray-400 mb-8 max-w-2xl normal-case tracking-normal font-light leading-relaxed">
          Our research is organized into a set of doctrines &mdash; each one a practical framework for staying independent at a different layer of the stack. Start anywhere.
        </p>

        {/* SECTION ROUTING LABEL (thematic flavor, secondary) */}
        <div className="text-xs text-gray-700 tracking-widest uppercase mb-12 flex justify-between items-center">
          <span>[ LINKING_MATRIX // LIVE_ROUTING ]</span>
          <span>SYSTEMIC_DEFAULTS: ENFORCED</span>
        </div>

        {/* THE ANCHOR PIPE MATRIX */}
        <div className="grid grid-cols-1 gap-4">
          {protocols.map((protocol) => (
            <Link 
              key={protocol.id} 
              href={protocol.href}
              className={`group block p-6 border transition-all duration-200 ${
                protocol.isApex 
                  ? "border-indigo-950 bg-indigo-950/10 hover:border-indigo-500" 
                  : "border-gray-900 bg-black/40 hover:border-gray-600"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${protocol.isApex ? "text-indigo-400" : "text-gray-500"}`}>
                      NODE_{protocol.id}
                    </span>
                    <span className="text-[10px] bg-gray-900 px-1.5 py-0.5 text-gray-400 border border-gray-800 tracking-tighter">
                      {protocol.status}
                    </span>
                  </div>
                  <h3 className="font-sans text-xl font-bold text-gray-100 group-hover:text-white transition-colors">
                    {protocol.title}
                  </h3>
                  <p className="text-xs text-gray-400 font-serif italic">
                    {protocol.subtitle}
                  </p>
                </div>
                
                <div className="text-xs text-gray-500 group-hover:text-white font-mono transition-colors self-end sm:self-center">
                  [ DEPLOY_LINK ↗ ]
                </div>
              </div>
            </Link>
          ))}
        </div>
        
      </div>
    </section>
  );
}

const SITE_URL = 'https://www.mahastrategies.com';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Maha Strategies LLC | A Think Tank for Systemic Sovereignty',
  description:
    'Maha Strategies is an independent think tank researching sovereignty across the modern stack \u2014 from semiconductors and on-device AI to human biology. We call it Systemic Sovereignty.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Maha Strategies',
    title: 'Maha Strategies LLC | A Think Tank for Systemic Sovereignty',
    description:
      'An independent think tank researching sovereignty across the modern stack: silicon, software, and human biology.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Strategies LLC' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Maha Strategies LLC | A Think Tank for Systemic Sovereignty',
    description:
      'An independent think tank researching sovereignty across the modern stack: silicon, software, and human biology.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
};

// Structured data — encodes only what is verifiable from stated background.
// Organization (the firm) + Person (founder/MD) + the advisory expertise.
const orgJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Maha Strategies LLC',
      url: SITE_URL,
      description:
        'An independent think tank and applied research institute focused on systemic sovereignty: semiconductor supply-chain strategy, the China+1 manufacturing shift, on-device AI, and human resilience.',
      knowsAbout: [
        'Semiconductor supply chain strategy',
        'China+1 manufacturing shift',
        'OSAT and packaging feasibility',
        'South Asian manufacturing logistics',
        'On-device AI and NPU adoption',
        'Edge-compute hardware strategy',
      ],
      founder: { '@id': `${SITE_URL}/#founder` },
    },
    {
      '@type': 'Person',
      '@id': `${SITE_URL}/#founder`,
      name: 'Mayone Maha Rajan',
      jobTitle: 'Managing Director',
      worksFor: { '@id': `${SITE_URL}/#organization` },
      description:
        'Managing Director of Maha Strategies LLC, an independent think tank on systemic sovereignty. Researches and advises on the China+1 semiconductor supply-chain shift, South Asian manufacturing logistics, and the transition to on-device AI. Author of The Maha Principle.',
      knowsAbout: [
        'China+1 feasibility analysis',
        'Semiconductor logistics',
        'OSAT and packaging capacity',
        'On-device AI / NPU architectures',
        'Supply-chain risk mitigation',
      ],
      author: { '@id': `${SITE_URL}/#book` },
      url: 'https://www.mayonemaharajan.com',
      sameAs: [
        'https://www.mayonemaharajan.com',
        'https://www.linkedin.com/in/mayonrajan',
        'https://x.com/mayonemaha',
      ],
    },
    {
      '@type': 'Book',
      '@id': `${SITE_URL}/#book`,
      name: 'The Maha Principle: Architecting Personal and National Renewal',
      inLanguage: 'en',
      author: { '@id': `${SITE_URL}/#founder` },
      url: 'https://www.themahaprinciple.com',
      sameAs: ['https://www.amazon.com/dp/B0H62WLMT5'],
      workExample: {
        '@type': 'Book',
        '@id': 'https://www.amazon.com/dp/B0H62WLMT5',
        bookFormat: 'https://schema.org/EBook',
        // TODO: confirm price/currency at launch; update if it changes.
        offers: {
          '@type': 'Offer',
          price: '2.99',
          priceCurrency: 'USD',
          availability: 'https://schema.org/PreOrder',
          url: 'https://www.amazon.com/dp/B0H62WLMT5',
        },
      },
    },
  ],
};

export default function CorporateHomepage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans p-8 md:p-24 md:pb-0 selection:bg-indigo-500 selection:text-white flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      <div className="max-w-4xl mx-auto w-full flex-grow">
        
        {/* HEADER FLEX CONTAINER FOR TITLE & CONTACT LINK */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-4 mb-6">
          <h1 className="text-4xl md:text-5xl font-light tracking-widest uppercase text-white">
            Maha Strategies LLC
          </h1>
          <Link 
            href="/contact" 
            className="font-mono text-xs text-zinc-500 hover:text-indigo-400 tracking-widest uppercase transition-colors"
          >
            [ Establish Contact ↗ ]
          </Link>
        </div>

        {/* CLEAR ENTRY LAYER: what this is, in plain language, first */}
        <p className="font-mono text-xs text-indigo-500 font-semibold tracking-widest uppercase mb-6">
          [ An Independent Think Tank ]
        </p>

        {/* THE MANIFESTO APEX LINK */}
        <div className="mb-12 not-prose">
          <Link href="/manifesto" className="text-indigo-400 font-mono text-xs uppercase tracking-widest hover:text-white transition-colors">
            [ Read the Core Doctrine: The Maha Principle Manifesto ↗ ]
          </Link>
        </div>
        
        <div className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed">
          <p className="text-2xl text-white font-light mb-8 leading-snug">
            We research how individuals, companies, and nations stay independent &mdash; across the whole modern stack, from the silicon in our devices to the software that shapes our attention to our own biology.
          </p>
          <p className="text-xl text-zinc-400 mb-12">
            In an era defined by cascading dependencies and centralized choke points, the ultimate strategic commodity is autonomy. Maha Strategies LLC exists to secure this autonomy at every layer of the modern stack—from physical silicon to individual consciousness. We call this Systemic Sovereignty.
          </p>
          
          <p className="font-mono text-xs text-indigo-500 font-semibold tracking-widest uppercase mt-4">
            [ Applied Research Institute & Cybernetic Think Tank ]
          </p>

          {/* THE BOOK LEADS: core doctrine, front and center */}
          <BookPreorderSection />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="border-t border-zinc-800 pt-6 group">
              <h3 className="text-white text-sm tracking-widest uppercase mb-4 group-hover:text-indigo-400 transition-colors">I. Infrastructure</h3>
              <p className="text-sm text-zinc-500 mb-4">
                Hardware is the foundation of sovereignty. Our research here covers the hardest practical question in technology supply chains right now: how to move semiconductor manufacturing out of single points of dependency. That means the &ldquo;China+1&rdquo; shift, the feasibility of chip assembly and packaging (OSAT) in new regions, and the real logistics, labor, and energy infrastructure that relocation into South Asia actually requires.
              </p>
              <Link href="/intelligence" className="text-xs font-mono text-zinc-600 hover:text-indigo-400 uppercase tracking-widest transition-colors block">
                Access Market Intelligence ↗
              </Link>
            </div>
            
            <div className="border-t border-zinc-800 pt-6 group">
              <h3 className="text-white text-sm tracking-widest uppercase mb-4 group-hover:text-indigo-400 transition-colors">II. Interface</h3>
              <p className="text-sm text-zinc-500 mb-4">
                We study how software can serve its user instead of harvesting them &mdash; and Maha OS is where that research becomes a working product. It runs AI directly on your device rather than in the cloud, so your data never leaves your hardware: what we call a <em>zero-payload local fortress</em>. The same idea drives our wider research into the shift from cloud-dependent AI to on-device processing.
              </p>
              <Link href="/software" className="text-xs font-mono text-zinc-600 hover:text-indigo-400 uppercase tracking-widest transition-colors block">
                Review Software Systems ↗
              </Link>
            </div>
            
            <div className="border-t border-zinc-800 pt-6 group">
              <h3 className="text-white text-sm tracking-widest uppercase mb-4 group-hover:text-indigo-400 transition-colors">III. Intellect</h3>
              <p className="text-sm text-zinc-500 mb-4">
                Grounded in cognitive science, this is our published research and writing. We develop frameworks and doctrines for thinking clearly and staying autonomous under pressure &mdash; how to resist <em>narrative capture</em> (having your attention and beliefs shaped by systems built to do exactly that) and how to keep mind and body resilient.
              </p>
              <Link href="/doctrine" className="text-xs font-mono text-zinc-600 hover:text-indigo-400 uppercase tracking-widest transition-colors block">
                Read Tactical Briefs ↗
              </Link>
            </div>
          </div>

          {/* HIGHLIGHTED RESEARCH BRIEFS */}
          <div className="mb-16 grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-zinc-900 pt-12">
            {/* Intelligence Column */}
            <div>
              <h3 className="text-white font-mono text-xs tracking-widest uppercase mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 inline-block"></span>
                Active Market Intelligence
              </h3>
              <ul className="space-y-3 not-prose">
                {intelligenceBriefs.map(brief => (
                  <li key={brief.id}>
                    <Link href={brief.href} className="group flex flex-col p-3 border border-zinc-800/50 hover:border-zinc-500 hover:bg-zinc-900/30 transition-all">
                      <span className="text-[10px] font-mono text-zinc-500 mb-1">{brief.id}</span>
                      <span className="text-sm text-zinc-300 group-hover:text-white font-medium">{brief.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/intelligence" className="inline-block mt-4 text-xs font-mono text-indigo-400 hover:text-white uppercase tracking-widest transition-colors">
                [ View All Intelligence Log ↗ ]
              </Link>
            </div>

            {/* Doctrine Column */}
            <div>
              <h3 className="text-white font-mono text-xs tracking-widest uppercase mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-zinc-500 inline-block"></span>
                Tactical Doctrine
              </h3>
              <ul className="space-y-3 not-prose">
                {doctrineBriefs.map(brief => (
                  <li key={brief.id}>
                    <Link href={brief.href} className="group flex flex-col p-3 border border-zinc-800/50 hover:border-zinc-500 hover:bg-zinc-900/30 transition-all">
                      <span className="text-[10px] font-mono text-zinc-500 mb-1">{brief.id}</span>
                      <span className="text-sm text-zinc-300 group-hover:text-white font-medium">{brief.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/doctrine" className="inline-block mt-4 text-xs font-mono text-indigo-400 hover:text-white uppercase tracking-widest transition-colors">
                [ View All Tactical Briefs ↗ ]
              </Link>
            </div>
          </div>

          <h2 className="text-2xl text-white font-light mb-4">The Sovereign Synthesis</h2>
          <p>
            We do not view hardware, software, and the human nervous system as disparate domains. They are contiguous layers of a single, unified reality. A vulnerability in custom silicon compromises the operating system; a vulnerability in the OS extracts your telemetry; a compromised physical baseline cannot defend its infrastructure. True independence requires securing the entire stack.
          </p>
          <p className="mt-8 mb-16 font-mono text-indigo-400 tracking-widest uppercase text-xs">
            We are Maha Strategies LLC. The architecture of independence begins here.
          </p>

          {/* THE TOP-OF-FUNNEL GATEWAY INJECTION */}
          <div className="mb-24 border border-indigo-900/50 bg-indigo-950/20 p-8 sm:p-12 relative overflow-hidden not-prose">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
            <h2 className="text-white font-mono text-sm tracking-widest uppercase mb-4 mt-0">
              [ PROTOCOL 001 // INITIALIZATION ]
            </h2>
            <p className="text-zinc-300 text-lg mb-8 font-light">
              The modern industrial environment is not designed to support your life; it is designed to harvest your attention and your biology for profit. Secure your perimeter. 
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/start"
                className="inline-block bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-8 py-4 hover:bg-zinc-200 transition-colors no-underline text-center"
              >
                Enter The Stronghold (Start Here) ↗
              </Link>
              <Link
                href="/consulting"
                className="inline-block border border-zinc-600 text-zinc-200 font-mono font-bold text-xs tracking-widest uppercase px-8 py-4 hover:border-white hover:text-white transition-colors no-underline text-center"
              >
                Engage Consulting ↗
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* THE INTEGRATION: This is where the grid renders */}
      <ProtocolAnchorGrid />
      
      {/* GLOBAL FOOTER */}
      <footer className="w-full py-12 border-t border-gray-950 flex flex-col items-center justify-center gap-4 bg-[#0a0a0c]">
        <Link 
          href="/contact" 
          className="font-mono text-xs text-zinc-600 hover:text-indigo-400 tracking-widest uppercase transition-colors"
        >
          [ SECURE CHANNEL // CONTACT ]
        </Link>
        <p className="font-mono text-[10px] text-zinc-800 tracking-widest uppercase">
          &copy; {new Date().getFullYear()} Maha Strategies LLC. All Rights Reserved.
        </p>
      </footer>
    </div>
  )
}