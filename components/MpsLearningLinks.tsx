import Link from 'next/link'

const guides = [
  {
    href: '/mps/claim-level-provenance',
    label: 'Claim-level provenance',
    description: 'What must travel with a claim for it to remain inspectable.',
  },
  {
    href: '/mps/citing-ai-assisted-research',
    label: 'Citing AI-assisted research',
    description: 'How disclosure, citations, and source limits work together.',
  },
  {
    href: '/mps/source-interpretation-speculation',
    label: 'Source, interpretation, speculation',
    description: 'A practical way to separate evidence from judgement.',
  },
]

export default function MpsLearningLinks({ current }: { current?: string }) {
  return (
    <section className="mt-14 border-y border-zinc-800 py-8" aria-labelledby="mps-learning-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ MPS learning center ]</p>
          <h2 id="mps-learning-heading" className="mt-2 text-2xl font-light text-white">Learn the practice before using the tool.</h2>
        </div>
        <Link href="/mps/learn" className="font-mono text-xs uppercase tracking-widest text-zinc-300 underline underline-offset-4 hover:text-white">
          All guides
        </Link>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {guides.map((guide) => (
          <Link
            key={guide.href}
            href={guide.href}
            aria-current={current === guide.href ? 'page' : undefined}
            className={`border p-4 transition ${current === guide.href ? 'border-indigo-400 bg-indigo-950/25' : 'border-zinc-800 hover:border-zinc-600'}`}
          >
            <h3 className="text-sm text-zinc-100">{guide.label}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{guide.description}</p>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm leading-relaxed text-zinc-500">
        MPS is a self-published framework and audit aid. It does not certify truth, replace primary-source review, or make an AI output authoritative.
      </p>
    </section>
  )
}
