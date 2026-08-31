'use client'

import { FormEvent, useEffect, useState } from 'react'
import Script from 'next/script'
import { trackConversion } from '@/components/ConversionTracker'
import { postPublicForm } from '@/lib/public-form-client'

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
      await postPublicForm('/forms/contact', body)
      trackConversion('contact_form_success')
      setState({ pending: false, success: true, error: '' })
    } catch (error) { setState({ pending: false, success: false, error: error instanceof Error ? error.message : 'Your inquiry could not be sent.' }) }
  }

  return <section className="planner-inquiry mt-8 border border-[var(--status-sourced)] bg-[var(--surface-raised)] p-7 sm:p-9" aria-labelledby="planner-inquiry-heading"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ Optional human review ]</p><h2 id="planner-inquiry-heading" className="mt-3 text-2xl text-[var(--text-primary)]">Attach this decision record to an inquiry—only if you choose.</h2><p className="mt-3 max-w-3xl leading-relaxed text-[var(--text-secondary)]">The planner does not retain your entries. Opening this form still sends nothing. If you check the consent box and submit, the current JSON record and your inquiry details are transmitted to Maha Strategies&apos; inquiry ledger for human scope review.</p>{!open ? <button type="button" onClick={() => setOpen(true)} className="evidence-action evidence-action--secondary mt-6">Prepare optional inquiry →</button> : state.success ? <div className="mt-6 border border-[var(--status-verified)] bg-[var(--surface-raised)] p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-verified)]">Inquiry received</p><p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">The record was attached because you explicitly consented. Maha Strategies will review the request and respond about scope; this is not an engagement or purchase commitment.</p></div> : <form onSubmit={submit} className="mt-7 space-y-5 border-t border-[var(--status-sourced)] pt-7"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-[var(--text-secondary)]">Your name<input name="name" required disabled={state.pending} className="evidence-input mt-2" /></label><label className="text-sm text-[var(--text-secondary)]">Work email<input name="email" type="email" required disabled={state.pending} className="evidence-input mt-2" /></label></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-[var(--text-secondary)]">Organization or project<input name="organization" required disabled={state.pending} className="evidence-input mt-2" /></label><label className="text-sm text-[var(--text-secondary)]">Inquiry type<select value={service} onChange={(event) => setService(event.target.value as typeof service)} disabled={state.pending} className="evidence-input mt-2"><option value="rapid-intelligence-brief">Rapid Intelligence Brief</option><option value="verified-research-brief">Verified Research Brief</option></select></label></div><label className="block text-sm text-[var(--text-secondary)]">Decision to inform<input name="decision" required minLength={12} disabled={state.pending} placeholder="The implementation or investment decision this informs" className="evidence-input mt-2" /></label><label className="block text-sm text-[var(--text-secondary)]">Question for human review<textarea name="question" required minLength={20} rows={4} disabled={state.pending} placeholder="What do you need investigated or decided beyond this planning record?" className="evidence-input mt-2" /></label><label className="block text-sm text-[var(--text-secondary)]">Decision deadline <span className="text-[var(--text-muted)]">(optional)</span><input name="deadline" disabled={state.pending} placeholder="e.g. 15 August 2026" className="evidence-input mt-2" /></label><div className={`border p-4 text-sm leading-relaxed ${recordFits ? 'border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)]' : 'border-[var(--status-boundary)] bg-[var(--surface-raised)] text-[var(--status-boundary)]'}`}><p className="font-mono text-[10px] uppercase tracking-widest">Attachment preview · {recordJson.length.toLocaleString()} characters</p><p className="mt-2">{recordFits ? 'The current JSON record is within the inquiry attachment limit. It will only be sent if you consent below and submit this form.' : 'This record is too large for the secure inquiry attachment limit. Download it instead, reduce notes or assumptions, then retry.'}</p></div><label className="flex gap-3 border border-[var(--status-sourced)] bg-[var(--surface-raised)]/20 p-4 text-sm leading-relaxed text-[var(--text-secondary)]"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} disabled={state.pending || !recordFits} className="mt-1 h-4 w-4 accent-[var(--status-sourced)]" /><span>I authorize Maha Strategies to receive and retain the current AI Boundary Planner JSON record with this inquiry for human scope review. I understand it is not sent unless I submit this form, and that an inquiry is not a purchase or engagement commitment.</span></label>{TURNSTILE_SITE_KEY && <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" /><div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-action="contact_inquiry" data-callback="mahaPlannerTurnstileComplete" data-expired-callback="mahaPlannerTurnstileExpired" /></>}{state.error && <p className="text-sm text-[var(--text-secondary)]">{state.error}</p>}<button type="submit" disabled={state.pending || !consented || !recordFits} className="evidence-action evidence-action--primary">{state.pending ? 'Sending inquiry…' : 'Send opted-in inquiry →'}</button></form>}</section>
}
