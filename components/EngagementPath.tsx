type EngagementPathProps = {
  offer?: 'rapid' | 'verified' | 'general'
  className?: string
}

const DELIVERY_COPY = {
  rapid: 'Receive the agreed concise memo with linked sources, stated assumptions, and decision implications.',
  verified: 'Receive the agreed research brief with linked evidence and explicit provenance treatment for in-scope claims.',
  general: 'Receive a clear reply on fit and the appropriate next step for the question you submitted.',
} as const

/**
 * A deliberately plain-language engagement path. It is not a contract and does
 * not imply that every inquiry will be accepted; it makes the human review and
 * scope-confirmation boundary visible before a visitor shares their details.
 */
export default function EngagementPath({ offer = 'general', className = '' }: EngagementPathProps) {
  const steps = [
    ['01', 'Send the decision', 'Share the question, decision, deadline, and any material constraints.'],
    ['02', 'Receive a fit check', 'Within two business days, Maha confirms fit or says plainly if the work is not a match.'],
    ['03', 'Confirm a written scope', 'Scope, deliverable, timing, and commercial terms are confirmed before research begins.'],
    ['04', 'Receive the agreed work', DELIVERY_COPY[offer]],
  ]

  return (
    <section className={`border border-zinc-800 bg-zinc-950/50 p-6 sm:p-8 ${className}`} aria-labelledby="engagement-path-title">
      <div className="flex flex-col gap-2 border-b border-zinc-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-400">[ Clear engagement path ]</p>
          <h2 id="engagement-path-title" className="mt-2 text-xl font-light text-white">From inquiry to a defined research engagement.</h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Human review at every commitment</p>
      </div>
      <ol className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([number, title, copy]) => (
          <li key={number} className="border-l border-indigo-500 pl-4">
            <p className="font-mono text-[10px] tracking-widest text-indigo-300">{number}</p>
            <h3 className="mt-2 text-sm text-white">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{copy}</p>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-xs leading-relaxed text-zinc-500">An inquiry is not an engagement or a commitment to buy. Maha accepts work only after scope and terms are confirmed by a human.</p>
    </section>
  )
}
