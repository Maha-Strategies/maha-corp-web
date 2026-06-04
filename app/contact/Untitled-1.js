// app/contact/page.tsx
import React from 'react';
import Link from 'next/link';

const SITE_URL = 'https://www.mahastrategies.com';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Contact | Maha Strategies',
  description:
    'Secure contact channel for Maha Strategies. Reach out for Cognitive Gateway access tokens, inquiries, and support.',
  alternates: { canonical: '/contact' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/contact`,
    siteName: 'Maha Strategies',
    title: 'Contact Maha Strategies',
    description: 'Request access tokens or reach out to Maha Strategies.',
  },
  twitter: {
    card: 'summary',
    title: 'Contact Maha Strategies',
    description: 'Secure contact channel for Maha Strategies.',
  },
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] py-16 px-6 sm:px-12 font-mono selection:bg-indigo-500 selection:text-white">
      <div className="max-w-3xl mx-auto">
        
        {/* TOP STATUS LINE */}
        <header className="text-xs text-gray-500 mb-12 border-b border-gray-800 pb-4 flex justify-between items-center">
          <span>[ PROTOCOL // CONTACT_CHANNEL ]</span>
          <span className="text-emerald-400">STATUS: SECURE_LINK</span>
        </header>

        <h1 className="font-sans text-2xl sm:text-4xl font-bold tracking-tight text-white uppercase mb-4">
          Establish Contact
        </h1>

        <p className="text-sm text-gray-400 leading-relaxed mb-12 font-sans">
          Use the secure form below to request a Maha Cognitive Gateway access token, report telemetry anomalies, or initiate general inquiries. Please allow up to 48 hours for token provisioning.
        </p>

        {/* CONTACT FORM SECTION */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-6">
            01 // Transmission Matrix
          </h2>
          
          <form 
            action="#" 
            method="POST" 
            className="space-y-6 font-sans bg-black/30 border border-gray-900 p-6 sm:p-8"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* NAME */}
              <div className="space-y-2">
                <label htmlFor="name" className="block text-xs text-gray-400 uppercase tracking-widest font-mono">
                  Designation (Name)
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="Jane Doe"
                />
              </div>

              {/* EMAIL */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-xs text-gray-400 uppercase tracking-widest font-mono">
                  Return Vector (Email)
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="jane@example.com"
                />
              </div>
            </div>

            {/* SUBJECT / INQUIRY TYPE */}
            <div className="space-y-2">
              <label htmlFor="subject" className="block text-xs text-gray-400 uppercase tracking-widest font-mono">
                Transmission Type
              </label>
              <select
                id="subject"
                name="subject"
                className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors appearance-none"
              >
                <option value="token_request">Cognitive Gateway Access Token Request</option>
                <option value="support">Technical Support / Troubleshooting</option>
                <option value="general">General Inquiry</option>
              </select>
            </div>

            {/* MESSAGE */}
            <div className="space-y-2">
              <label htmlFor="message" className="block text-xs text-gray-400 uppercase tracking-widest font-mono">
                Payload (Message)
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                required
                className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-y"
                placeholder="Briefly describe your use case for the Gateway, or state your inquiry..."
              ></textarea>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs uppercase tracking-widest font-mono px-6 py-3 transition-colors flex items-center justify-center w-full sm:w-auto"
              >
                Transmit &rarr;
              </button>
            </div>
          </form>
        </section>

        {/* PGP / ALTERNATIVE CONTACT */}
        <section className="mb-12">
          <h2 className="text-xs text-indigo-400 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">
            02 // Direct Comms
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed font-sans mb-4">
            If you prefer not to use the form, you can transmit inquiries directly to our secure inbox at{' '}
            <a href="mailto:comms@mahastrategies.com" className="text-indigo-400 hover:text-white underline">
              comms@mahastrategies.com
            </a>.
          </p>
        </section>

        {/* FOOTER */}
        <footer className="mt-16 pt-8 border-t border-gray-900 flex flex-col sm:flex-row justify-between gap-4 text-xs">
          <Link href="/" className="text-gray-600 hover:text-white transition-colors">
            [ &larr; Return to Base ]
          </Link>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/research/mcp" className="text-indigo-400 hover:text-white transition-colors">
              [ Cognitive Gateway Docs &#8599; ]
            </Link>
          </div>
        </footer>

      </div>
    </main>
  );
}