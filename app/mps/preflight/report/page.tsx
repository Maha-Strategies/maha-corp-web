import { Suspense } from 'react'
import type { Metadata } from 'next'

import PreflightReport from './PreflightReport'

export const metadata: Metadata = { title: 'MPS Preflight Report | Maha Strategies', robots: { index: false, follow: false } }
export default function PreflightReportPage() { return <Suspense fallback={<main className="evidence-page">Loading private report…</main>}><PreflightReport /></Suspense> }
