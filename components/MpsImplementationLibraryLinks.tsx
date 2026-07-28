import Link from 'next/link'

const links = [
  { href: '/mps/learn/implementation', label: 'Decision framework', description: 'Compare privacy, capability, cost, latency, resilience, and device fit.' },
  { href: '/on-device-ai-vs-cloud', label: 'On-device vs cloud', description: 'The canonical workload-level deployment comparison.' },
  { href: '/mps/learn/implementation/individuals', label: 'Individuals', description: 'Choose a bounded, reversible personal workflow.' },
  { href: '/mps/learn/implementation/schools', label: 'Schools', description: 'Plan classroom use with student-data and access boundaries.' },
  { href: '/mps/learn/implementation/small-organizations', label: 'Small organizations', description: 'Start with a managed, testable operational use case.' },
  { href: '/mps/learn/implementation/developers', label: 'Developers', description: 'Build and measure a local, cloud, or hybrid boundary.' },
  { href: '/mps/learn/glossary', label: 'Glossary', description: 'Plain-language deployment and provenance terms.' },
  { href: '/mps/learn/methodology', label: 'Methodology & sources', description: 'What this library measures, assumes, and does not claim.' },
]

export default function MpsImplementationLibraryLinks({ current }: { current?: string }) {
  return <section className="mt-14 border-y border-zinc-800 py-8" aria-labelledby="implementation-library-heading">
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ MPS implementation library ]</p>
        <h2 id="implementation-library-heading" className="mt-2 text-2xl font-light text-white">Choose a boundary, then test it.</h2>
      </div>
      <Link href="/mps/learn" className="font-mono text-xs uppercase tracking-widest text-zinc-300 underline underline-offset-4 hover:text-white">Learning Center</Link>
    </div>
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      {links.map((link) => <Link key={link.href} href={link.href} aria-current={current === link.href ? 'page' : undefined} className={`border p-4 transition ${current === link.href ? 'border-indigo-400 bg-indigo-950/25' : 'border-zinc-800 hover:border-zinc-600'}`}>
        <h3 className="text-sm text-zinc-100">{link.label}</h3><p className="mt-2 text-sm leading-relaxed text-zinc-500">{link.description}</p>
      </Link>)}
    </div>
  </section>
}
