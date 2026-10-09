import { TrackedLink } from '@/components/ConversionTracker'
import { getMathematicalConcept, MATHEMATICS_SOURCES } from '@/lib/mathematics-knowledge'

const PILOT_LOCATORS: Record<string, string> = {
  '/knowledge/mathematics/gamma-function': '5.5.1',
  '/knowledge/mathematics/incomplete-gamma-functions': '8.2.1',
}

/** A view of an existing public claim and reference, not a new verification verdict. */
export function SearchPilotSources({ path }: { path: string }) {
  const locator = Object.hasOwn(PILOT_LOCATORS, path) ? PILOT_LOCATORS[path] : undefined
  if (!locator) return null
  const concept = getMathematicalConcept(path.split('/').at(-1)!)
  const source = MATHEMATICS_SOURCES.find((entry) => concept?.sourceIds.includes(entry.id) && entry.url.startsWith('https://dlmf.nist.gov/'))
  const claim = concept?.invariants.find((entry) => entry.includes(locator))
  if (!concept || !source || !claim) return null
  return <section className="mt-8 rounded border border-zinc-700 p-6" aria-label="Sources and review">
    <h2 className="text-xl font-semibold">Sources and review</h2>
    <p className="mt-3 leading-7">{claim}</p>
    <dl className="mt-4 space-y-3 text-sm leading-6">
      <div><dt className="font-semibold">Source and exact locator</dt><dd>{source.title} · {source.publisher} · DLMF {locator}</dd></div>
      <div><dt className="font-semibold">Evidence basis</dt><dd>Formal mathematical reference. This panel presents the existing source mapping; it is not a new expert review or independent numerical reproduction.</dd></div>
      <div><dt className="font-semibold">Supported scope</dt><dd>{source.establishes}</dd></div>
      <div><dt className="font-semibold">Limits</dt><dd>{source.boundary}</dd></div>
    </dl>
    <TrackedLink href={`https://dlmf.nist.gov/${locator.slice(0, locator.lastIndexOf('.'))}#E${locator.split('.').at(-1)}`} event="cta_pilot_source_locator" className="mt-5 inline-block underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Inspect the source equation →</TrackedLink>
    <details className="mt-5"><summary className="cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2">What technical verification would establish</summary><p className="mt-3 text-sm leading-6">A matching digest can establish that a payload has not changed relative to that digest. It does not prove the claim true. No signed receipt, new inspection date or expert approval is asserted by this panel.</p></details>
  </section>
}
