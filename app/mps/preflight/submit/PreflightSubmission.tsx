'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'

export default function PreflightSubmission() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId') ?? ''
  const access = searchParams.get('access') ?? ''
  const [text, setText] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'idle' | 'running'>('idle')
  const [paymentState, setPaymentState] = useState<'checking' | 'waiting' | 'ready' | 'invalid'>('checking')

  useEffect(() => {
    if (!orderId || !access) return
    let active = true
    let attempts = 0
    const checkPayment = async () => {
      try {
        const response = await fetch(`/api/mps-preflight/${encodeURIComponent(orderId)}?access=${encodeURIComponent(access)}`, { cache: 'no-store' })
        const data = await response.json() as { status?: string }
        if (!active) return
        if (!response.ok) { setPaymentState('invalid'); return }
        if (data.status === 'paid') { setPaymentState('ready'); return }
        if (data.status === 'completed') { window.location.assign(`/mps/preflight/report?orderId=${encodeURIComponent(orderId)}&access=${encodeURIComponent(access)}`); return }
        setPaymentState('waiting')
        attempts += 1
        if (attempts < 12) window.setTimeout(checkPayment, 2_000)
      } catch {
        if (active) setPaymentState('waiting')
      }
    }
    void checkPayment()
    return () => { active = false }
  }, [access, orderId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!orderId || !access || paymentState !== 'ready') { setError('We are still confirming payment. Please wait a few seconds and try again.'); return }
    setStatus('running')
    try {
      const response = await fetch('/api/mps-preflight/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, access, text, documentLabel: label }),
      })
      const data = await response.json() as { reportUrl?: string; error?: string }
      if (!response.ok || !data.reportUrl) throw new Error(data.error ?? 'The preflight did not complete.')
      window.location.assign(data.reportUrl)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'The preflight did not complete.')
      setStatus('idle')
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <Link href="/mps/preflight" className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-white">← MPS Preflight</Link>
        <p className="mt-10 font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Paid private session ]</p>
        <h1 className="mt-5 text-4xl font-light tracking-tight text-white sm:text-5xl">Paste the document extract.</h1>
        <p className="mt-5 max-w-2xl leading-relaxed text-zinc-400">Your report will appear on a private link and be sent to the email used at checkout. The full text is used to generate the report, then discarded; the durable ledger retains only its hash and the resulting claim excerpts.</p>
        {paymentState !== 'ready' && <p className="mt-5 border border-indigo-900 bg-indigo-950/30 p-4 text-sm text-indigo-100">{paymentState === 'invalid' || !orderId || !access ? 'This private purchase link is invalid. Return to your Stripe confirmation email or contact us.' : 'Confirming secure payment. This normally takes a few seconds…'}</p>}
        <form onSubmit={submit} className="mt-10 border border-zinc-700 bg-zinc-950 p-5 sm:p-7">
          <label className="grid gap-2 text-sm text-zinc-300">Document label <span className="text-zinc-500">(only for your report)</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} className="border border-zinc-600 bg-black px-3 py-3 text-white outline-none focus:border-indigo-400" placeholder="Optional title" />
          </label>
          <label className="mt-5 grid gap-2 text-sm text-zinc-300">Document text
            <textarea required value={text} onChange={(event) => setText(event.target.value)} maxLength={12000} className="min-h-80 border border-zinc-600 bg-black px-3 py-3 leading-relaxed text-white outline-none focus:border-indigo-400" placeholder="Paste up to about 2,000 words…" />
          </label>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">{text.length.toLocaleString()} / 12,000 characters</p>
          {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
          <button disabled={status === 'running' || paymentState !== 'ready'} className="mt-6 w-full bg-white px-5 py-4 font-mono text-xs font-bold uppercase tracking-widest text-black hover:bg-zinc-200 disabled:cursor-wait disabled:bg-zinc-500">{status === 'running' ? 'Mapping claims…' : paymentState !== 'ready' ? 'Confirming payment…' : 'Run MPS Preflight'}</button>
        </form>
      </div>
    </main>
  )
}
