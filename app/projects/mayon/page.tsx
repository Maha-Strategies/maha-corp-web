import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Mayon Virtual Field Trip | Maha Strategies',
  description: 'Methods, sources, and educational limits for the free Mayon Volcano interactive and Virtual Field Trip guide.',
  alternates: { canonical: '/projects/mayon' },
  openGraph: {
    title: 'Mayon Virtual Field Trip | Maha Strategies',
    description: 'A free, source-linked educational demonstration of Mayon Volcano at true scale.',
    type: 'website',
  },
}

const sources = [
  {
    title: 'PHIVOLCS Volcano Hazard Maps - Mayon',
    href: 'https://volcanohazardmaps.org/map/?id=1047',
    text: 'Official hazard-map index and risk-communication context. Consult PHIVOLCS and local authorities for current information and instructions.',
  },
  {
    title: 'Smithsonian Global Volcanism Program - Mayon',
    href: 'https://volcano.si.edu/volcano.cfm?vn=273030',
    text: 'Reference record for Mayon and its eruption history.',
  },
  {
    title: 'Bulletin of Volcanology (2021) - petrological constraints at Mayon',
    href: 'https://doi.org/10.1007/s00445-021-01486-9',
    text: 'One of the sources used to frame the interactive’s inferred, explicitly conceptual interior explanation.',
  },
  {
    title: 'USGS Cascade Volcano Observatory teaching resources',
    href: 'https://www.usgs.gov/observatories/cvo/teaching-resources',
    text: 'General teaching approaches for volcanic processes and hazards.',
  },
]

export default function MayonProjectPage() {
  return (
    <main className="evidence-page">
      <article className="evidence-container evidence-container--narrow">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Free educational demonstration ]</p>
        <h1 className="mt-5 text-4xl font-light leading-tight tracking-tight text-[var(--text-primary)] sm:text-6xl">Mayon Virtual Field Trip</h1>
        <p className="mt-7 max-w-3xl text-xl leading-relaxed text-[var(--text-secondary)]">A true-scale interactive view of Mayon Volcano, designed to make volcanic processes, historical memory, uncertainty, and public-safety boundaries easier to discuss.</p>
        <p className="mt-5 text-sm text-[var(--text-secondary)]">Looking for classroom use, privacy, accessibility, and app-status information? <Link href="/apps/mayon" className="text-[var(--status-sourced)] underline">Read the Mayon app documentation</Link>.</p>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">For the operator&apos;s public account of what is live and what the project does not claim, see the <Link href="/case-studies#mayon" className="text-[var(--status-sourced)] underline">Mayon case study</Link>.</p>

        <section className="mt-14 border border-amber-900/50 bg-amber-950/10 p-7">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-boundary)]">[ Important limit ]</p>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">This is an educational visualization, not a live warning, monitoring, forecast, evacuation, or decision-support system. Hazard graphics are illustrative scenarios. For current activity and instructions, follow PHIVOLCS and local authorities.</p>
        </section>

        <section className="mt-14 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl text-[var(--text-primary)]">What learners can do</h2>
            <ul className="mt-5 space-y-3 leading-relaxed text-[var(--text-secondary)]">
              <li>Read Mayon&apos;s cone at a one-unit-equals-one-metre scale.</li>
              <li>Follow a four-stop Story: cone formation, 1814 Cagsawa, 2018 south-flank activity, and Daraga.</li>
              <li>Compare illustrative lava, pyroclastic-density-current, lahar, and ash scenarios without confusing them for a forecast.</li>
              <li>Ask what is observed, inferred, reconstructed, or unknown in a public volcano model.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-2xl text-[var(--text-primary)]">Downloadable guide</h2>
            <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">The free four-page Field Trip guide is structured for a 20-minute class, museum activity, or individual exploration. It includes prompts, an exit ticket, teacher framing, sources, and safety limits.</p>
            <a href="https://mayonrajan.com/assets/mayon-virtual-field-trip.pdf" className="mt-6 inline-block border border-cyan-800 bg-[var(--surface-sourced)] px-5 py-3 text-sm text-[var(--status-sourced)] transition hover:bg-cyan-900/40">Download the Mayon Virtual Field Trip PDF</a>
            <a href="https://mayonrajan.com" className="mt-3 block text-sm text-[var(--status-sourced)] underline">Open the interactive</a>
          </div>
        </section>

        <section className="mt-16 border-t border-[var(--border-default)] pt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Methods ]</p>
          <h2 className="mt-4 text-2xl text-[var(--text-primary)]">How the experience represents evidence</h2>
          <div className="mt-6 space-y-5 leading-relaxed text-[var(--text-secondary)]">
            <p><b className="font-medium text-[var(--text-primary)]">Surface:</b> the terrain presentation uses digital elevation data and locally baked satellite imagery. These are visualized at true scale but are still a web rendering, not a survey product.</p>
            <p><b className="font-medium text-[var(--text-primary)]">History:</b> the historical chapters compress a complex eruption record into short, legible scenes. They aim to invite questions and direct learners to sources, rather than recreate every event detail.</p>
            <p><b className="font-medium text-[var(--text-primary)]">Interior:</b> chamber, dike, and hydrothermal forms are inferred conceptual diagrams. They are not direct images of Mayon&apos;s subsurface and are labelled accordingly in the experience.</p>
            <p><b className="font-medium text-[var(--text-primary)]">Hazards:</b> routes and corridors are teaching overlays. Their shape is guided by terrain and documented hazard context but must never be interpreted as a real-time, location-specific assessment.</p>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl text-[var(--text-primary)]">Sources and review</h2>
          <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">This page is reviewed monthly for material source or methods changes. Reviews can update documentation and source metadata, but they do not automatically publish a live alert or alter the interactive&apos;s hazard behavior.</p>
          <ol className="mt-7 space-y-5">
            {sources.map((source) => (
              <li key={source.href} className="border-l border-[var(--border-strong)] pl-5">
                <a href={source.href} target="_blank" rel="noreferrer" className="text-[var(--status-sourced)] underline">{source.title}</a>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{source.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-10 text-sm text-[var(--text-muted)]">Last methods review: 24 July 2026. For a source-tagged brief or collaboration, <Link href="/contact" className="text-[var(--status-sourced)] underline">contact Maha Strategies</Link>.</p>
        </section>
      </article>
    </main>
  )
}
