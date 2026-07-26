// app/contact/page.tsx
"use client";

import React, { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { trackConversion } from '@/components/ConversionTracker';
import EngagementPath from '@/components/EngagementPath';

declare global { interface Window { mahaTurnstileComplete?: (token: string) => void; mahaTurnstileExpired?: () => void } }

const OFFER_BY_SERVICE: Record<string, string> = {
  verified_research: 'verified-research-brief', rapid_intelligence: 'rapid-intelligence-brief',
  mps_evidence_audit: 'mps-prepaid-audit-access', mps_audit: 'mps-prepaid-audit-access',
  token_request: 'mps-preflight', support: 'mps-preflight', general: 'rapid-intelligence-brief',
};
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function ContactPage() {
  const [state, setState] = useState({ success: false, error: null as string | null });
  const [isPending, setIsPending] = useState(false);
  const [selectedService, setSelectedService] = useState('verified_research');
  const [turnstileToken, setTurnstileToken] = useState('');

  useEffect(() => {
    if (state.success) trackConversion('contact_form_success');
  }, [state.success]);

  useEffect(() => {
    window.mahaTurnstileComplete = (token) => setTurnstileToken(token);
    window.mahaTurnstileExpired = () => setTurnstileToken('');
    return () => { delete window.mahaTurnstileComplete; delete window.mahaTurnstileExpired; };
  }, []);

  useEffect(() => {
    const service = new URLSearchParams(window.location.search).get('service');
    const supportedServices = new Set([
      'rapid_intelligence',
      'verified_research',
      'mps_evidence_audit',
      'mps_audit',
      'token_request',
      'support',
      'general',
    ]);

    if (service && supportedServices.has(service)) setSelectedService(service);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true); setState({ success: false, error: null });
    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams(window.location.search);
    const body = {
      idempotencyKey: `contact:${crypto.randomUUID()}`,
      offerId: OFFER_BY_SERVICE[selectedService],
      requester: { name: form.get('name'), email: form.get('email'), organization: form.get('organization') || undefined },
      decision: form.get('decision'), question: form.get('message'), deadline: form.get('deadline') || undefined,
      context: form.get('website') ? `Company or project URL: ${form.get('website')}` : undefined,
      requesterAuthorized: true, website: form.get('website_trap') || undefined,
      referralSource: form.get('referralSource'), referralDetail: form.get('referralDetail') || undefined, sourcePath: '/contact',
      utmSource: query.get('utm_source') || undefined, utmMedium: query.get('utm_medium') || undefined, utmCampaign: query.get('utm_campaign') || undefined,
      turnstileToken: turnstileToken || undefined,
    };
    try {
      const response = await fetch('/api/inbound-submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? 'Your inquiry could not be sent.');
      setState({ success: true, error: null });
    } catch (error) { setState({ success: false, error: error instanceof Error ? error.message : 'Your inquiry could not be sent.' }); }
    finally { setIsPending(false); }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] py-16 px-6 sm:px-12 font-mono selection:bg-indigo-500 selection:text-white">
      <div className="max-w-3xl mx-auto">
        
        {/* TOP STATUS LINE */}
        <header className="text-xs text-gray-500 mb-12 border-b border-gray-800 pb-4 flex justify-between items-center">
          <span>[ MAHA STRATEGIES // INQUIRY ]</span>
          <span className="text-emerald-400">REPLY: WITHIN TWO BUSINESS DAYS</span>
        </header>

        <h1 className="font-sans text-2xl sm:text-4xl font-bold tracking-tight text-white uppercase mb-4">
          Start an inquiry
        </h1>

        <p className="text-sm text-gray-400 leading-relaxed mb-12 font-sans">
          Start with the decision you need to make. For a Rapid Intelligence Brief or Verified Research Brief, we reply within two business days with a scope—or tell you plainly if we are not the right fit.
        </p>

        <EngagementPath className="mb-12" />

        {/* CONTACT FORM SECTION */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-6">
            01 // Tell us what you need
          </h2>
          
          {state.success ? (
            <div className="bg-emerald-950/20 border border-emerald-900 p-8 text-center space-y-4">
               <p className="text-emerald-400 font-bold tracking-widest uppercase text-sm">
                 [ INQUIRY RECEIVED ]
               </p>
               <p className="font-sans text-zinc-400 text-sm">
                 Your inquiry has been received. Maha Strategies will respond within two business days.
               </p>
            </div>
          ) : (
            <form 
              onSubmit={submit}
              className="space-y-6 font-sans bg-black/30 border border-gray-900 p-6 sm:p-8"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* NAME */}
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-xs text-gray-400 uppercase tracking-widest font-mono">
                    Your name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    disabled={isPending}
                    className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                    placeholder="Jane Doe"
                  />
                </div>

                {/* EMAIL */}
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-xs text-gray-400 uppercase tracking-widest font-mono">
                    Work email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    disabled={isPending}
                    className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                    placeholder="jane@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="organization" className="block text-xs text-gray-400 uppercase tracking-widest font-mono">Organization or project</label>
                  <input type="text" id="organization" name="organization" required disabled={isPending} className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50" placeholder="Company, publication, or project" />
                </div>
              </div>

              {/* SUBJECT / INQUIRY TYPE */}
              <div className="space-y-2">
                <label htmlFor="subject" className="block text-xs text-gray-400 uppercase tracking-widest font-mono">
                  What can we help with?
                </label>
                <select
                  id="subject"
                  name="subject"
                  value={selectedService}
                  onChange={(event) => setSelectedService(event.target.value)}
                  disabled={isPending}
                  className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors appearance-none disabled:opacity-50"
                >
                  <option value="verified_research">Verified Research Brief — $2,500 / 10 business days</option>
                  <option value="rapid_intelligence">Rapid Intelligence Brief — from $500 / five business days</option>
                  <option value="mps_evidence_audit">MPS Evidence Audit — manuscript or high-stakes document review</option>
                  <option value="mps_audit">Manuscript Audit / MPS Inquiry</option>
                  <option value="token_request">Cognitive Gateway Access Token Request</option>
                  <option value="support">Technical Support / Troubleshooting</option>
                  <option value="general">General Inquiry</option>
                  
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="decision" className="block text-xs text-gray-400 uppercase tracking-widest font-mono">
                    Decision to inform
                  </label>
                  <input
                    type="text"
                    id="decision"
                    name="decision"
                    required
                    disabled={isPending}
                    className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                    placeholder="An investment, vendor, or strategy decision"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="deadline" className="block text-xs text-gray-400 uppercase tracking-widest font-mono">
                    Decision deadline (optional)
                  </label>
                  <input
                    type="text"
                    id="deadline"
                    name="deadline"
                    disabled={isPending}
                    className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                    placeholder="e.g. 15 August 2026"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2"><label htmlFor="website" className="block text-xs text-gray-400 uppercase tracking-widest font-mono">Company or project URL (optional)</label><input type="url" id="website" name="website" disabled={isPending} className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50" placeholder="https://example.com" /></div>
                <div className="space-y-2"><label htmlFor="referralSource" className="block text-xs text-gray-400 uppercase tracking-widest font-mono">How did you find Maha?</label><select id="referralSource" name="referralSource" defaultValue="search" disabled={isPending} className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm px-4 py-2.5"><option value="search">Search</option><option value="developer_directory">Developer directory</option><option value="referral">Referral</option><option value="social">Social media</option><option value="newsletter">Newsletter</option><option value="event">Event or community</option><option value="direct">Direct visit</option><option value="other">Other</option></select></div>
              </div>
              <div className="space-y-2"><label htmlFor="referralDetail" className="block text-xs text-gray-400 uppercase tracking-widest font-mono">Referral detail (optional)</label><input type="text" id="referralDetail" name="referralDetail" disabled={isPending} className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm px-4 py-2.5" placeholder="e.g. Google, Glama, a colleague, or publication" /></div>

              {/* MESSAGE */}
              <div className="space-y-2">
                <label htmlFor="message" className="block text-xs text-gray-400 uppercase tracking-widest font-mono">
                  Your question
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  required
                  disabled={isPending}
                  className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-y disabled:opacity-50"
                  placeholder="What question do you need answered, and what would change if the answer were different?"
                ></textarea>
              </div>

              <div className="hidden" aria-hidden="true"><label htmlFor="website_trap">Leave this blank</label><input id="website_trap" name="website_trap" tabIndex={-1} autoComplete="off" /></div>
              {TURNSTILE_SITE_KEY && <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" /><div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-action="contact_inquiry" data-callback="mahaTurnstileComplete" data-expired-callback="mahaTurnstileExpired" /></>}

              {/* ERROR STATE */}
              {state.error && (
                <p className="text-red-400 text-xs font-mono uppercase tracking-widest">
                  [ ERROR: {state.error} ]
                </p>
              )}

              {/* SUBMIT BUTTON */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs uppercase tracking-widest font-mono px-6 py-3 transition-colors flex items-center justify-center w-full sm:w-auto disabled:bg-indigo-900 disabled:cursor-not-allowed"
                >
                  {isPending ? "Sending..." : "Send inquiry \u2192"}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* PGP / ALTERNATIVE CONTACT */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            02 // Contact directly
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed font-sans mb-4">
            If you prefer not to use the form, email{' '}
            <a href="mailto:mayone@mahastrategies.com" className="text-indigo-400 hover:text-white underline">
              mayone@mahastrategies.com
            </a>{' '}or by phone at{' '}
            <a href="tel:+13322138380" className="text-indigo-400 hover:text-white underline">
              +1 332 213 8380
            </a>.
          </p>
        </section>

        {/* REGISTERED ENTITY / BUSINESS INFORMATION */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-6">
            03 // Business details
          </h2>
          <address className="not-italic font-sans text-sm text-gray-300 leading-relaxed space-y-4">
            <div>
              <p className="text-white font-semibold">Maha Strategies LLC</p>
              <p className="text-gray-400">
                1021 E Lincolnway, Unit #1533<br />
                Cheyenne, WY 82001<br />
                United States
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              <p>
                <span className="text-gray-500 text-xs uppercase tracking-widest font-mono block mb-1">Phone</span>
                <a href="tel:+13322138380" className="text-indigo-400 hover:text-white transition-colors">
                  +1 332 213 8380
                </a>
              </p>
              <p>
                <span className="text-gray-500 text-xs uppercase tracking-widest font-mono block mb-1">Email</span>
                <a href="mailto:mayone@mahastrategies.com" className="text-indigo-400 hover:text-white transition-colors">
                  mayone@mahastrategies.com
                </a>
              </p>
              <p>
                <span className="text-gray-500 text-xs uppercase tracking-widest font-mono block mb-1">Website</span>
                <a href="https://www.mayonemaharajan.com" className="text-indigo-400 hover:text-white transition-colors" rel="noopener noreferrer">
                  www.mayonemaharajan.com
                </a>
              </p>
            </div>
          </address>
        </section>

        {/* FOOTER */}
        <footer className="mt-16 pt-8 border-t border-gray-900 flex flex-col sm:flex-row justify-between gap-4 text-xs">
          <Link href="/" className="text-gray-600 hover:text-white transition-colors">
            [ &larr; Return home ]
          </Link>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/research/mcp" className="text-indigo-400 hover:text-white transition-colors">
              [ API documentation &#8599; ]
            </Link>
          </div>
        </footer>

      </div>
    </main>
  );
}
