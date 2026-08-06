import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tensor-Network Optimization API | Maha Strategies',
  description: 'A real bounded-bond GPU heuristic for QUBO and Ising problems, with verified objectives and published A10G benchmarks.',
  alternates: { canonical: '/tensor-opt' },
}

export default function TensorOptimizationPage() {
  return <main className="min-h-screen bg-[#07090d] text-zinc-300"><article className="mx-auto max-w-5xl px-6 py-20 sm:py-28"><p className="font-mono text-[11px] uppercase tracking-widest text-cyan-300">GPU optimization / live API</p><h1 className="mt-5 max-w-4xl text-5xl font-light tracking-tight text-white sm:text-7xl">Bounded-bond tensor-network optimization.</h1><p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-400">A real transfer-tensor contraction for sparse QUBO and Ising models. The frontier is truncated to a declared bond dimension, every returned objective is recomputed, and heuristic runs never claim a certified bound or global optimum.</p><section className="mt-12 grid gap-4 sm:grid-cols-3"><Metric label="Maximum variables" value="256" /><Metric label="Bond dimension" value="2–4,096" /><Metric label="A10G p95 / 256" value="80.840 ms" /></section><section className="mt-14 border-y border-zinc-800 py-10"><h2 className="text-2xl text-white">Production boundary</h2><p className="mt-4 max-w-3xl leading-7 text-zinc-400">Exact enumeration is available through 18 variables. Above that threshold, <code className="text-cyan-200">bounded-bond-transfer-contraction-torch-v1</code> is explicitly heuristic. Inputs are bounded inline data and are not echoed by the job API.</p></section><pre className="mt-12 overflow-x-auto border border-zinc-800 bg-black/40 p-6 text-sm leading-6 text-cyan-100"><code>{`const result = await maha.optimization.solveTensorNetwork({
  clientRequestId: crypto.randomUUID().replaceAll('-', ''),
  problem: { formulation: 'qubo', size: 3, terms },
  solver: { bondDimension: 256, exactThreshold: 18 }
})`}</code></pre><div className="mt-10 flex flex-wrap gap-4"><Link href="/docs" className="border border-cyan-500 px-5 py-3 font-mono text-xs uppercase tracking-widest text-cyan-100">Open API reference</Link><Link href="/dashboard" className="border border-zinc-700 px-5 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200">Get an API key</Link></div></article></main>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p><p className="mt-3 text-2xl text-white">{value}</p></div> }
