import type { Metadata } from 'next'
import Link from 'next/link'

import ReceiptBatch from './ReceiptBatch'
import ReceiptDemo from './ReceiptDemo'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'Receipt → CSV | Maha Strategies',
  description: 'Paste a messy receipt, get clean accounting-ready CSV instantly. Free single-receipt demo; batch runs available.',
  alternates: { canonical: '/utilities/receipts' },
}

export default function ReceiptsUtilityPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-white">← Maha Strategies</Link>
        <p className="mt-12 font-mono text-[10px] uppercase tracking-widest text-emerald-300">[ Micro-utility · receipt → CSV ]</p>
        <h1 className="mt-5 text-4xl font-light leading-tight tracking-tight text-white sm:text-6xl">Messy receipt in. Clean CSV out.</h1>
        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-zinc-400">
          Paste a receipt — the AI extracts line items, quantities, amounts, tax, and totals into an
          accounting-ready spreadsheet. Try one free, right here, no signup. If your text isn&apos;t a
          parseable receipt, it says so <em>before</em> you&apos;d ever pay for a batch.
        </p>

        <ReceiptDemo />

        <section className="mt-16 border-t border-zinc-800 pt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">[ Batch run ]</p>
          <h2 className="mt-4 text-2xl font-light tracking-tight text-white sm:text-3xl">Have a stack of them? Run a batch.</h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400">
            The free demo above is your pre-flight check. When it parses cleanly, batch up to {20} receipts into one
            CSV — <strong className="text-zinc-300">upload photos or paste text, or mix both</strong>. Pay once, no
            account, no login. Unparseable receipts are dropped, and a run where nothing parses is refunded automatically.
          </p>
          <ReceiptBatch />
        </section>

        <section className="mt-16 border-t border-zinc-800 pt-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">How it stays honest</p>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-zinc-400">
            <li>· Your receipt text is sent to the model and returned — never stored on our side.</li>
            <li>· Every run reports a confidence score; low-confidence or non-receipt input is flagged, not silently mangled.</li>
            <li>· The free single-receipt demo is the pre-flight check for paid batches: if the demo can&apos;t parse it, a batch won&apos;t either — so you never pay for a failed run.</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
