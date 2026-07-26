import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Maha OS | Local-First Focus and Awareness App',
  description:
    'Maha OS is a local-first mobile app built on edge-compute architecture — keeping your data on your device and reducing reliance on cloud surveillance. Available on iOS and Android.',
  alternates: { canonical: 'https://www.mahastrategies.com/software' },
  openGraph: {
    title: 'Maha OS | Local-First Focus and Awareness App',
    description: 'A local-first mobile app designed for a more private, more intentional relationship with your device.',
    url: 'https://www.mahastrategies.com/software',
    type: 'website',
  },
}

export default function SoftwarePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans p-8 md:p-24 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-xs text-zinc-500 uppercase tracking-widest hover:text-white mb-8 block"
        >
          ← Back to Root Node
        </Link>
        <Link href="/apps" className="mb-6 block text-xs text-indigo-300 uppercase tracking-widest hover:text-white">
          Explore all apps →
        </Link>

        <h1 className="text-4xl text-white font-light tracking-wide mb-6 leading-tight">
          Maha OS: A Local-First Ecosystem
        </h1>

        <div className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed">
          <p className="text-xl text-zinc-400 mb-12">
            Software is the primary medium of human-machine interaction — yet
            mainstream platforms are increasingly built around data collection,
            behavioral tracking, and attention capture. Maha OS is built on a
            different premise: your device should work for you, and your data
            should stay with you.
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">
            The Problem
          </h2>
          <p>
            Much of the modern digital economy runs on attention. Many platforms
            optimize aggressively for engagement, using algorithmic feedback loops
            and behavioral tracking to maximize time-on-app — often at the
            expense of the user&apos;s focus and intent. For people who care about
            data privacy and reclaiming their attention, the default tools
            increasingly work against those goals.
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">
            Edge-Compute Architecture
          </h2>
          <p>
            Maha OS takes a local-first approach. The system is designed to
            operate on your device, processing data locally rather than routing it
            through external servers. By minimizing dependence on cloud APIs, the
            app reduces the surface area for third-party tracking and keeps your
            information under your control by default.
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">
            On-Device Storage
          </h2>
          <p>
            Maha OS uses fast local storage engines such as MMKV and SQLite, with
            data kept on the device and encrypted at rest. The design goal is
            simple: treat compute and storage as private utilities, so your data
            and decisions remain yours rather than becoming inputs to someone
            else&apos;s system.
          </p>

          {/* RESEARCH COUPLING FRAMEWORK */}
          <div className="mt-8 border border-zinc-900 bg-black/40 p-6 font-mono text-xs text-zinc-400">
            <span className="text-white block font-bold mb-1 uppercase tracking-wider">
              BACKGROUND READING //
            </span>
            For a deeper analysis of how attention-optimized systems shape user
            behavior — and the case for local-first, user-controlled design —
            see our companion article.
            <Link
              href="/research/architecture-of-attention"
              className="block text-indigo-400 hover:text-indigo-300 mt-3 uppercase tracking-widest no-underline"
            >
              [ READ: THE ARCHITECTURE OF ATTENTION &rarr; ]
            </Link>
            <Link
              href="/on-device-ai-vs-cloud"
              className="block text-indigo-400 hover:text-indigo-300 mt-3 uppercase tracking-widest no-underline"
            >
              [ DECISION GUIDE: ON-DEVICE AI VS CLOUD &rarr; ]
            </Link>
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-800">
            <p className="text-white font-semibold mb-4 tracking-widest uppercase text-xs">
              Get Maha OS
            </p>
            <p className="text-sm text-zinc-500 mb-6">
              A local-first foundation for a more private, more intentional
              relationship with your device. Available for both iOS and Android platforms.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="https://apps.apple.com/us/app/maha-os/id6778333838"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-center bg-white text-black px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
              >
                Download on the App Store
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.maha.os"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-center border border-zinc-700 hover:border-zinc-500 hover:text-white px-8 py-3 text-xs font-bold uppercase tracking-widest transition-colors"
              >
                Get it on Google Play
              </a>
            </div>
          </div>

          <section className="mt-16 border-t border-zinc-800 pt-10">
            <p className="text-white font-semibold mb-4 tracking-widest uppercase text-xs">More from Maha Strategies</p>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-500">Different questions call for different instruments. Explore the other public apps from Maha Strategies.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 not-prose">
              <article className="border border-amber-900/60 bg-amber-950/10 p-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-amber-200">The Imagined Life companion</p>
                <h2 className="mt-3 text-xl font-light text-white">The Dream Engine</h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">Read, practice, and keep a private archive for attention, reflection, and ordinary action.</p>
                <div className="mt-5 flex flex-wrap gap-4 text-sm">
                  <Link href="/apps/the-engine" className="text-amber-100 underline">Explore the app</Link>
                  <a href="https://play.google.com/store/apps/details?id=com.theimaginedlife.engine" target="_blank" rel="noopener noreferrer" className="text-amber-100 underline">Google Play ↗</a>
                </div>
              </article>
              <article className="border border-cyan-900/60 bg-cyan-950/10 p-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-200">Educational volcano explorer</p>
                <h2 className="mt-3 text-xl font-light text-white">Mayon</h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">A free, true-scale interactive field trip through Mayon Volcano, its history, landscape, and volcanology.</p>
                <div className="mt-5 flex flex-wrap gap-4 text-sm">
                  <Link href="/apps/mayon" className="text-cyan-100 underline">Explore the app</Link>
                  <a href="https://mayonrajan.com" target="_blank" rel="noopener noreferrer" className="text-cyan-100 underline">Open Mayon ↗</a>
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
