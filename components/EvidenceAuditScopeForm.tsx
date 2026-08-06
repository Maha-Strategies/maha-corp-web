'use client'

import { FormEvent, useEffect, useState } from 'react'
import Script from 'next/script'

import { trackConversion } from '@/components/ConversionTracker'

declare global {
  interface Window {
    mahaEvidenceAuditTurnstileComplete?: (token: string) => void
    mahaEvidenceAuditTurnstileExpired?: () => void
  }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export default function EvidenceAuditScopeForm() {
  const [turnstileToken, setTurnstileToken] = useState('')
  const [state, setState] = useState({ pending: false, success: false, error: '' })

  useEffect(() => {
    window.mahaEvidenceAuditTurnstileComplete = (token) => setTurnstileToken(token)
    window.mahaEvidenceAuditTurnstileExpired = () => setTurnstileToken('')
    return () => {
      delete window.mahaEvidenceAuditTurnstileComplete
      delete window.mahaEvidenceAuditTurnstileExpired
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState({ pending: true, success: false, error: '' })
    const form = new FormData(event.currentTarget)
    const body = {
      idempotencyKey: `evidence-audit-scope:${crypto.randomUUID()}`,
      offerId: 'mps-evidence-audit',
      requester: {
        name: form.get('name'),
        email: form.get('email'),
        organization: form.get('organization'),
      },
      decision: form.get('decision'),
      question: form.get('question'),
      deadline: form.get('deadline') || undefined,
      requesterAuthorized: true,
      website: form.get('website_trap') || undefined,
      referralSource: 'direct',
      sourcePath: '/evidence-audit',
      turnstileToken: turnstileToken || undefined,
    }

    try {
      const response = await fetch('/api/inbound-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json() as { error?: { message?: string } }
      if (!response.ok) throw new Error(result.error?.message ?? 'Your audit request could not be sent.')
      trackConversion('contact_form_success')
      setState({ pending: false, success: true, error: '' })
    } catch (error) {
      setState({ pending: false, success: false, error: error instanceof Error ? error.message : 'Your audit request could not be sent.' })
    }
  }

  if (state.success) {
    return <section id="scope-an-audit" className="scroll-mt-8 border border-emerald-800 bg-emerald-950/20 p-8 sm:p-10" aria-labelledby="scope-an-audit-heading">
      <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-200">[ Audit request received ]</p>
      <h2 id="scope-an-audit-heading" className="mt-3 text-2xl font-light text-white">We will review the scope and reply within two business days.</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-100">An inquiry is not an engagement or a commitment to buy. Scope, price, timing, and source constraints are confirmed by a human before work begins.</p>
    </section>
  }

  return <section id="scope-an-audit" className="scroll-mt-8 border border-indigo-900/60 bg-indigo-950/20 p-8 sm:p-10" aria-labelledby="scope-an-audit-heading">
    <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Scope an audit ]</p>
    <h2 id="scope-an-audit-heading" className="mt-3 text-2xl font-light text-white">Bring the question, decision, and deadline.</h2>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">We reply within two business days with a proposed scope—or say plainly if this is not the right fit. Do not send confidential source material in this form.</p>
    <form onSubmit={submit} className="mt-8 space-y-5 border-t border-indigo-900/60 pt-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-zinc-300">Your name<input name="name" required disabled={state.pending} autoComplete="name" className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-indigo-400" /></label>
        <label className="text-sm text-zinc-300">Work email<input name="email" type="email" required disabled={state.pending} autoComplete="email" className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-indigo-400" /></label>
      </div>
      <label className="block text-sm text-zinc-300">Organization or project<input name="organization" required disabled={state.pending} autoComplete="organization" placeholder="Company, publication, or project" className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-indigo-400" /></label>
      <label className="block text-sm text-zinc-300">Question for the audit<textarea name="question" required minLength={20} rows={4} disabled={state.pending} placeholder="What claims, sources, or publication-risk questions need review?" className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm leading-relaxed text-white outline-none focus:border-indigo-400" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-zinc-300">Decision this informs<input name="decision" required minLength={12} disabled={state.pending} placeholder="The publication, governance, or strategy decision" className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-indigo-400" /></label>
        <label className="text-sm text-zinc-300">Decision deadline <span className="text-zinc-500">(optional)</span><input name="deadline" disabled={state.pending} placeholder="e.g. 15 August 2026" className="mt-2 w-full border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-indigo-400" /></label>
      </div>
      <div className="hidden" aria-hidden="true"><label htmlFor="evidence-audit-website-trap">Leave this blank</label><input id="evidence-audit-website-trap" name="website_trap" tabIndex={-1} autoComplete="off" /></div>
      {TURNSTILE_SITE_KEY && <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" /><div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-action="contact_inquiry" data-callback="mahaEvidenceAuditTurnstileComplete" data-expired-callback="mahaEvidenceAuditTurnstileExpired" /></>}
      {state.error && <p className="text-sm text-red-300" role="alert">{state.error}</p>}
      <div><button type="submit" disabled={state.pending} className="bg-indigo-300 px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-black hover:bg-indigo-200 disabled:cursor-not-allowed disabled:opacity-40">{state.pending ? 'Sending audit request…' : 'Request audit scope →'}</button></div>
      <p className="text-xs leading-relaxed text-zinc-500">Submitting sends your inquiry to Maha Strategies for human scope review. It is not a purchase or engagement commitment.</p>
    </form>
  </section>
}
