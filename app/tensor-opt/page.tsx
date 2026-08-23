import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tensor-Network Optimization API | Maha Strategies',
  description: 'A real bounded-bond GPU heuristic for QUBO and Ising problems, with verified objectives and published A10G benchmarks.',
  alternates: { canonical: '/tensor-opt' },
}

export default function TensorOptimizationPage() {
  return <main className="evidence-page text-[var(--text-secondary)]"><article className="mx-auto max-w-5xl px-6 py-20 sm:py-28"><p className="font-mono text-[11px] uppercase tracking-widest text-[var(--status-sourced)]">GPU optimization / live API</p><h1 className="mt-5 max-w-4xl text-5xl font-light tracking-tight text-[var(--text-primary)] sm:text-7xl">Bounded-bond tensor-network optimization.</h1><p className="mt-7 max-w-3xl text-lg leading-8 text-[var(--text-secondary)]">A real transfer-tensor contraction for sparse QUBO and Ising models. The frontier is truncated to a declared bond dimension, every returned objective is recomputed, and heuristic runs never claim a certified bound or global optimum.</p><section className="mt-12 grid gap-4 sm:grid-cols-3"><Metric label="Maximum variables" value="256" /><Metric label="Bond dimension" value="2–4,096" /><Metric label="A10G p95 / 256" value="80.840 ms" /></section><section className="mt-14 border-y border-[var(--border-default)] py-10"><h2 className="text-2xl text-[var(--text-primary)]">Production boundary</h2><p className="mt-4 max-w-3xl leading-7 text-[var(--text-secondary)]">Exact enumeration is available through 18 variables. Above that threshold, <code className="text-[var(--status-sourced)]">bounded-bond-transfer-contraction-torch-v1</code> is explicitly heuristic. Inputs are bounded inline data and are not echoed by the job API.</p></section><pre className="mt-12 overflow-x-auto border border-[var(--border-default)] bg-[#141816] p-6 text-sm leading-6 text-[var(--status-sourced)]"><code>{`const result = await maha.optimization.solveTensorNetwork({
  clientRequestId: crypto.randomUUID().replaceAll('-', ''),
  problem: { formulation: 'qubo', size: 3, terms },
  solver: { bondDimension: 256, exactThreshold: 18 }
})`}</code></pre><div className="mt-10 flex flex-wrap gap-4"><Link href="/docs" className="border border-cyan-500 px-5 py-3 font-mono text-xs uppercase tracking-widest text-[var(--status-sourced)]">Open API reference</Link><Link href="/dashboard" className="border border-[var(--border-default)] px-5 py-3 font-mono text-xs uppercase tracking-widest text-[var(--text-primary)]">Get an API key</Link></div></article></main>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="border border-[var(--border-default)] p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{label}</p><p className="mt-3 text-2xl text-[var(--text-primary)]">{value}</p></div> }
