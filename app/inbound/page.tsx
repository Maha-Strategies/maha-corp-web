'use client'

import { FormEvent, useState } from 'react'
import { postPublicForm } from '@/lib/public-form-client'

const initial = { name: '', email: '', organization: '', offerId: 'rapid-intelligence-brief', decision: '', question: '', deadline: '', website: '' }

export default function InboundPage() {
  const [form, setForm] = useState(initial)
  const [message, setMessage] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const update = (key: keyof typeof initial, value: string) => setForm((current) => ({ ...current, [key]: value }))
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSending(true); setMessage(null)
    try {
      const body = await postPublicForm<{ nextStep?: string }>('/forms/contact', {
        idempotencyKey: crypto.randomUUID(), offerId: form.offerId, requester: { name: form.name, email: form.email, organization: form.organization || undefined },
        decision: form.decision, question: form.question, deadline: form.deadline || undefined, website: form.website, requesterAuthorized: true,
      })
      setMessage(body.nextStep ?? 'Your submission is queued for review.'); setForm(initial)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Submission could not be sent.') }
    finally { setSending(false) }
  }
  return <main className="evidence-page px-6 py-16 text-[var(--text-secondary)] sm:px-12">
    <div className="mx-auto max-w-2xl">
      <p className="mb-8 font-mono text-xs tracking-widest text-[var(--status-sourced)]">[ INBOUND GATEKEEPER // NON-BINDING ]</p>
      <h1 className="mb-4 font-sans text-4xl font-semibold text-[var(--text-primary)]">Submit a decision-critical opportunity.</h1>
      <p className="mb-10 font-sans leading-relaxed text-[var(--text-secondary)]">Maha evaluates defined questions, decisions, and research needs. Do not send confidential, regulated, or sensitive personal information. A submission never creates a scope, price, contract, or payment obligation.</p>
      <form onSubmit={submit} className="space-y-5 border border-[var(--border-default)] bg-[var(--surface-raised)]/30 p-6 font-sans">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" value={form.name} onChange={(value) => update('name', value)} required />
          <Field label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} required />
        </div>
        <Field label="Organization" value={form.organization} onChange={(value) => update('organization', value)} required />
        <label className="block text-sm text-[var(--text-secondary)]">Offer<select value={form.offerId} onChange={(event) => update('offerId', event.target.value)} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3 text-[var(--text-primary)]"><option value="rapid-intelligence-brief">Rapid Intelligence Brief</option><option value="verified-research-brief">Verified Research Brief</option><option value="mps-preflight">MPS Preflight</option><option value="mps-prepaid-audit-access">MPS Audit Access</option></select></label>
        <Field label="Decision this should inform" value={form.decision} onChange={(value) => update('decision', value)} required />
        <label className="block text-sm text-[var(--text-secondary)]">Question<textarea value={form.question} onChange={(event) => update('question', event.target.value)} required minLength={20} rows={6} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3 text-[var(--text-primary)]" /></label>
        <Field label="Deadline (optional)" value={form.deadline} onChange={(value) => update('deadline', value)} />
        <div className="hidden" aria-hidden="true"><Field label="Website" value={form.website} onChange={(value) => update('website', value)} /></div>
        {message && <p className="border border-indigo-800 bg-indigo-950/30 p-3 text-sm text-[var(--status-sourced)]">{message}</p>}
        <button disabled={sending} className="w-full bg-indigo-600 px-5 py-3 font-mono text-xs font-semibold tracking-widest text-[var(--text-primary)] disabled:opacity-50">{sending ? 'SUBMITTING…' : 'SUBMIT FOR REVIEW'}</button>
      </form>
    </div>
  </main>
}

function Field({ label, value, onChange, required, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <label className="block text-sm text-[var(--text-secondary)]">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3 text-[var(--text-primary)]" /></label>
}
