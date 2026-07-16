import { Suspense } from 'react'
import type { Metadata } from 'next'

import PreflightReport from './PreflightReport'

export const metadata: Metadata = { title: 'MPS Preflight Report | Maha Strategies', robots: { index: false, follow: false } }
export default function PreflightReportPage() { return <Suspense fallback={<main className="min-h-screen bg-[#0a0a0c] px-6 py-28 text-zinc-300">Loading private report…</main>}><PreflightReport /></Suspense> }
