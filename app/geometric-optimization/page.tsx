import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'SE(3) Geometric Registration API | Maha Strategies',
  description: 'Weighted GPU rigid registration for paired 3D point clouds, with residual verification and published A10G benchmarks.',
  alternates: { canonical: '/geometric-optimization' },
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="evidence-card">
      <p className="evidence-kicker">{label}</p>
      <p className="evidence-card-title mt-3">{value}</p>
    </article>
  )
}

export default function GeometricOptimizationPage() {
  return (
    <main className="evidence-page">
      <div className="evidence-container">
        <section className="evidence-section">
          <p className="evidence-kicker">Geometric optimization / live API</p>
          <h1 className="evidence-title">Weighted SE(3) point-cloud registration.</h1>
          <p className="evidence-lede mt-7">
            A real weighted Kabsch SVD solve for the least-squares rigid transform between paired three-dimensional points. Results include the rotation,
            translation, RMSE, maximum residual, and determinant.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Metric label="Paired points" value="3–16,384" />
            <Metric label="Transform" value="SE(3)" />
            <Metric label="A10G p95 / 16K" value="108.604 ms" />
          </div>
        </section>

        <section className="evidence-section">
          <h2 className="evidence-section-title">Production boundary</h2>
          <p className="evidence-copy mt-4">
            The contract assumes known point correspondences and rigid motion. It does not search for correspondences, train a geometric model, or perform
            non-rigid deformation. The API verifies rotation orthogonality and determinant before settling the job.
          </p>
        </section>

        <section className="evidence-section">
          <h2 className="evidence-section-title">Example payload</h2>
          <pre className="evidence-code mt-4 overflow-x-auto p-5 text-xs">
            <code>{`const result = await maha.optimization.solveGeometricRegistration({
  clientRequestId: crypto.randomUUID().replaceAll('-', ''),
  problem: { sourcePoints, targetPoints, weights }
})`}</code>
          </pre>
        </section>

        <section className="evidence-section">
          <h2 className="evidence-section-title">Where to continue</h2>
          <p className="evidence-copy mt-4">Use the docs and dashboard to review runtime keys, limits, and policy constraints.</p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link href="/docs" className="evidence-action evidence-action--secondary">
              Open API reference
            </Link>
            <Link href="/dashboard" className="evidence-action evidence-action--secondary">Get an API key</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
