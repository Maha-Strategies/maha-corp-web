import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ROBOTICS_ARTICLES, ROBOTICS_PATH, ROBOTICS_SOURCES } from '@/lib/robotics-knowledge'
import { roboticsSummary } from '@/lib/robotics-evidence'

const special = { 'evidence-package': 'Robotics evidence-package specification', 'pick-place-example': 'A reproducible grid-world pick-and-place experiment' }
export const dynamicParams = false
export function generateStaticParams() { return [...ROBOTICS_ARTICLES.map(a => ({ slug: a.slug })), ...Object.keys(special).map(slug => ({ slug }))] }
type Props = { params: Promise<{ slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = ROBOTICS_ARTICLES.find(a => a.slug === slug)
  if (!article && !Object.hasOwn(special, slug)) notFound()
  const title = article?.title ?? special[slug as keyof typeof special]
  const description = article?.answer ?? 'Inspect a bounded, synthetic robotics evidence contract and its replay limits.'
  const canonical = `https://www.mahastrategies.com${ROBOTICS_PATH}/${slug}`
  return { title: `${title} | Maha Strategies`, description, alternates: { canonical }, openGraph: { type: 'article', title, description, url: canonical, siteName: 'Maha Strategies' } }
}
export default async function RoboticsArticlePage({ params }: Props) {
  const { slug } = await params
  const article = ROBOTICS_ARTICLES.find(a => a.slug === slug)
  if (!article && !Object.hasOwn(special, slug)) notFound()
  return <main className="mx-auto max-w-3xl space-y-8 px-6 py-12 leading-relaxed">
    <nav aria-label="Breadcrumb"><a className="underline" href={ROBOTICS_PATH}>Robotics evidence and evaluation</a></nav>
    <header><p>Robotics evidence guide · automated editorial preparation, not expert review</p><h1 className="text-3xl font-semibold">{article?.title ?? special[slug as keyof typeof special]}</h1></header>
    {article ? <>
      <p className="text-lg">{article.answer}</p>
      <section><h2 className="text-xl font-semibold">Evidence and interpretation</h2><p>{article.explanation}</p></section>
      <section><h2 className="text-xl font-semibold">Proposed evidence workflow</h2><ol className="list-decimal space-y-3 pl-6">{article.procedure.map(p => <li key={p}>{p}</li>)}</ol></section>
      <section><h2 className="text-xl font-semibold">Worked illustration</h2><p>{article.example}</p></section>
      <section><h2 className="text-xl font-semibold">Limits</h2><p>{article.boundary}</p></section>
      <section><h2 className="text-xl font-semibold">Sources and review</h2>{article.sources.map(id => { const s = ROBOTICS_SOURCES[id]; return <div className="my-5 space-y-2" key={id}><a className="underline" href={s.url}>{s.title}</a><p>Locator: {s.locator}</p><p>{s.claim}</p><p>Boundary: {s.boundary}</p><details><summary>Inspection and reuse basis</summary><p>Selected sections inspected {s.inspected}. {s.rights} This is not independent expert review of this article.</p></details></div> })}</section>
      <section><h2 className="text-xl font-semibold">Continue reading</h2><ul>{article.related.map(s => <li key={s}><a className="underline" href={`${ROBOTICS_PATH}/${s}`}>{ROBOTICS_ARTICLES.find(a => a.slug === s)?.title ?? special[s as keyof typeof special]}</a></li>)}</ul></section>
    </> : slug === 'evidence-package' ? <>
      <p>This Maha-authored experimental contract binds one fixed synthetic task plan to complete ordered trials and recomputed metrics. It is deliberately not a general robot-certification format.</p>
      <section><h2 className="text-xl font-semibold">Required contents</h2><dl className="space-y-4">{[
        ['schema and domain', 'maha-robotics-evidence/0.1; toy-simulation only. Unsupported versions or domains are refused.'],
        ['plan and planDigest', 'Initial state, grid bounds, units, controller IDs, all six cases, action budgets, assistance flags, scoring and omitted capabilities.'],
        ['artifacts', 'Digests identify the executing simulator functions and controller implementation. They are not signatures or independent attestations.'],
        ['trials', 'Twelve ordered trials with IDs, controller, case, outcome, reason, action count and ordered state events. Failed and assisted trials remain in the denominator.'],
        ['metrics', 'Per-controller autonomous, assisted and failed counts; the autonomous rate is an exact numerator/denominator pair.'],
        ['observer, rights, review and limitations', 'Same-process observation, synthetic-data provenance and explicit exclusions including hardware safety.'],
        ['packageDigest', 'SHA-256 of the canonical body excluding packageDigest. Canonicalization sorts object keys, preserves array order and rejects non-finite or non-JSON values.'],
      ].map(([k, v]) => <div key={k}><dt className="font-semibold">{k}</dt><dd>{v}</dd></div>)}</dl></section>
      <section><h2 className="text-xl font-semibold">Verification boundary</h2><p>The verifier reruns the trusted fixed plan using local code and compares the entire canonical package. Merely rehashing an altered trace cannot make it pass. Unknown fields, omitted trials and altered scoring are refused. Verification proves agreement with this implementation, not its correctness or physical truth. A second independent implementation remains future work.</p><p>Function-source fingerprints depend on the execution toolchain. Reproduce with the same Node runtime and direct TypeScript execution; a transpiled build need not have the same fingerprint. No wall-clock timestamp, personal data or external telemetry is included.</p></section>
      <a className="underline" href={`${ROBOTICS_PATH}/pick-place-example`}>Run the example and inspect its results</a>
    </> : <>
      <p>A five-by-three grid represents carrying an object from the origin to a target. The direct controller moves horizontally then vertically. The search controller avoids blocked cells with a deterministic breadth-first search. Neither models grasp physics, vision, dynamics or real human assistance.</p>
      <p>Both run the same six cases: clear path, detour, grasp failure, simulated assistance, insufficient action budget and offset target. The assistance event is a synthetic bookkeeping flag; it does not model an operator correcting the trajectory.</p>
      <section><h2 className="text-xl font-semibold">Computed result</h2>{roboticsSummary().metrics.map(m => <p key={m.controller}>{m.controller}: {m.autonomous}/{m.planned} autonomous; {m.assisted} assisted; {m.failed} failed. All {m.recorded} planned trials retained.</p>)}<p>The difference is a result on deliberately selected fixtures—not an estimate of real-world robot reliability.</p></section>
      <section><h2 className="text-xl font-semibold">Execute locally</h2><pre className="overflow-x-auto rounded border p-4 text-sm">{'node --experimental-strip-types scripts/robotics-simulation.ts summary\nnode --experimental-strip-types scripts/robotics-simulation.ts package\nnode --experimental-strip-types scripts/robotics-simulation.ts verify <local-json-file>'}</pre><p>The command does not contact a service or retain data. Save the package output locally to use the verify command. A refusal exits with a nonzero status.</p></section>
      <section><h2 className="text-xl font-semibold">What remains untested</h2><ul className="list-disc pl-6">{roboticsSummary().limitations.map(l => <li key={l}>{l}</li>)}</ul></section>
      <a className="underline" href={`${ROBOTICS_PATH}/evidence-package`}>Inspect the package specification</a>
    </>}
  </main>
}
