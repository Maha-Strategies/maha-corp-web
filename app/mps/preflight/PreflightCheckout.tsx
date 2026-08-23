'use client'

import { FormEvent, useState } from 'react'

export default function PreflightCheckout() {
  const [email, setEmail] = useState('')
  const [documentLabel, setDocumentLabel] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/mps-preflight/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, documentLabel }),
      })
      const data = await response.json() as { checkoutUrl?: string; error?: string }
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error ?? 'Checkout could not start.')
      window.location.assign(data.checkoutUrl)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Checkout could not start.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={checkout} className="evidence-form mt-10 max-w-xl">
      <p className="evidence-kicker">Begin a private preflight</p>
      <fieldset className="evidence-fieldset" disabled={loading}>
        <label className="evidence-field">
          <span className="evidence-field-label">Email for your private report</span>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby="preflight-checkout-note"
            className="evidence-input"
            placeholder="you@organization.com"
          />
        </label>
        <label className="evidence-field">
          <span className="evidence-field-label">
            Document label <span className="evidence-field-note">(optional)</span>
          </span>
          <input
            value={documentLabel}
            onChange={(event) => setDocumentLabel(event.target.value)}
            maxLength={120}
            className="evidence-input"
            placeholder="Board memo draft, chapter 3, policy note…"
          />
        </label>
      </fieldset>
      <p id="preflight-checkout-note" className="evidence-field-hint">
        Secure payment is handled by Stripe. After payment, you paste the document directly into a private session; the full source text is processed transiently and is not kept in the MPS ledger.
      </p>
      {error && <p role="alert" className="evidence-field-error">{error}</p>}
      <button disabled={loading} className="evidence-action evidence-action--primary w-full">
        {loading ? 'Opening secure checkout…' : 'Continue to secure checkout — $49'}
      </button>
    </form>
  )
}
