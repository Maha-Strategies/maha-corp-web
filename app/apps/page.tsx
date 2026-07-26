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
        <p className="mt-7 max-w-3xl text-xl leading-relaxed text-zinc-300">Documentation, privacy information, and support boundaries for our public educational applications.</p>

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
        </div>
      </section>
    </main>
  )
}
