import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SITE_URL } from '@/lib/briefs-data'
import {
  ASTROLOGY_WORKFLOW_DATE,
  ASTROLOGY_WORKFLOW_PATH,
  ASTROLOGY_WORKFLOW_PROTOCOLS,
  ASTROLOGY_WORKFLOW_REGISTRY_PATH,
  astrologyWorkflowPath,
  getAstrologyWorkflow,
} from '@/lib/astrology-workflow-protocols'
import { ASTROLOGY_ANSWER_GRAPH_PATH, astrologyAnswerPath, getAstrologyAnswer } from '@/lib/astrology-answer-graph'

type PageProps = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return ASTROLOGY_WORKFLOW_PROTOCOLS.map((workflow) => ({ slug: workflow.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const workflow = getAstrologyWorkflow((await params).slug)
  if (!workflow) return {}
  const path = astrologyWorkflowPath(workflow)
  return {
    metadataBase: new URL(SITE_URL),
    title: `${workflow.title} | Astrology Workflow Protocols`,
    description: workflow.objective,
    alternates: { canonical: path },
    openGraph: { type: 'article', title: workflow.title, description: workflow.objective, url: `${SITE_URL}${path}`, siteName: 'Maha Strategies' },
  }
}

const categoryName = {
  'input-reference-frame': 'Input and reference-frame workflow',
  'calculation-uncertainty': 'Deterministic calculation and uncertainty workflow',
  'evaluation-falsifiability': 'Prospective evaluation and falsifiability protocol',
  'tradition-comparison': 'Tradition-comparison decision map',
} as const

export default async function AstrologyWorkflowPage({ params }: PageProps) {
  const workflow = getAstrologyWorkflow((await params).slug)
  if (!workflow) notFound()
  const path = astrologyWorkflowPath(workflow)
  const answerLinks = workflow.relatedAnswerSlugs.map(getAstrologyAnswer).filter((answer) => answer !== undefined)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: workflow.title,
    description: workflow.objective,
    url: `${SITE_URL}${path}`,
    datePublished: ASTROLOGY_WORKFLOW_DATE,
    dateModified: ASTROLOGY_WORKFLOW_DATE,
    supply: workflow.requiredInputs.map((name) => ({ '@type': 'HowToSupply', name })),
    step: workflow.orderedSteps.map((text, index) => ({ '@type': 'HowToStep', position: index + 1, name: `Step ${index + 1}`, text })),
    citation: workflow.authority.map((item) => `${SITE_URL}${item.path}`),
  }

  return <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-violet-300 selection:text-black sm:px-12">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <div className="mx-auto max-w-6xl">
      <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge/astrology" className="hover:text-white">Astrology</Link><span className="px-2">/</span><Link href={ASTROLOGY_WORKFLOW_PATH} className="hover:text-white">Protocols</Link><span className="px-2">/</span><span className="text-zinc-400">{workflow.slug}</span></nav>

      <header className="mt-10 border-b border-zinc-800 pb-10"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-300">{categoryName[workflow.category]}</p><h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{workflow.title}</h1><p className="mt-6 max-w-4xl font-serif text-lg leading-8 text-zinc-300">{workflow.objective}</p></header>

      <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_320px]"><article>
        <section><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Required inputs</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{workflow.requiredInputs.map((item) => <p key={item} className="border border-zinc-800 px-4 py-3 text-sm leading-6 text-zinc-300">{item}</p>)}</div></section>

        <section className="mt-14"><p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Ordered execution</p><h2 className="mt-3 text-3xl font-semibold text-white">Work the protocol</h2><ol className="mt-7 space-y-5">{workflow.orderedSteps.map((step, index) => <li key={step} className="grid grid-cols-[36px_1fr] gap-4"><span className="flex h-9 w-9 items-center justify-center border border-violet-600 font-mono text-xs text-violet-300">{index + 1}</span><p className="pt-1 text-sm leading-7 text-zinc-300">{step}</p></li>)}</ol></section>

        <section className="mt-14 grid gap-8 md:grid-cols-2"><div><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Outputs</p><ul className="mt-5 space-y-3">{workflow.outputs.map((item) => <li key={item} className="border-l border-emerald-700 pl-3 text-sm leading-6 text-zinc-300">{item}</li>)}</ul></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Done only when</p><ul className="mt-5 space-y-3">{workflow.completionCriteria.map((item) => <li key={item} className="border-l border-cyan-700 pl-3 text-sm leading-6 text-zinc-300">{item}</li>)}</ul></div></section>

        <section className="mt-14 border border-rose-900/60 bg-rose-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Fail closed</p><h2 className="mt-3 text-2xl font-semibold text-white">Refusal conditions</h2><ul className="mt-5 space-y-3">{workflow.refusalConditions.map((item) => <li key={item} className="border-l border-rose-700 pl-3 text-sm leading-6 text-zinc-300">{item}</li>)}</ul></section>

        {workflow.fixture && <section className="mt-14"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Recomputable fixture</p><h2 className="mt-3 text-3xl font-semibold text-white">Calculation receipt</h2><p className="mt-3 text-sm leading-7 text-zinc-500">The output and digest are derived from the displayed inputs. The fixture demonstrates the operation, not an astrological prediction.</p><div className="mt-6 overflow-x-auto border border-zinc-800 bg-black p-5 font-mono text-xs leading-6 text-zinc-400"><p><span className="text-zinc-600">operation</span> {workflow.fixture.operation}</p>{Object.entries(workflow.fixture.inputs).map(([key, value]) => <p key={key}><span className="text-zinc-600">input.{key}</span> {value}</p>)}{Object.entries(workflow.fixture.outputs).map(([key, value]) => <p key={key}><span className="text-emerald-400">output.{key}</span> {value}</p>)}<p className="mt-3 break-all text-amber-300">{workflow.fixture.receiptSha256}</p></div><p className="mt-4 text-sm leading-6 text-zinc-500"><span className="text-zinc-300">Uncertainty:</span> {workflow.fixture.uncertainty}</p></section>}
      </article>

      <aside className="space-y-7"><div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Protocol boundary</p><p className="mt-4 text-sm leading-7 text-zinc-400">{workflow.boundary}</p></div><div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Authority contracts</p><div className="mt-4 space-y-4">{workflow.authority.map((item) => <Link key={item.id} href={item.path} className="block border-l border-violet-800 pl-3"><span className="block text-sm text-zinc-300 hover:text-white">{item.title}</span><span className="mt-1 block font-mono text-[9px] uppercase tracking-widest text-zinc-600">{item.family} · {item.status}</span></Link>)}</div></div><div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Related explanations</p><div className="mt-4 space-y-3">{answerLinks.map((answer) => <Link key={answer.slug} href={astrologyAnswerPath(answer)} className="block text-sm text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-white">{answer.shortTitle} →</Link>)}</div><Link href={ASTROLOGY_ANSWER_GRAPH_PATH} className="mt-5 block font-mono text-[9px] uppercase tracking-widest text-violet-300">All bounded answers →</Link></div><a href={ASTROLOGY_WORKFLOW_REGISTRY_PATH} className="block border border-violet-800 p-5 font-mono text-[10px] uppercase tracking-widest text-violet-300 hover:border-violet-400">Machine-readable registry →</a></aside></div>
    </div>
  </main>
}
