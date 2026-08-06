import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'SE(3) Geometric Registration API | Maha Strategies',
  description: 'Weighted GPU rigid registration for paired 3D point clouds, with residual verification and published A10G benchmarks.',
  alternates: { canonical: '/geometric-optimization' },
}

export default function GeometricOptimizationPage() {
  return <main className="min-h-screen bg-[#070b10] text-zinc-300"><article className="mx-auto max-w-5xl px-6 py-20 sm:py-28"><p className="font-mono text-[11px] uppercase tracking-widest text-emerald-300">Geometric optimization / live API</p><h1 className="mt-5 max-w-4xl text-5xl font-light tracking-tight text-white sm:text-7xl">Weighted SE(3) point-cloud registration.</h1><p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-400">A real weighted Kabsch SVD solve for the least-squares rigid transform between paired three-dimensional points. Results include the rotation, translation, RMSE, maximum residual, and determinant.</p><section className="mt-12 grid gap-4 sm:grid-cols-3"><Metric label="Paired points" value="3–16,384" /><Metric label="Transform" value="SE(3)" /><Metric label="A10G p95 / 16K" value="108.604 ms" /></section><section className="mt-14 border-y border-zinc-800 py-10"><h2 className="text-2xl text-white">Production boundary</h2><p className="mt-4 max-w-3xl leading-7 text-zinc-400">The contract assumes known point correspondences and rigid motion. It does not search for correspondences, train a geometric model, or perform non-rigid deformation. The API verifies rotation orthogonality and determinant before settling the job.</p></section><pre className="mt-12 overflow-x-auto border border-zinc-800 bg-black/40 p-6 text-sm leading-6 text-emerald-100"><code>{`const result = await maha.optimization.solveGeometricRegistration({
  clientRequestId: crypto.randomUUID().replaceAll('-', ''),
  problem: { sourcePoints, targetPoints, weights }
})`}</code></pre><div className="mt-10 flex flex-wrap gap-4"><Link href="/docs" className="border border-emerald-500 px-5 py-3 font-mono text-xs uppercase tracking-widest text-emerald-100">Open API reference</Link><Link href="/dashboard" className="border border-zinc-700 px-5 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200">Get an API key</Link></div></article></main>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p><p className="mt-3 text-2xl text-white">{value}</p></div> }
