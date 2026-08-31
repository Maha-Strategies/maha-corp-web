'use client'

import { FormEvent, useRef, useState } from 'react'

import { trackConversion } from '@/components/ConversionTracker'
import TurnstileField, { type TurnstileFieldHandle } from '@/components/TurnstileField'
import { postPublicForm } from '@/lib/public-form-client'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export default function EvidenceAuditScopeForm() {
  const [turnstileToken, setTurnstileToken] = useState('')
  const [state, setState] = useState({ pending: false, success: false, error: '' })
  const turnstileRef = useRef<TurnstileFieldHandle>(null)

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
      await postPublicForm('/forms/contact', body)
      trackConversion('contact_form_success')
      setState({ pending: false, success: true, error: '' })
    } catch (error) {
      setState({ pending: false, success: false, error: error instanceof Error ? error.message : 'Your audit request could not be sent.' })
    } finally {
      turnstileRef.current?.reset()
    }
  }

  if (state.success) {
    return <section id="scope-an-audit" className="scroll-mt-8 border border-[var(--status-verified)] bg-[var(--surface-raised)] p-8 sm:p-10" aria-labelledby="scope-an-audit-heading">
      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-verified)]">[ Audit request received ]</p>
      <h2 id="scope-an-audit-heading" className="mt-3 text-2xl font-light text-[var(--text-primary)]">We will review the scope and reply within two business days.</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">An inquiry is not an engagement or a commitment to buy. Scope, price, timing, and source constraints are confirmed by a human before work begins.</p>
    </section>
  }

  return <section id="scope-an-audit" className="scroll-mt-8 border border-[var(--border-default)] bg-[var(--surface-raised)] p-8 sm:p-10" aria-labelledby="scope-an-audit-heading">
    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Scope an audit ]</p>
    <h2 id="scope-an-audit-heading" className="mt-3 text-2xl font-light text-[var(--text-primary)]">Bring the question, decision, and deadline.</h2>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">We reply within two business days with a proposed scope—or say plainly if this is not the right fit. Do not send confidential source material in this form.</p>
    <form onSubmit={submit} className="mt-8 space-y-5 border-t border-[var(--border-default)] pt-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-[var(--text-secondary)]">Your name<input name="name" required disabled={state.pending} autoComplete="name" className="evidence-input mt-2 w-full" /></label>
        <label className="text-sm text-[var(--text-secondary)]">Work email<input name="email" type="email" required disabled={state.pending} autoComplete="email" className="evidence-input mt-2 w-full" /></label>
      </div>
      <label className="block text-sm text-[var(--text-secondary)]">Organization or project<input name="organization" required disabled={state.pending} autoComplete="organization" placeholder="Company, publication, or project" className="evidence-input mt-2 w-full" /></label>
      <label className="block text-sm text-[var(--text-secondary)]">Question for the audit<textarea name="question" required minLength={20} rows={4} disabled={state.pending} placeholder="What claims, sources, or publication-risk questions need review?" className="evidence-input mt-2 w-full" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-[var(--text-secondary)]">Decision this informs<input name="decision" required minLength={12} disabled={state.pending} placeholder="The publication, governance, or strategy decision" className="evidence-input mt-2 w-full" /></label>
        <label className="text-sm text-[var(--text-secondary)]">Decision deadline <span className="text-[var(--text-muted)]">(optional)</span><input name="deadline" disabled={state.pending} placeholder="e.g. 15 August 2026" className="evidence-input mt-2 w-full" /></label>
      </div>
      <div className="hidden" aria-hidden="true"><label htmlFor="evidence-audit-website-trap">Leave this blank</label><input id="evidence-audit-website-trap" name="website_trap" tabIndex={-1} autoComplete="off" /></div>
      {TURNSTILE_SITE_KEY && <TurnstileField ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} action="contact_inquiry" onTokenChange={setTurnstileToken} />}
      {state.error && <p className="text-sm text-[var(--status-unverified)]" role="alert">{state.error}</p>}
      <div><button type="submit" disabled={state.pending || Boolean(TURNSTILE_SITE_KEY && !turnstileToken)} className="evidence-action evidence-action--primary">{state.pending ? 'Sending audit request…' : 'Request audit scope →'}</button></div>
      <p className="text-xs leading-relaxed text-[var(--text-muted)]">Submitting sends your inquiry to Maha Strategies for human scope review. It is not a purchase or engagement commitment.</p>
    </form>
  </section>
}
