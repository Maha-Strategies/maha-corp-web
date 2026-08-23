import Link from 'next/link';

export const metadata = {
  title: 'System Doctrines & Protocols | Maha Strategies LLC',
  description: 'Advisory frameworks for sovereign digital infrastructure solutions, custom silicon design, and secure computing infrastructure consulting.',
  keywords: 'sovereign digital infrastructure solutions, secure computing infrastructure consulting, data sovereignty consulting, custom silicon design firms, ai hardware consulting',
};

const protocolIndex = [
  {
    slug: '/protocols/architecting-renewal',
    label: 'APEX NODE // DEPLOYED',
    title: 'The Sovereign Ecosystem: Architecting Renewal',
    summary:
      'Navigating digital sovereignty frameworks to implement resilient, locally governed cloud environments and decentralized infrastructure.',
    focus: 'data jurisdiction · sovereignty model · vendor independence',
  },
  {
    slug: '/protocols/metabolic-sovereignty',
    label: 'NODE v2.0 // DEPLOYED',
    title: 'The Algorithmic Trance & Metabolic Sovereignty',
    summary:
      'Architecting power-autonomous edge nodes for high-density AI hardware computing in decentralized environments.',
    focus: 'attention surfaces · systems integrity · protocol governance',
  },
  {
    slug: '/protocols/digital-firewall',
    label: 'NODE v2.0 // DEPLOYED',
    title: 'The Saturnian Perimeter & The Digital Firewall',
    summary:
      'Consulting protocols for secure digital perimeter design with hardware-backed isolation and operational control.',
    focus: 'secure compute boundaries · regulated environments · trust surfaces',
  },
  {
    slug: '/protocols/kinetic-friction',
    label: 'NODE v2.0 // DEPLOYED',
    title: 'The Iron Engine & The Necessity of Friction',
    summary:
      'Evaluating architectures across software stack layers where friction is a guardrail against brittle system behavior.',
    focus: 'control planes · API governance · resilience economics',
  },
  {
    slug: '/protocols/hardware-sovereignty',
    label: 'NODE v2.0 // DEPLOYED',
    title: 'Hardware Sovereignty & Edge-Compute Intelligence',
    summary:
      'A strategic advisory framework for custom silicon design firms and enterprise data sovereignty consulting.',
    focus: 'chip-level boundaries · sovereign operation · infrastructure continuity',
  },
]

export default function ProtocolsIndex() {
  return (
    <main className="evidence-page">
      <div className="evidence-container">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3">
            <span>Maha Strategies</span>
            <span>Operational Frameworks · Protocol Directory</span>
          </p>
          <h1 className="evidence-title evidence-title--product mt-4">System Doctrines</h1>
          <p className="evidence-lede mt-7">
            Public protocols that define how evidence, control, and infrastructure assumptions are organized across our platform.
          </p>
        </header>

        <section className="evidence-section" aria-labelledby="protocol-index-heading">
          <div className="evidence-inset">
            <p className="evidence-kicker">Protocol family</p>
            <h2 id="protocol-index-heading" className="evidence-section-title mt-4">System doctrines for governed systems</h2>
            <p className="evidence-copy mt-4">
              Each entry is a published, bounded protocol: claims are explicit, boundaries are stated, and the practical implication is to reduce ambiguity before action.
            </p>
          </div>

          <div className="mt-9 grid gap-4">
            {protocolIndex.map((protocol) => (
              <Link key={protocol.slug} href={protocol.slug} className="evidence-card group">
                <p className="evidence-kicker text-[var(--text-muted)]">{protocol.label}</p>
                <h3 className="evidence-card-title mt-4">{protocol.title}</h3>
                <p className="evidence-card-copy mt-4 max-w-3xl">{protocol.summary}</p>
                <p className="mt-4 font-mono text-[0.75rem] uppercase tracking-[0.16em] text-[var(--text-secondary)]">focus: {protocol.focus}</p>
                <span className="evidence-kicker mt-5 inline-block text-[var(--text-primary)]">Read protocol ↗</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">Reference</p>
          <h2 className="evidence-section-title mt-4">Related working context</h2>
          <p className="evidence-copy mt-4">
            Protocols are also discussed in other work where policy, research, and implementation detail are separated.
            Follow the whitepaper path when you need the exact method notes and historical context.
          </p>
          <Link href="/research/architecture-of-attention" className="evidence-link mt-6 inline-block">
            Open related architecture reference ↗
          </Link>
        </section>
      </div>
    </main>
  );
}
