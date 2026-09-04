import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import {
  ASTROLOGY_WORKFLOW_CATEGORIES,
  ASTROLOGY_WORKFLOW_DATE,
  ASTROLOGY_WORKFLOW_PATH,
  ASTROLOGY_WORKFLOW_PROTOCOLS,
  ASTROLOGY_WORKFLOW_REGISTRY_DIGEST,
  ASTROLOGY_WORKFLOW_REGISTRY_PATH,
  ASTROLOGY_WORKFLOW_VERSION,
  astrologyWorkflowPath,
} from '@/lib/astrology-workflow-protocols'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Astrology Workflow Protocols | Maha Strategies',
  description: 'Thirty-six worked protocols for source inputs, reference frames, deterministic calculations, uncertainty, prospective evaluation, falsifiability, and tradition comparison.',
  alternates: { canonical: ASTROLOGY_WORKFLOW_PATH },
  openGraph: { type: 'website', title: 'Astrology workflow protocols', description: 'Operational workflows with required inputs, ordered steps, refusals, completion tests, and recomputable calculation receipts.', url: `${SITE_URL}${ASTROLOGY_WORKFLOW_PATH}`, siteName: 'Maha Strategies' },
}

const categoryCopy = {
  'input-reference-frame': ['Input and reference-frame workflows', 'Twelve protocols that turn event claims, civil time, observer location, time scales, ephemerides, coordinate frames, zodiac conventions, and houses into explicit inputs.'],
  'calculation-uncertainty': ['Deterministic calculation and uncertainty', 'Ten worked operations with public fixtures whose outputs and digests can be independently recomputed.'],
  'evaluation-falsifiability': ['Prospective evaluation and falsifiability', 'Eight protocols for preregistration, leakage control, baselines, blinding, scoring, multiplicity, nulls, and replication.'],
  'tradition-comparison': ['Tradition-comparison decision maps', 'Six maps that preserve parallel definitions and rule namespaces instead of manufacturing blended systems.'],
} as const

export default function AstrologyWorkflowHub() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Astrology workflow protocols', description: metadata.description,
    url: `${SITE_URL}${ASTROLOGY_WORKFLOW_PATH}`, datePublished: ASTROLOGY_WORKFLOW_DATE, dateModified: ASTROLOGY_WORKFLOW_DATE,
    hasPart: ASTROLOGY_WORKFLOW_PROTOCOLS.map((workflow) => ({ '@type': 'HowTo', name: workflow.title, url: `${SITE_URL}${astrologyWorkflowPath(workflow)}` })),
  }

  return <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-violet-300 selection:text-black sm:px-12">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <div className="mx-auto max-w-6xl"><nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge/astrology" className="hover:text-white">Astrology</Link><span className="px-2">/</span><span className="text-zinc-400">Workflow protocols</span></nav>
      <header className="mt-10 border-b border-zinc-800 pb-10"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-300">Operational layer · {ASTROLOGY_WORKFLOW_VERSION}</p><h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">Do the work, preserve the uncertainty, and know when to refuse.</h1><p className="mt-6 max-w-4xl font-serif text-lg leading-8 text-zinc-300">These are execution protocols rather than additional summaries. Each route names its inputs, operations, outputs, refusal conditions, completion test, and authority contracts. Calculation routes add digest-bound fixtures that can be recomputed without trusting the page.</p></header>

      <section className="mt-10 grid gap-4 md:grid-cols-3"><div className="border border-violet-900/60 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-violet-300">{ASTROLOGY_WORKFLOW_PROTOCOLS.length} worked protocols</p><p className="mt-3 text-sm leading-6 text-zinc-500">No route duplicates the existing 36-page explanatory answer graph.</p></div><div className="border border-cyan-900/60 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">10 calculation receipts</p><p className="mt-3 text-sm leading-6 text-zinc-500">Inputs, units, assumptions, outputs, uncertainty, and SHA-256 are public.</p></div><div className="border border-rose-900/60 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-rose-300">Predictive validity not claimed</p><p className="mt-3 text-sm leading-6 text-zinc-500">Only a prospectively locked evaluation can produce a bounded performance result.</p></div></section>

      {ASTROLOGY_WORKFLOW_CATEGORIES.map((category) => { const workflows = ASTROLOGY_WORKFLOW_PROTOCOLS.filter((workflow) => workflow.category === category); const [title, description] = categoryCopy[category]; return <section key={category} className="mt-14 border-t border-zinc-800 pt-9"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{workflows.length} protocols</p><h2 className="mt-3 text-3xl font-semibold text-white">{title}</h2><p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-500">{description}</p><div className="mt-7 grid gap-5 md:grid-cols-2">{workflows.map((workflow) => <Link key={workflow.slug} href={astrologyWorkflowPath(workflow)} className="group border border-zinc-800 p-6 hover:border-violet-500/60"><p className="font-mono text-[9px] uppercase tracking-widest text-violet-300">{workflow.orderedSteps.length} steps · {workflow.refusalConditions.length} refusals{workflow.fixture ? ' · receipt' : ''}</p><h3 className="mt-3 text-xl font-semibold text-white group-hover:text-violet-200">{workflow.title}</h3><p className="mt-3 text-sm leading-7 text-zinc-500">{workflow.objective}</p><p className="mt-5 font-mono text-[9px] uppercase tracking-widest text-zinc-600 group-hover:text-violet-300">Open protocol →</p></Link>)}</div></section> })}

      <section className="mt-14 border border-zinc-800 p-6"><div className="grid gap-6 sm:grid-cols-3"><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Workflow pages</p><p className="mt-2 text-2xl font-semibold text-white">36</p></div><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Registry digest</p><p className="mt-2 break-all font-mono text-xs text-zinc-400">{ASTROLOGY_WORKFLOW_REGISTRY_DIGEST}</p></div><div><a href={ASTROLOGY_WORKFLOW_REGISTRY_PATH} className="font-mono text-[10px] uppercase tracking-widest text-violet-300 underline underline-offset-4">Open registry →</a></div></div></section>
    </div>
  </main>
}
