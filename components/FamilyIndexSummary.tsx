import { summariseFamily } from '@/lib/legacy-index-summary'

/**
 * States how much of a family is evidence-verified, and says so plainly when
 * some of it is not. Navigation is offered only to verified children.
 */
export function FamilyIndexSummary({
  familyRoute, childRoutes,
}: { familyRoute: string; childRoutes: readonly string[] }) {
  const summary = summariseFamily(familyRoute, childRoutes)
  if (summary.verifiedChildren === 0) return null

  return (
    <section className="mt-12 border border-zinc-800 bg-zinc-950/40 p-6">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Evidence coverage</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{summary.disclosure}</p>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        {summary.verifiedChildren} verified · {summary.unverifiedChildren} not verified
      </p>
    </section>
  )
}
