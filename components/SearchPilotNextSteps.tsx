import { TrackedLink } from '@/components/ConversionTracker'
import { pilotNextSteps } from '@/lib/search-pilot-next-steps'

/** Server-side offer projection; only public link props cross the client boundary. */
export function SearchPilotNextSteps({ path }: { path: string }) {
  const steps = pilotNextSteps(path)
  if (!steps) return null
  return <section className="mx-auto mt-12 max-w-5xl border-t border-zinc-700 py-8" aria-label="Next steps">
    <h2 className="text-2xl font-semibold">{steps.heading}</h2>
    <p className="mt-3 text-sm leading-6">The explanation remains free to read. These optional services have different scopes; none certifies universal truth.</p>
    <div className="mt-6 grid gap-5 md:grid-cols-2">
      {steps.offers.map((offer) => <article key={offer.id} className="rounded border border-zinc-700 p-5">
        <h3 className="text-lg font-semibold">{offer.name} · {offer.price}</h3>
        <p className="mt-3 text-sm leading-6">{offer.scope}</p>
        <p className="mt-3 text-sm leading-6"><strong>Limit:</strong> {offer.boundary}</p>
        <TrackedLink href={offer.href} event={offer.event} className="mt-5 inline-block underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">{offer.action} →</TrackedLink>
      </article>)}
    </div>
    <TrackedLink href={steps.resource.href} event={steps.resource.event} className="mt-6 inline-block underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">{steps.resource.label} →</TrackedLink>
  </section>
}
