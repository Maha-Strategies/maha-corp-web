import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import {
  EVIDENCE_WORKFLOW_CATEGORIES,
  EVIDENCE_WORKFLOW_COMMERCIAL_STATES,
  EVIDENCE_WORKFLOW_DATE,
  EVIDENCE_WORKFLOW_EXAMPLES,
  EVIDENCE_WORKFLOW_PATH,
  EVIDENCE_WORKFLOW_REGISTRY_DIGEST,
  EVIDENCE_WORKFLOW_REGISTRY_PATH,
  EVIDENCE_WORKFLOW_VERSION,
  evidenceWorkflowPath,
} from '@/lib/evidence-workflow-examples'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Evidence Workflows for Claims, Dossiers, Receipts, and MCP | Maha Strategies',
  description: 'Twenty synthetic worked examples connecting Evidence Preflight, Evidence Dossiers, deterministic receipts, canonical release, licensed MCP retrieval, and delivery acknowledgement.',
  alternates: { canonical: EVIDENCE_WORKFLOW_PATH },
  openGraph: { type: 'website', title: 'Maha evidence workflows', description: 'Worked, fail-closed paths from source preflight to licensed machine evidence delivery.', url: `${SITE_URL}${EVIDENCE_WORKFLOW_PATH}`, siteName: 'Maha Strategies' },
}

const categoryCopy = {
  'evidence-preflight': ['Evidence Preflight examples', 'Eight examples run synthetic claims through the real deterministic compiler: complete packets, metadata-only citations, missing locators, unsupported inference, identity failure, rights uncertainty, and mixed outcomes.'],
  'dossier-calculation-receipt': ['Dossier and calculation-receipt examples', 'Six examples cover package verification, coordinated tampering, reproducible interval arithmetic, absent calculations, PDF derivation, and runtime-witness binding.'],
  'mcp-release-flow': ['Governed MCP retrieval and release guides', 'Six guides connect discovery, identity, entitlement, exact active releases, quota, replay, private delivery receipts, and acknowledgement.'],
} as const

export default function EvidenceWorkflowHub() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Maha evidence workflows', description: metadata.description,
    url: `${SITE_URL}${EVIDENCE_WORKFLOW_PATH}`, datePublished: EVIDENCE_WORKFLOW_DATE, dateModified: EVIDENCE_WORKFLOW_DATE,
    hasPart: EVIDENCE_WORKFLOW_EXAMPLES.map((workflow) => ({ '@type': 'HowTo', name: workflow.title, url: `${SITE_URL}${evidenceWorkflowPath(workflow)}` })),
  }

  return <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-cyan-300 selection:text-black sm:px-12">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <div className="mx-auto max-w-6xl"><nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span><span className="text-zinc-400">Evidence workflows</span></nav>
      <header className="mt-10 border-b border-zinc-800 pb-10"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">Commercial-use evidence layer · {EVIDENCE_WORKFLOW_VERSION}</p><h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">From a claim-shaped question to a governed machine delivery.</h1><p className="mt-6 max-w-4xl font-serif text-lg leading-8 text-zinc-300">These worked examples connect Maha’s existing evidence and machine infrastructure. They show what passes, what refuses, what can be independently recomputed, and which commercial step is actually available.</p><p className="mt-5 max-w-4xl text-sm leading-7 text-zinc-500">Every input is synthetic. No customer submission, private corpus passage, credential, release authority, payment, or completed sale is represented.</p></header>

      <section className="mt-10 grid gap-4 md:grid-cols-3"><article className="border border-emerald-900/60 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-emerald-300">Available now · free</p><h2 className="mt-3 text-xl text-white">Evidence Preflight</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Up to three non-confidential caller-supplied claims. Structural triage only; no source fetching or verification.</p><Link href={EVIDENCE_WORKFLOW_COMMERCIAL_STATES.freePreflight.path} className="mt-5 block text-sm text-emerald-300 underline underline-offset-4">Run the preflight →</Link></article><article className="border border-amber-900/60 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-amber-300">Proposed · purchase disabled</p><h2 className="mt-3 text-xl text-white">Bounded Evidence Dossier · ${EVIDENCE_WORKFLOW_COMMERCIAL_STATES.boundedDossier.proposedPriceUsd}</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Up to ten bounded claims in a digest-bound JSON-LD and PDF package. The published offer is informational, not checkout.</p><Link href={EVIDENCE_WORKFLOW_COMMERCIAL_STATES.boundedDossier.path} className="mt-5 block text-sm text-amber-300 underline underline-offset-4">Read the offer boundary →</Link></article><article className="border border-violet-900/60 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-violet-300">Private engagement</p><h2 className="mt-3 text-xl text-white">Licensed evidence retrieval · ${EVIDENCE_WORKFLOW_COMMERCIAL_STATES.developerEvidenceRetrieval.monthlyListPriceUsd.toLocaleString('en-US')}/month</h2><p className="mt-3 text-sm leading-6 text-zinc-500">The developer plan contract exists, but its evidence runtime is not publicly callable. Access starts with a scoped private integration.</p><Link href="/contact" className="mt-5 block text-sm text-violet-300 underline underline-offset-4">Discuss an integration →</Link></article></section>

      {EVIDENCE_WORKFLOW_CATEGORIES.map((category) => { const workflows = EVIDENCE_WORKFLOW_EXAMPLES.filter((workflow) => workflow.category === category); const [title, description] = categoryCopy[category]; return <section key={category} className="mt-14 border-t border-zinc-800 pt-9"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{workflows.length} worked examples</p><h2 className="mt-3 text-3xl font-semibold text-white">{title}</h2><p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-500">{description}</p><div className="mt-7 grid gap-5 md:grid-cols-2">{workflows.map((workflow) => <Link key={workflow.slug} href={evidenceWorkflowPath(workflow)} className="group border border-zinc-800 p-6 hover:border-cyan-500/60"><p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">{workflow.orderedSteps.length} steps · {workflow.refusalConditions.length} refusals · digest-bound</p><h3 className="mt-3 text-xl font-semibold text-white group-hover:text-cyan-200">{workflow.title}</h3><p className="mt-3 text-sm leading-7 text-zinc-500">{workflow.summary}</p><p className="mt-5 font-mono text-[9px] uppercase tracking-widest text-zinc-600 group-hover:text-cyan-300">Open worked example →</p></Link>)}</div></section> })}

      <section className="mt-14 border border-zinc-800 p-6"><div className="grid gap-6 sm:grid-cols-3"><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Public workflow pages</p><p className="mt-2 text-2xl font-semibold text-white">20</p></div><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Registry digest</p><p className="mt-2 break-all font-mono text-xs text-zinc-400">{EVIDENCE_WORKFLOW_REGISTRY_DIGEST}</p></div><div><a href={EVIDENCE_WORKFLOW_REGISTRY_PATH} className="font-mono text-[10px] uppercase tracking-widest text-cyan-300 underline underline-offset-4">Open machine registry →</a></div></div></section>
    </div>
  </main>
}
