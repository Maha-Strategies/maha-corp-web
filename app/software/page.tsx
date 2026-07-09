import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Maha OS | Local-First Digital Infrastructure',
  description:
    'Maha OS is a local-first mobile app built on edge-compute architecture — keeping your data on your device and reducing reliance on cloud surveillance. Available on iOS and Android.',
  alternates: { canonical: 'https://www.mahastrategies.com/software' },
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
        </div>
      </div>
    </div>
  )
}