import type { Metadata } from 'next'
import Link from 'next/link'

const pageUrl = 'https://www.mahastrategies.com/apps'

export const metadata: Metadata = {
  title: 'Apps | Maha Strategies',
  description: 'Public documentation, support, and privacy information for educational applications from Maha Strategies.',
  alternates: { canonical: pageUrl },
  openGraph: {
    title: 'Apps | Maha Strategies',
    description: 'Public documentation and support for educational applications from Maha Strategies.',
    url: pageUrl,
    type: 'website',
  },
}

export default function AppsPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28">
      <section className="mx-auto max-w-4xl">
        <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Public application documentation ]</p>
        <h1 className="mt-5 text-4xl font-light tracking-tight text-white sm:text-6xl">Apps from Maha Strategies</h1>
        <p className="mt-7 max-w-3xl text-xl leading-relaxed text-zinc-300">Explore the products, documentation, privacy information, and support boundaries behind Maha Strategies&apos; public applications.</p>

        <div className="mt-14 grid gap-6">
          <article className="border border-cyan-900/50 bg-cyan-950/10 p-7 sm:p-9">
            <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Educational volcano explorer ]</p>
            <h2 className="mt-4 text-3xl font-light text-white">Mayon</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-zinc-400">A free, true-scale exploration of Mayon Volcano for learners, educators, and curious visitors. It combines terrain, historical chapters, explanatory interior diagrams, and clearly bounded hazard scenarios.</p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <Link href="/apps/mayon" className="border border-cyan-700 px-4 py-2 text-cyan-100 transition hover:bg-cyan-900/40">Read the Mayon documentation</Link>
              <a href="https://mayonrajan.com" className="px-4 py-2 text-cyan-100 underline" target="_blank" rel="noreferrer">Open the interactive</a>
            </div>
          </article>
          <article className="border border-indigo-900/50 bg-indigo-950/10 p-7 sm:p-9">
            <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Local-first mobile app · iOS and Android ]</p>
            <h2 className="mt-4 text-3xl font-light text-white">Maha OS</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-zinc-400">A local-first companion for focus and metabolic awareness. It is designed to minimize non-essential off-device telemetry and give your device a more intentional default.</p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <Link href="/apps/maha-os" className="border border-indigo-700 px-4 py-2 text-indigo-100 transition hover:bg-indigo-900/40">Explore Maha OS</Link>
              <a href="https://apps.apple.com/us/app/maha-os/id6778333838" className="px-4 py-2 text-indigo-100 underline" target="_blank" rel="noreferrer">Download for iOS</a>
              <a href="https://play.google.com/store/apps/details?id=com.maha.os" className="px-4 py-2 text-indigo-100 underline" target="_blank" rel="noreferrer">Get it for Android</a>
            </div>
          </article>
          <article className="border border-amber-900/50 bg-amber-950/10 p-7 sm:p-9">
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-200">[ The Imagined Life · companion app ]</p>
            <h2 className="mt-4 text-3xl font-light text-white">The Dream Engine</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-zinc-400">Read <em>The Imagined Life</em>, then use a quiet, private practice for attention, reflection, and ordinary action. Store release is in preparation.</p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <Link href="/apps/the-engine" className="border border-amber-700 px-4 py-2 text-amber-100 transition hover:bg-amber-900/40">Explore The Dream Engine</Link>
              <a href="mailto:mayone@mahastrategies.com?subject=The%20Dream%20Engine%20release%20updates" className="px-4 py-2 text-amber-100 underline">Get release updates</a>
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}
