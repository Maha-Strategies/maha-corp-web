"use client"

import React, { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'

import { trackConversion } from '@/components/ConversionTracker'
import EngagementPath from '@/components/EngagementPath'
import { postPublicForm } from '@/lib/public-form-client'

declare global {
  interface Window {
    mahaTurnstileComplete?: (token: string) => void
    mahaTurnstileExpired?: () => void
  }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

const OFFER_BY_SERVICE = {
  verified_research: 'verified-research-brief',
  rapid_intelligence: 'rapid-intelligence-brief',
  mps_evidence_audit: 'mps-evidence-audit',
  mps_audit: 'mps-evidence-audit',
  token_request: 'mps-preflight',
  support: 'mps-preflight',
  general: 'rapid-intelligence-brief',
} as const

type ServiceCode = keyof typeof OFFER_BY_SERVICE

const SERVICE_OPTIONS: Array<{ value: ServiceCode; label: string }> = [
  { value: 'verified_research', label: 'Verified Research Brief — $2,500 / 10 business days' },
  { value: 'rapid_intelligence', label: 'Rapid Intelligence Brief — from $500 / five business days' },
  { value: 'mps_evidence_audit', label: 'MPS Evidence Audit — high-stakes document review' },
  { value: 'mps_audit', label: 'MPS Evidence Audit — manuscript or report' },
  { value: 'token_request', label: 'Cognitive Gateway Access Token Request' },
  { value: 'support', label: 'Technical Support / Troubleshooting' },
  { value: 'general', label: 'General Inquiry' },
]

function selectedServiceFromLocation(): ServiceCode {
  if (typeof window === 'undefined') return 'verified_research'

  const service = new URLSearchParams(window.location.search).get('service')
  return service && service in OFFER_BY_SERVICE ? (service as ServiceCode) : 'verified_research'
}

export default function ContactPage() {
  const [state, setState] = useState({ success: false, error: null as string | null })
  const [isPending, setIsPending] = useState(false)
  const [selectedService, setSelectedService] = useState<ServiceCode>(selectedServiceFromLocation)
  const [turnstileToken, setTurnstileToken] = useState('')

  useEffect(() => {
    if (state.success) trackConversion('contact_form_success')
  }, [state.success])

  useEffect(() => {
    window.mahaTurnstileComplete = (token) => setTurnstileToken(token)
    window.mahaTurnstileExpired = () => setTurnstileToken('')

    return () => {
      delete window.mahaTurnstileComplete
      delete window.mahaTurnstileExpired
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsPending(true)
    setState({ success: false, error: null })

    const form = new FormData(event.currentTarget)
    const query = new URLSearchParams(window.location.search)
    const body = {
      idempotencyKey: `contact:${crypto.randomUUID()}`,
      offerId: OFFER_BY_SERVICE[selectedService],
      requester: {
        name: form.get('name'),
        email: form.get('email'),
        organization: form.get('organization') || undefined,
      },
      decision: form.get('decision'),
      question: form.get('message'),
      deadline: form.get('deadline') || undefined,
      context: form.get('website') ? `Company or project URL: ${form.get('website')}` : undefined,
      requesterAuthorized: true,
      website: form.get('website_trap') || undefined,
      referralSource: form.get('referralSource'),
      referralDetail: form.get('referralDetail') || undefined,
      sourcePath: '/contact',
      utmSource: query.get('utm_source') || undefined,
      utmMedium: query.get('utm_medium') || undefined,
      utmCampaign: query.get('utm_campaign') || undefined,
      turnstileToken: turnstileToken || undefined,
    }

    try {
      await postPublicForm('/forms/contact', body)
      setState({ success: true, error: null })
    } catch (error) {
      setState({ success: false, error: error instanceof Error ? error.message : 'Your inquiry could not be sent.' })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex justify-between items-start gap-3">
            <span>[ MAHA STRATEGIES // INQUIRY ]</span>
            <span className="text-[var(--status-verified)]">REPLY: WITHIN TWO BUSINESS DAYS</span>
          </p>
          <h1 className="evidence-title evidence-title--product mt-6">Start an inquiry</h1>
          <p className="evidence-lede mt-6">
            Select your objective first. For a Rapid Intelligence Brief or Verified Research Brief, we respond within two
            business days with a scope—or a clear reason this is not a fit.
          </p>
        </header>

        <section className="evidence-section" aria-label="Path and controls">
          <EngagementPath tone="paper" />
        </section>

        <section className="evidence-section" aria-label="Inquiry form">
          <p className="evidence-kicker">01 // Decision intake</p>
          <h2 className="evidence-section-title mt-4">Tell us what you need decided.</h2>
          {state.success ? (
            <div className="evidence-inset mt-7 border border-[var(--status-verified)] bg-[rgba(16,185,129,0.07)]">
              <p className="evidence-kicker text-[var(--status-verified)]">[ INQUIRY RECEIVED ]</p>
              <p className="evidence-copy mt-4">Your inquiry has been received. Maha Strategies will respond within two business days.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="evidence-card mt-8">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-xs evidence-card-copy uppercase">Your name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    disabled={isPending}
                    className="evidence-input w-full"
                    placeholder="Jane Doe"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="block text-xs evidence-card-copy uppercase">Work email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    disabled={isPending}
                    className="evidence-input w-full"
                    placeholder="jane@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="organization" className="block text-xs evidence-card-copy uppercase">Organization or project</label>
                  <input
                    type="text"
                    id="organization"
                    name="organization"
                    required
                    disabled={isPending}
                    className="evidence-input w-full"
                    placeholder="Company, publication, or project"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="subject" className="block text-xs evidence-card-copy uppercase">What can we help with?</label>
                  <select
                    id="subject"
                    name="subject"
                    value={selectedService}
                    onChange={(event) => setSelectedService(event.target.value as ServiceCode)}
                    disabled={isPending}
                    className="evidence-input w-full"
                  >
                    {SERVICE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="decision" className="block text-xs evidence-card-copy uppercase">Decision to inform</label>
                  <input
                    type="text"
                    id="decision"
                    name="decision"
                    required
                    disabled={isPending}
                    className="evidence-input w-full"
                    placeholder="An investment, vendor, or strategy decision"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="deadline" className="block text-xs evidence-card-copy uppercase">Decision deadline (optional)</label>
                  <input
                    type="text"
                    id="deadline"
                    name="deadline"
                    disabled={isPending}
                    className="evidence-input w-full"
                    placeholder="e.g. 15 August 2026"
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="website" className="block text-xs evidence-card-copy uppercase">Company or project URL (optional)</label>
                  <input
                    type="url"
                    id="website"
                    name="website"
                    disabled={isPending}
                    className="evidence-input w-full"
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="referralSource" className="block text-xs evidence-card-copy uppercase">How did you find Maha?</label>
                  <select
                    id="referralSource"
                    name="referralSource"
                    defaultValue="search"
                    disabled={isPending}
                    className="evidence-input w-full"
                  >
                    <option value="search">Search</option>
                    <option value="developer_directory">Developer directory</option>
                    <option value="referral">Referral</option>
                    <option value="social">Social media</option>
                    <option value="newsletter">Newsletter</option>
                    <option value="event">Event or community</option>
                    <option value="direct">Direct visit</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label htmlFor="referralDetail" className="block text-xs evidence-card-copy uppercase">Referral detail (optional)</label>
                <input
                  type="text"
                  id="referralDetail"
                  name="referralDetail"
                  disabled={isPending}
                  className="evidence-input w-full"
                  placeholder="e.g. Google, Glama, a colleague, or publication"
                />
              </div>

              <div className="mt-6 space-y-2">
                <label htmlFor="message" className="block text-xs evidence-card-copy uppercase">Your question</label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  required
                  disabled={isPending}
                  className="evidence-input w-full resize-y"
                  placeholder="What question do you need answered, and what would change if the answer were different?"
                />
              </div>

              <div className="hidden" aria-hidden="true">
                <label htmlFor="website_trap">Leave this blank</label>
                <input id="website_trap" name="website_trap" tabIndex={-1} autoComplete="off" />
              </div>

              {TURNSTILE_SITE_KEY && (
                <>
                  <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
                  <div
                    className="cf-turnstile mt-6"
                    data-sitekey={TURNSTILE_SITE_KEY}
                    data-action="contact_inquiry"
                    data-callback="mahaTurnstileComplete"
                    data-expired-callback="mahaTurnstileExpired"
                  />
                </>
              )}

              {state.error && <p className="evidence-kicker mt-6 text-[var(--status-unverified)]">[ ERROR: {state.error} ]</p>}

              <button
                type="submit"
                disabled={isPending}
                className="evidence-action evidence-action--primary mt-8 w-full disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
              >
                {isPending ? 'Sending...' : 'Send inquiry →'}
              </button>
            </form>
          )}
        </section>

        <section className="evidence-section" aria-label="Direct contact options">
          <p className="evidence-kicker">02 // Direct contact</p>
          <h2 className="evidence-section-title mt-4">Contact without the form</h2>
          <p className="evidence-copy mt-5">
            Email <a href="mailto:mayone@mahastrategies.com" className="evidence-link">mayone@mahastrategies.com</a> or call{' '}
            <a href="tel:+13322138380" className="evidence-link">+1 332 213 8380</a>. Founder site:{' '}
            <a href="https://www.mayonemaharajan.com" className="evidence-link" rel="noopener noreferrer">www.mayonemaharajan.com</a>.
          </p>
        </section>

        <section className="evidence-section" aria-label="Business details">
          <p className="evidence-kicker">03 // Business details</p>
          <h2 className="evidence-section-title mt-4">Entity information</h2>
          <div className="mt-6 grid gap-4 text-sm">
            <p className="evidence-copy">
              <span className="evidence-kicker">Entity</span>
              <span className="block mt-2 text-[var(--text-primary)]">Maha Strategies LLC</span>
            </p>
            <p className="evidence-copy">
              <span className="evidence-kicker">Address</span>
              <span className="block mt-2 text-[var(--text-secondary)]">
                1021 E Lincolnway, Unit #1533<br />
                Cheyenne, WY 82001<br />
                United States
              </span>
            </p>
            <p className="evidence-copy">
              <span className="evidence-kicker">Reference documents</span>
              <span className="mt-2 block">
                <Link href="/about" className="evidence-link">About the firm ↗</Link>
              </span>
            </p>
          </div>
        </section>

        <footer className="evidence-section">
          <div className="evidence-inset flex flex-wrap gap-4">
            <Link href="/" className="evidence-link">[ Home ↗ ]</Link>
            <Link href="/mps" className="evidence-link">[ MPS overview ↗ ]</Link>
            <Link href="/research/mcp" className="evidence-link">[ API documentation ↗ ]</Link>
          </div>
        </footer>
      </div>
    </main>
  )
}
