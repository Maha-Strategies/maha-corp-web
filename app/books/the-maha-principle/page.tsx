import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'The Maha Principle | Temporarily unavailable',
  description: 'The Maha Principle web edition is temporarily unavailable while publishing maintenance is underway.',
  robots: { index: false, follow: false },
}

export default function TheMahaPrincipleMaintenancePage() {
  return (
    <main className="evidence-page">
      <article className="evidence-container evidence-container--narrow">
        <p className="evidence-kicker">[ Publishing maintenance ]</p>
        <h1 className="evidence-title evidence-title--product mt-5">The Maha Principle</h1>
        <p className="evidence-lede mt-7">The digital web edition is temporarily unavailable.</p>
        <p className="evidence-copy mt-6">
          This page will be updated when the publishing maintenance period is complete.
        </p>
        <div className="mt-8 flex flex-col items-start gap-4">
          <Link href="/books/the-maha-principle/reader-faq" className="evidence-link">
            Read the new reader FAQ ↗
          </Link>
          <Link href="/books" className="evidence-link">
            Browse other books and essays ↗
          </Link>
        </div>
      </article>
    </main>
  )
}
