import type { Metadata } from 'next'
import Link from 'next/link'

import measurement from '@/benchmarks/mcrb-1/results.json'
import { CodeBlock, EvidenceGuide, GuideMetric } from '@/app/guides/_components/EvidenceGuide'

const path = '/guides/crewai-context-compression-provenance'
const title = 'CrewAI Context Compression with Source Provenance'
const description = 'Install the Maha CrewAI adapter, compile over-budget research inputs, and preserve a source-linked Context Pack for downstream agent work.'

export const metadata: Metadata = { title, description, alternates: { canonical: path }, openGraph: { type: 'article', url: `https://www.mahastrategies.com${path}`, title, description }, twitter: { card: 'summary_large_image', title, description } }

export default function CrewAiContextGuidePage() {
  const bm25 = measurement.results.find((result) => result.method === 'maha_bm25')!
  return <EvidenceGuide path={path} eyebrow="CrewAI integration guide" title={title} summary={description} about={['CrewAI', 'Context compression', 'AI agents', 'Provenance']} backHref="/developers" backLabel="Developer Infrastructure">
    <section className="mt-12 grid gap-4 sm:grid-cols-3"><GuideMetric label="Published cohort" value={`${measurement.dataset.cases}`} detail="Independently annotated QASPER questions" /><GuideMetric label="Mean reduction" value={`${bm25.meanReductionPercent}%`} detail="Fixed-budget MCRB-1 result" /><GuideMetric label="Complete evidence" value={`${bm25.completeEvidenceSetPercent}%`} detail="Not a guarantee for a new workload" /></section>

    <section className="mt-14"><h2 className="text-3xl font-light text-white">Install the maintained adapter</h2><CodeBlock>{`pip install 'maha-sdk[crewai]'`}</CodeBlock><p className="mt-5 leading-7 text-zinc-400">The optional extra installs CrewAI support without forcing the framework into the base SDK. The adapter exposes <code>maha_compress_context</code>, <code>maha_verify_claim</code>, and <code>maha_credit_balance</code>. Payment is not autonomous: depleted prepaid credits raise a typed error and require human authorization.</p></section>

    <section className="mt-14"><h2 className="text-3xl font-light text-white">Give the researcher a bounded compression tool</h2><CodeBlock>{`import os
from crewai import Agent, Crew, Task
from maha_sdk import MahaClient
from maha_sdk.crewai import maha_tools

client = MahaClient(api_key=os.environ["MAHA_API_KEY"])
researcher = Agent(
    role="Evidence researcher",
    goal="Answer from source-linked passages within a fixed token budget",
    backstory="Cite retained source passages and state missing evidence.",
    tools=maha_tools(client),
)

task = Task(
    description=(
        "Use maha_compress_context on the supplied documents with a 4000-token "
        "budget. Report the retained evidence and do not invent missing sources."
    ),
    expected_output="A concise answer with source and passage references.",
    agent=researcher,
)

result = Crew(agents=[researcher], tasks=[task]).kickoff(inputs={
    "documents": documents,
})`}</CodeBlock></section>

    <section className="mt-14 border border-cyan-900/50 bg-cyan-950/10 p-7"><h2 className="text-2xl text-white">Production boundary</h2><p className="mt-4 leading-7 text-zinc-400">The current CrewAI tool returns the compiled context string for agent ergonomics. If your workflow must programmatically validate every passage hash or reject unrecognized citations, call <code>MahaClient.compress()</code> directly and retain the full Context Pack object before giving <code>pack.context</code> to the agent.</p><p className="mt-4 leading-7 text-zinc-400">MCRB-1 measured {bm25.completeEvidenceSetPercent}% complete evidence-set retention at {bm25.meanReductionPercent}% mean reduction. That result describes the frozen benchmark cohort; measure your own documents before setting an automated acceptance threshold.</p></section>

    <footer className="mt-14 border-t border-zinc-800 pt-8"><div className="flex flex-wrap gap-4"><a href="https://pypi.org/project/maha-sdk/" className="text-cyan-100 underline underline-offset-4">Python package</a><Link href="/benchmarks/context-retention" className="text-cyan-100 underline underline-offset-4">Benchmark data</Link><Link href="/context-compiler/playground" className="text-cyan-100 underline underline-offset-4">Zero-install playground</Link></div></footer>
  </EvidenceGuide>
}
