'use client'

import { FormEvent, useEffect, useState } from 'react'
import Script from 'next/script'
import { trackConversion } from '@/components/ConversionTracker'

declare global { interface Window { mahaPlannerTurnstileComplete?: (token: string) => void; mahaPlannerTurnstileExpired?: () => void } }

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const MAX_ATTACHMENT_CHARS = 4_600

export default function PlannerInquiryForm({ recordJson }: { recordJson: string }) {
  const [open, setOpen] = useState(false)
  const [consented, setConsented] = useState(false)
  const [service, setService] = useState<'rapid-intelligence-brief' | 'verified-research-brief'>('rapid-intelligence-brief')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [state, setState] = useState({ pending: false, success: false, error: '' })
  const recordFits = recordJson.length <= MAX_ATTACHMENT_CHARS

  useEffect(() => {
    window.mahaPlannerTurnstileComplete = (token) => setTurnstileToken(token)
    window.mahaPlannerTurnstileExpired = () => setTurnstileToken('')
    return () => { delete window.mahaPlannerTurnstileComplete; delete window.mahaPlannerTurnstileExpired }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!consented || !recordFits) return
    setState({ pending: true, success: false, error: '' })
    const form = new FormData(event.currentTarget)
    const body = { idempotencyKey: `planner-inquiry:${crypto.randomUUID()}`, offerId: service, requester: { name: form.get('name'), email: form.get('email'), organization: form.get('organization') }, decision: form.get('decision'), question: form.get('question'), deadline: form.get('deadline') || undefined, context: `The requester explicitly opted in to attach this browser-generated AI Boundary Planner record for human scope review.\n\n${recordJson}`, requesterAuthorized: true, referralSource: 'direct', sourcePath: '/contact', turnstileToken: turnstileToken || undefined }
    try {
      const response = await fetch('/api/inbound-submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json() as { error?: { message?: string } }
      if (!response.ok) throw new Error(result.error?.message ?? 'Your inquiry could not be sent.')
      trackConversion('contact_form_success')
      setState({ pending: false, success: true, error: '' })
    } catch (error) { setState({ pending: false, success: false, error: error instanceof Error ? error.message : 'Your inquiry could not be sent.' }) }
  }

  return <section className="planner-inquiry mt-8 border border-indigo-900/60 bg-indigo-950/20 p-7 sm:p-9" aria-labelledby="planner-inquiry-heading"><p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Optional human review ]</p><h2 id="planner-inquiry-heading" className="mt-3 text-2xl text-white">Attach this decision record to an inquiry—only if you choose.</h2><p className="mt-3 max-w-3xl leading-relaxed text-zinc-400">The planner does not retain your entries. Opening this form still sends nothing. If you check the consent box and submit, the current JSON record and your inquiry details are transmitted to Maha Strategies&apos; inquiry ledger for human scope review.</p>{!open ? <button type="button" onClick={() => setOpen(true)} className="mt-6 border border-indigo-400 px-5 py-3 font-mono text-xs uppercase tracking-widest text-indigo-100 hover:bg-indigo-400 hover:text-black">Prepare optional inquiry →</button> : state.success ? <div className="mt-6 border border-emerald-800 bg-emerald-950/20 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-200">Inquiry received</p><p className="mt-2 text-sm leading-relaxed text-emerald-100">The record was attached because you explicitly consented. Maha Strategies will review the request and respond about scope; this is not an engagement or purchase commitment.</p></div> : <form onSubmit={submit} className="mt-7 space-y-5 border-t border-indigo-900/60 pt-7"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-zinc-300">Your name<input name="name" required disabled={state.pending} className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-indigo-400" /></label><label className="text-sm text-zinc-300">Work email<input name="email" type="email" required disabled={state.pending} className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-indigo-400" /></label></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-zinc-300">Organization or project<input name="organization" required disabled={state.pending} className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-indigo-400" /></label><label className="text-sm text-zinc-300">Inquiry type<select value={service} onChange={(event) => setService(event.target.value as typeof service)} disabled={state.pending} className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-indigo-400"><option value="rapid-intelligence-brief">Rapid Intelligence Brief</option><option value="verified-research-brief">Verified Research Brief</option></select></label></div><label className="block text-sm text-zinc-300">Decision to inform<input name="decision" required minLength={12} disabled={state.pending} placeholder="The implementation or investment decision this informs" className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-indigo-400" /></label><label className="block text-sm text-zinc-300">Question for human review<textarea name="question" required minLength={20} rows={4} disabled={state.pending} placeholder="What do you need investigated or decided beyond this planning record?" className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm leading-relaxed text-white outline-none focus:border-indigo-400" /></label><label className="block text-sm text-zinc-300">Decision deadline <span className="text-zinc-500">(optional)</span><input name="deadline" disabled={state.pending} placeholder="e.g. 15 August 2026" className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-indigo-400" /></label><div className={`border p-4 text-sm leading-relaxed ${recordFits ? 'border-zinc-800 bg-black/30 text-zinc-400' : 'border-amber-800 bg-amber-950/20 text-amber-100'}`}><p className="font-mono text-[10px] uppercase tracking-widest">Attachment preview · {recordJson.length.toLocaleString()} characters</p><p className="mt-2">{recordFits ? 'The current JSON record is within the inquiry attachment limit. It will only be sent if you consent below and submit this form.' : 'This record is too large for the secure inquiry attachment limit. Download it instead, reduce notes or assumptions, then retry.'}</p></div><label className="flex gap-3 border border-indigo-900/60 bg-black/20 p-4 text-sm leading-relaxed text-zinc-300"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} disabled={state.pending || !recordFits} className="mt-1 h-4 w-4 accent-indigo-400" /><span>I authorize Maha Strategies to receive and retain the current AI Boundary Planner JSON record with this inquiry for human scope review. I understand it is not sent unless I submit this form, and that an inquiry is not a purchase or engagement commitment.</span></label>{TURNSTILE_SITE_KEY && <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" /><div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-action="contact_inquiry" data-callback="mahaPlannerTurnstileComplete" data-expired-callback="mahaPlannerTurnstileExpired" /></>}{state.error && <p className="text-sm text-red-300">{state.error}</p>}<button type="submit" disabled={state.pending || !consented || !recordFits} className="bg-indigo-300 px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-black hover:bg-indigo-200 disabled:cursor-not-allowed disabled:opacity-40">{state.pending ? 'Sending inquiry…' : 'Send opted-in inquiry →'}</button></form>}</section>
}
