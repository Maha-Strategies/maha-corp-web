import { Suspense } from 'react'
import type { Metadata } from 'next'

import PreflightSubmission from './PreflightSubmission'

export const metadata: Metadata = { title: 'Submit MPS Preflight | Maha Strategies', robots: { index: false, follow: false } }

export default function PreflightSubmissionPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#0a0a0c] px-6 py-28 text-zinc-300">Loading private preflight…</main>}><PreflightSubmission /></Suspense>
}
