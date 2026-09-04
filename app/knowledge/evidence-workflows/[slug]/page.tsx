import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SITE_URL } from '@/lib/briefs-data'
import {
  EVIDENCE_WORKFLOW_DATE,
  EVIDENCE_WORKFLOW_EXAMPLES,
  EVIDENCE_WORKFLOW_PATH,
  EVIDENCE_WORKFLOW_REGISTRY_PATH,
  evidenceWorkflowPath,
  getEvidenceWorkflow,
} from '@/lib/evidence-workflow-examples'

type PageProps = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return EVIDENCE_WORKFLOW_EXAMPLES.map((workflow) => ({ slug: workflow.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const workflow = getEvidenceWorkflow((await params).slug)
  if (!workflow) return {}
  const path = evidenceWorkflowPath(workflow)
  return {
    metadataBase: new URL(SITE_URL),
    title: `${workflow.title} | Evidence Workflows`,
    description: workflow.summary,
    alternates: { canonical: path },
    openGraph: { type: 'article', title: workflow.title, description: workflow.summary, url: `${SITE_URL}${path}`, siteName: 'Maha Strategies' },
  }
}

const categoryNames = {
  'evidence-preflight': 'Public Evidence Preflight example',
  'dossier-calculation-receipt': 'Evidence Dossier and receipt example',
  'mcp-release-flow': 'Governed MCP retrieval and release-flow guide',
} as const

const commercialState = {
  'available-free': 'Available free',
  'informational-purchase-disabled': 'Informational · purchase disabled',
  'private-engagement': 'Private engagement only',
} as const

export default async function EvidenceWorkflowPage({ params }: PageProps) {
  const workflow = getEvidenceWorkflow((await params).slug)
  if (!workflow) notFound()
  const path = evidenceWorkflowPath(workflow)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: workflow.title,
    description: workflow.summary,
    url: `${SITE_URL}${path}`,
    datePublished: EVIDENCE_WORKFLOW_DATE,
    dateModified: EVIDENCE_WORKFLOW_DATE,
    isAccessibleForFree: true,
    supply: workflow.startingInputs.map((name) => ({ '@type': 'HowToSupply', name })),
    step: workflow.orderedSteps.map((text, index) => ({ '@type': 'HowToStep', position: index + 1, name: `Step ${index + 1}`, text })),
  }

  return <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-cyan-300 selection:text-black sm:px-12">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <div className="mx-auto max-w-6xl">
      <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span><Link href={EVIDENCE_WORKFLOW_PATH} className="hover:text-white">Evidence workflows</Link><span className="px-2">/</span><span className="text-zinc-400">{workflow.slug}</span></nav>

      <header className="mt-10 border-b border-zinc-800 pb-10"><div className="flex flex-wrap items-center gap-3"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">{categoryNames[workflow.category]}</p><span className="border border-amber-800 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-amber-300">Synthetic worked example</span></div><h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{workflow.title}</h1><p className="mt-6 max-w-4xl font-serif text-xl leading-8 text-zinc-200">{workflow.question}</p><p className="mt-5 max-w-4xl text-sm leading-7 text-zinc-400">{workflow.summary}</p></header>

      <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_320px]"><article>
        <section><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Starting inputs</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{workflow.startingInputs.map((item) => <p key={item} className="border border-zinc-800 px-4 py-3 text-sm leading-6 text-zinc-300">{item}</p>)}</div></section>

        <section className="mt-14"><p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Ordered execution</p><h2 className="mt-3 text-3xl font-semibold text-white">Work the example</h2><ol className="mt-7 space-y-5">{workflow.orderedSteps.map((step, index) => <li key={step} className="grid grid-cols-[36px_1fr] gap-4"><span className="flex h-9 w-9 items-center justify-center border border-violet-600 font-mono text-xs text-violet-300">{index + 1}</span><p className="pt-1 text-sm leading-7 text-zinc-300">{step}</p></li>)}</ol></section>

        <section className="mt-14 grid gap-8 md:grid-cols-2"><div><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Expected outputs</p><ul className="mt-5 space-y-3">{workflow.expectedOutputs.map((item) => <li key={item} className="border-l border-emerald-700 pl-3 text-sm leading-6 text-zinc-300">{item}</li>)}</ul></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Verification checks</p><ul className="mt-5 space-y-3">{workflow.verificationChecks.map((item) => <li key={item} className="border-l border-cyan-700 pl-3 text-sm leading-6 text-zinc-300">{item}</li>)}</ul></div></section>

        <section className="mt-14 border border-rose-900/60 bg-rose-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Fail closed</p><h2 className="mt-3 text-2xl font-semibold text-white">Refusal conditions</h2><ul className="mt-5 space-y-3">{workflow.refusalConditions.map((item) => <li key={item} className="border-l border-rose-700 pl-3 text-sm leading-6 text-zinc-300">{item}</li>)}</ul></section>

        {workflow.preflightResult && <section className="mt-14"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Real compiler output · synthetic input</p><h2 className="mt-3 text-3xl font-semibold text-white">Preflight result</h2><div className="mt-6 grid gap-3 sm:grid-cols-4"><div className="border border-zinc-800 p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Claims</p><p className="mt-2 text-2xl text-white">{workflow.preflightResult.summary.claimCount}</p></div><div className="border border-zinc-800 p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Ready</p><p className="mt-2 text-2xl text-emerald-300">{workflow.preflightResult.summary.readyForSourceInspection}</p></div><div className="border border-zinc-800 p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Blocked</p><p className="mt-2 text-2xl text-rose-300">{workflow.preflightResult.summary.blockedBeforeSourceInspection}</p></div><div className="border border-zinc-800 p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Metadata only</p><p className="mt-2 text-2xl text-white">{workflow.preflightResult.summary.metadataOnly}</p></div></div><div className="mt-5 space-y-3">{workflow.preflightResult.assessments.map((assessment) => <div key={assessment.claimId} className="border-l border-zinc-700 pl-4"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{assessment.claimId} · {assessment.readiness}</p><p className="mt-2 text-sm leading-6 text-zinc-400">{assessment.blockers.length ? assessment.blockers.join(' · ') : 'No structural blockers; source inspection is still required.'}</p></div>)}</div></section>}

        <section className="mt-14"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Digest-bound public fixture</p><h2 className="mt-3 text-3xl font-semibold text-white">Check the expected state</h2><p className="mt-3 text-sm leading-7 text-zinc-500">This fixture contains synthetic operational fields only. Its digest establishes fixture integrity, not scientific truth or a completed commercial transaction.</p><pre className="knowledge-machine-panel mt-6 overflow-x-auto border border-zinc-800 bg-[#13211c] p-5 text-xs leading-6 text-[#edf8f4]"><code>{JSON.stringify({ artifactKind: workflow.fixture.artifactKind, schemaVersion: workflow.fixture.schemaVersion, input: workflow.fixture.input, expected: workflow.fixture.expected, artifactSha256: workflow.fixture.artifactSha256 }, null, 2)}</code></pre></section>
      </article>

      <aside className="space-y-7"><div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Evidence boundary</p><p className="mt-4 text-sm leading-7 text-zinc-400">{workflow.boundary}</p></div><div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Existing contracts</p><div className="mt-4 space-y-4">{workflow.contractLinks.map((item) => <Link key={item.path} href={item.path} className="block border-l border-cyan-800 pl-3"><span className="block text-sm text-zinc-300 hover:text-white">{item.title}</span><span className="mt-1 block font-mono text-[9px] uppercase tracking-widest text-zinc-600">{item.role}</span></Link>)}</div></div><div className="border border-amber-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Commercial next step</p><p className="mt-3 text-xs uppercase tracking-widest text-zinc-500">{commercialState[workflow.commercialNextStep.state]}</p><Link href={workflow.commercialNextStep.path} className="mt-4 block text-sm text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white">{workflow.commercialNextStep.label} →</Link></div><a href={EVIDENCE_WORKFLOW_REGISTRY_PATH} className="block border border-violet-800 p-5 font-mono text-[10px] uppercase tracking-widest text-violet-300 hover:border-violet-400">Machine-readable registry →</a><p className="break-all font-mono text-[9px] leading-5 text-zinc-700">{workflow.workflowSha256}</p></aside></div>
    </div>
  </main>
}
