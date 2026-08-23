type EngagementPathProps = {
  offer?: 'rapid' | 'verified' | 'general'
  className?: string
  /**
   * Which ground this renders on.
   *
   * Defaults to `operator` so the two pages still on the dark treatment —
   * /contact and /rapid-intelligence-brief — are unchanged. A converted page
   * opts into `paper` explicitly. Once those two are converted this prop and
   * the operator branch can go.
   */
  tone?: 'operator' | 'paper'
}

const TONE = {
  operator: {
    shell: 'border border-zinc-800 bg-zinc-950/50',
    rule: 'border-zinc-800',
    eyebrow: 'text-indigo-400',
    title: 'mt-2 text-xl font-light text-white',
    stepRule: 'border-indigo-500',
    stepLabel: 'text-indigo-300',
    stepTitle: 'mt-2 text-sm text-white',
    body: 'text-zinc-500',
  },
  paper: {
    shell: 'evidence-card',
    rule: 'border-[var(--border-default)]',
    eyebrow: 'text-[var(--text-muted)]',
    title: 'evidence-card-title mt-2',
    stepRule: 'border-[var(--status-sourced)]',
    stepLabel: 'text-[var(--text-muted)]',
    stepTitle: 'mt-2 text-sm text-[var(--text-primary)]',
    body: 'text-[var(--text-muted)]',
  },
} as const

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
export default function EngagementPath({ offer = 'general', className = '', tone = 'operator' }: EngagementPathProps) {
  const t = TONE[tone]
  const steps = [
    ['01', 'Send the decision', 'Share the question, decision, deadline, and any material constraints.'],
    ['02', 'Receive a fit check', 'Within two business days, Maha confirms fit or says plainly if the work is not a match.'],
    ['03', 'Confirm a written scope', 'Scope, deliverable, timing, and commercial terms are confirmed before research begins.'],
    ['04', 'Receive the agreed work', DELIVERY_COPY[offer]],
  ]

  return (
    <section className={`${t.shell} p-6 sm:p-8 ${className}`} aria-labelledby="engagement-path-title">
      <div className={`flex flex-col gap-2 border-b ${t.rule} pb-5 sm:flex-row sm:items-end sm:justify-between`}>
        <div>
          <p className={`font-mono text-[10px] uppercase tracking-widest ${t.eyebrow}`}>[ Clear engagement path ]</p>
          <h2 id="engagement-path-title" className={t.title}>From inquiry to a defined research engagement.</h2>
        </div>
        <p className={`font-mono text-[10px] uppercase tracking-widest ${t.body}`}>Human review at every commitment</p>
      </div>
      <ol className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([number, title, copy]) => (
          <li key={number} className={`border-l ${t.stepRule} pl-4`}>
            <p className={`font-mono text-[10px] tracking-widest ${t.stepLabel}`}>{number}</p>
            <h3 className={t.stepTitle}>{title}</h3>
            <p className={`mt-2 text-sm leading-relaxed ${t.body}`}>{copy}</p>
          </li>
        ))}
      </ol>
      <p className={`mt-6 text-xs leading-relaxed ${t.body}`}>An inquiry is not an engagement or a commitment to buy. Maha accepts work only after scope and terms are confirmed by a human.</p>
    </section>
  )
}
