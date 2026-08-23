import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Strategic Doctrine | Maha Strategies',
  description: 'Foundational frameworks and strategic research equipping elite actors to resist narrative capture and defend their cognitive baseline.',
  alternates: { canonical: 'https://www.mahastrategies.com/doctrine' },
}

const doctrineBriefs = [
  { href: '/doctrine/briefs/soil-gut-brain-axis', label: 'The Soil-Gut-Brain Axis', kicker: '[ BRIEF 01 ]' },
  { href: '/doctrine/briefs/overclocked', label: 'Overclocked: The Physics of Anxiety', kicker: '[ BRIEF 02 ]' },
  { href: '/doctrine/briefs/physics-of-spirit', label: 'The Physics of Spirit', kicker: '[ BRIEF 03 ]' },
  { href: '/doctrine/briefs/protocol-of-precision', label: 'Protocol of Precision', kicker: '[ BRIEF 04 ]' },
  { href: '/doctrine/briefs/strategic-gravity', label: 'Strategic Gravity', kicker: '[ BRIEF 05 ]' },
  { href: '/doctrine/briefs/harmonic-command', label: 'The Harmonic Command', kicker: '[ BRIEF 06 ]' },
  { href: '/doctrine/briefs/asymmetric-soundscape', label: 'The Asymmetric Soundscape', kicker: '[ BRIEF 07 ]' },
  { href: '/doctrine/briefs/visionarys-standard', label: "The Visionary&apos;s Standard", kicker: '[ BRIEF 08 ]' },
  { href: '/doctrine/briefs/the-ordeal', label: 'The Ordeal: Earned Identity', kicker: '[ BRIEF 09 ]' },
  { href: '/doctrine/briefs/consumer-to-producer', label: 'Consumer to Producer', kicker: '[ BRIEF 10 ]' },
  { href: '/doctrine/briefs/saturnian-vision', label: 'The Saturnian Vision', kicker: '[ BRIEF 11 ]' },
]

export default function DoctrinePage() {
  return (
    <main className="evidence-page">
      <div className="evidence-container">
        <section className="evidence-section">
          <p className="evidence-kicker">[ Published doctrine ]</p>
          <h1 className="evidence-title">Intellectual Property &amp; Foundational Doctrine</h1>
          <div className="evidence-copy mt-7 space-y-5">
            <p>
              Technology is useless if the mind operating it is compromised. As platforms weaponize algorithmic feedback loops,
              human cognitive agency is under unprecedented assault.
            </p>
            <p>
              Through our intellectual property division, Maha Strategies publishes foundational frameworks, sovereign blueprints, and
              strategic research designed to equip practitioners to resist narrative capture.
            </p>
          </div>
        </section>

        <section className="evidence-section">
          <h2 className="evidence-section-title">The Maha Principle</h2>
          <div className="evidence-copy mt-5 space-y-5">
            <p>
              Our primary doctrine, <em>The Maha Principle: The Architecture of Human Flourishing</em>, is an 81,015-word strategic
              framework designed to reclaim the human biological and cognitive baseline from extractive industrial and technological systems.
            </p>
            <p>
              It establishes the theoretical architecture for Metabolic Sovereignty, Attentional Captivity, and the Nurturing Warrior
              archetype—the direct philosophy powering Maha OS.
            </p>
          </div>

          <a
            href="https://www.mayonemaharajan.com/concepts/the-maha-principle"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 block evidence-card"
          >
            <p className="evidence-kicker">[ EXTERNAL PORTAL // DISCOVER MORE ]</p>
            <h3 className="evidence-card-title mt-3">Explore The Maha Principle</h3>
            <p className="evidence-copy mt-3">Visit the official domain for comprehensive insights on the foundational framework.</p>
            <p className="evidence-kicker mt-4">ACCESS PORTAL ↗</p>
          </a>
        </section>

        <section className="evidence-section">
          <h2 className="evidence-section-title">The Maha Provenance Standard</h2>
          <div className="evidence-copy mt-5 space-y-5">
            <p>
              A doctrine is only as strong as its epistemics. The Maha Provenance Standard (MPS/0.1) is our published, claim-level
              tagging standard for AI-assisted nonfiction: every substantive claim carries its epistemic status — VERIFIED, SOURCED,
              BOUNDARY, ILLUSTRATIVE, or UNVERIFIED — making the doctrine auditable, by humans and machines alike.
            </p>
            <p>
              The standard is applied across our books and research, archived under a permanent identifier (DOI:{' '}
              <a href="https://doi.org/10.5281/zenodo.21241308" target="_blank" rel="noopener noreferrer" className="evidence-link">
                10.5281/zenodo.21241308
              </a>
              ), and implemented as a live instrument any author or publisher can use.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Link href="/mps" className="evidence-card">
              <p className="evidence-kicker">[ SPECIFICATION // MPS/0.1 ]</p>
              <h3 className="evidence-card-title mt-3">Read the Standard</h3>
              <p className="evidence-copy mt-3">
                The five tags, discipline rules, and machine-readable audit-record schema.
              </p>
              <p className="evidence-kicker mt-4">OPEN SPECIFICATION ↗</p>
            </Link>

            <Link href="/audit" className="evidence-card">
              <p className="evidence-kicker">[ INSTRUMENT // LIVE ]</p>
              <h3 className="evidence-card-title mt-3">Run the Auditor</h3>
              <p className="evidence-copy mt-3">Paste a passage; receive claim-level tags and an exportable MPS audit record. Free, no signup.</p>
              <p className="evidence-kicker mt-4">INITIALIZE AUDIT ↗</p>
            </Link>
          </div>
        </section>

        <section className="evidence-section">
          <h2 className="evidence-section-title">Strategic Archives</h2>
          <Link href="/doctrine/replacing-willpower" className="evidence-card mt-6 block">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="evidence-kicker">[ INTELLECTUAL PROPERTY // ARCHIVED ]</p>
                <h3 className="evidence-card-title mt-3">Replacing Willpower with Architecture</h3>
                <p className="evidence-copy mt-2">Quantizing Generative AI for Edge-Compute Interventions</p>
              </div>
              <p className="evidence-kicker">[ READ DOCUMENT ↗ ]</p>
            </div>
          </Link>
        </section>

        <section className="evidence-section">
          <h2 className="evidence-section-title">Tactical Briefs</h2>
          <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctrineBriefs.map((brief) => (
              <Link key={brief.href} href={brief.href} className="evidence-card">
                <p className="evidence-kicker">{brief.kicker}</p>
                <h3 className="evidence-card-title mt-3">{brief.label}</h3>
              </Link>
            ))}
          </div>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">Agentic Publishing Node</p>
          <p className="evidence-copy mt-4">
            Access our AI-powered publishing tools, automated query letter generators, and the raw manuscript vault.
          </p>
          <a
            href="https://publish.mahastrategies.com"
            className="inline-block mt-6 evidence-action evidence-action--secondary"
          >
            Initialize Publishing Terminal
          </a>
        </section>
      </div>
    </main>
  )
}
