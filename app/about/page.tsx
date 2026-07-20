import type { Metadata } from 'next'
import Link from 'next/link'

import { mahaEntityGraphJsonLd } from '@/lib/entity'

export const metadata: Metadata = {
  title: 'About Maha Strategies LLC',
  description: 'Maha Strategies LLC is an independent think tank and advisory firm researching systemic sovereignty across silicon, software, and human attention.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About Maha Strategies LLC',
    description: 'Independent research and advisory work on systemic sovereignty across silicon, software, and human attention.',
    url: '/about',
  },
}

const pillars = [
  ['Infrastructure', 'Semiconductor supply chains, assembly capacity, and the strategic conditions for resilient compute.'],
  ['Interface', 'On-device AI, local-first software, and the practical conditions for digital autonomy.'],
  ['Intellect', 'Attention, cognitive liberty, and the human conditions that make autonomy durable.'],
]

export default function AboutPage() {
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(mahaEntityGraphJsonLd).replace(/</g, '\\u003c') }} />
    <div className="mx-auto max-w-4xl">
      <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Entity profile · Maha Strategies LLC ]</p>
      <h1 className="mt-5 max-w-3xl text-4xl font-light leading-tight tracking-tight text-white sm:text-6xl">Research for systems that can remain autonomous.</h1>
      <p className="mt-7 max-w-3xl text-lg leading-relaxed text-zinc-400">Maha Strategies LLC is an independent think tank and advisory firm researching <Link className="text-zinc-200 underline underline-offset-4 hover:text-white" href="/systemic-sovereignty">systemic sovereignty</Link>: how individuals, companies, and nations can remain autonomous across semiconductor supply chains, software and on-device AI, and human attention.</p>

      <section className="mt-14 border-y border-zinc-800 py-8">
        <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500">The three-layer research model</h2>
        <div className="mt-7 grid gap-7 md:grid-cols-3">
          {pillars.map(([title, description]) => <div key={title}>
            <h3 className="text-lg text-white">{title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{description}</p>
          </div>)}
        </div>
      </section>

      <section className="mt-14 grid gap-10 border-b border-zinc-800 pb-14 md:grid-cols-[1fr_2fr]">
        <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500">Leadership</h2>
        <div>
          <h3 className="text-2xl text-white">Mayone Maha Rajan</h3>
          <p className="mt-2 font-mono text-xs uppercase tracking-widest text-indigo-300">Founder and Managing Director</p>
          <p className="mt-5 max-w-2xl leading-relaxed text-zinc-400">Mayone Maha Rajan leads Maha Strategies&rsquo; research, editorial work, and advisory practice. He is responsible for the firm&rsquo;s published arguments, research direction, and the Maha Provenance Standard.</p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <a className="text-zinc-200 underline underline-offset-4 hover:text-white" href="https://www.mayonemaharajan.com" rel="me">Founder dossier ↗</a>
            <a className="text-zinc-200 underline underline-offset-4 hover:text-white" href="https://github.com/mayonerajan" rel="me">GitHub ↗</a>
          </div>
        </div>
      </section>

      <section className="mt-14 grid gap-10 md:grid-cols-[1fr_2fr]">
        <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500">Verifiable work</h2>
        <div className="space-y-5 text-sm leading-relaxed text-zinc-400">
          <p>The <Link className="text-zinc-200 underline underline-offset-4 hover:text-white" href="/mps">Maha Provenance Standard (MPS/0.1)</Link> is the firm&rsquo;s claim-level provenance framework for AI-assisted nonfiction. Its public archival record is available through <a className="text-zinc-200 underline underline-offset-4 hover:text-white" href="https://doi.org/10.5281/zenodo.21241308">Zenodo DOI 10.5281/zenodo.21241308 ↗</a>.</p>
          <p>Research and advisory work distinguish sourced evidence, interpretation, and bounded speculation. Read the <Link className="text-zinc-200 underline underline-offset-4 hover:text-white" href="/method">method</Link>, browse <Link className="text-zinc-200 underline underline-offset-4 hover:text-white" href="/intelligence">intelligence</Link>, or <Link className="text-zinc-200 underline underline-offset-4 hover:text-white" href="/contact">contact Maha Strategies</Link>.</p>
        </div>
      </section>
    </div>
  </main>
}
