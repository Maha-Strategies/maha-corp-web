import { firstPartyFor } from '@/lib/first-party-runtime'

/**
 * States plainly that a supplier page rests on the supplier's own documents.
 *
 * The disclosure is rendered before the content it qualifies, not after it, so
 * a reader knows what they are reading while they read it.
 */
export function FirstPartyDisclosure({ route }: { route: string }) {
  const evidence = firstPartyFor(route)
  if (!evidence) return null

  return (
    <section className="mt-12 border border-amber-900/60 bg-amber-950/10 p-6">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Evidence basis</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{evidence.disclosure}</p>

      <div className="mt-6 space-y-4 border-t border-zinc-800 pt-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">What the document records</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{evidence.establishes}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">What it does not establish</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{evidence.doesNotEstablish}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Source</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {evidence.organisation}, {evidence.documentTitle} · {evidence.exactLocator} · {evidence.publishedOrVersion}
            {' · '}
            <a href={evidence.url} target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline underline-offset-4">
              {evidence.url}
            </a>
            {' · '}inspected {evidence.inspectedOn}
          </p>
        </div>
      </div>
    </section>
  )
}
