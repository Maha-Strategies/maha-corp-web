import { evidenceStatusFor } from '@/lib/evidence-status-runtime'

const TONE: Record<string, { border: string; bg: string; label: string }> = {
  'independently-supported': { border: 'border-emerald-900/60', bg: 'bg-emerald-950/10', label: 'text-emerald-300' },
  'cited-but-uninspected': { border: 'border-amber-900/60', bg: 'bg-amber-950/10', label: 'text-amber-300' },
  'first-party-documented': { border: 'border-amber-900/60', bg: 'bg-amber-950/10', label: 'text-amber-300' },
}

/**
 * States what stands behind the page, before the page says anything.
 *
 * Rendered for supported and unsupported pages alike. A caveat that appears
 * only on weak pages makes silence ambiguous -- a reader cannot tell a checked
 * page from one where the banner failed to render -- so both cases say which
 * they are.
 */
export function EvidenceStatus({ route }: { route: string }) {
  const status = evidenceStatusFor(route)
  if (!status) return null
  const tone = TONE[status.status] ?? TONE['cited-but-uninspected']

  return (
    <section className={`mt-12 border ${tone.border} ${tone.bg} p-6`} aria-label="Evidence status">
      <h2 className={`font-mono text-[10px] uppercase tracking-widest ${tone.label}`}>Evidence status</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-zinc-200">{status.headline}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{status.detail}</p>

      <div className="mt-5 space-y-3 border-t border-zinc-800 pt-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Rely on this page for</p>
          <p className="mt-1.5 text-sm leading-6 text-zinc-400">{status.useFor}</p>
        </div>
        {status.doNotUseFor ? (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Do not rely on it for</p>
            <p className="mt-1.5 text-sm leading-6 text-zinc-400">{status.doNotUseFor}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
