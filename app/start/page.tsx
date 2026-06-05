'use client';

import React, { useActionState } from 'react';
import Link from 'next/link';
import { subscribeToGateway } from './actions';

export default function StartGateway() {
  const [state, formAction, isPending] = useActionState(subscribeToGateway, {
    success: false,
    error: null,
  });

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] py-16 px-6 sm:px-12 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-3xl mx-auto">
        
        {/* TERMINAL HEADER */}
        <header className="font-mono text-xs sm:text-sm text-gray-500 mb-16 border-b border-gray-800 pb-4 flex justify-between">
          <span>[ GATEWAY NODE // INITIALIZATION ]</span>
          <span className="text-indigo-400">STATUS: SECURE</span>
        </header>

        {/* TITLE */}
        <h1 className="font-sans text-4xl sm:text-5xl font-bold tracking-tight mb-4 text-white uppercase">
          Protocol 001: The Stronghold
        </h1>
        <h2 className="font-mono text-sm text-indigo-400 mb-12 uppercase tracking-widest">
          [ START HERE ]
        </h2>

        <article className="prose prose-invert prose-lg font-serif leading-relaxed text-gray-300 max-w-none">
          
          <p className="text-xl text-white font-light">
            The war is no longer fought on a battlefield. It is fought in the supermarket aisle, in the notifications tab, and in the mitochondria of your cells.
          </p>

          <p>
            We are currently living through a period of <strong>Metabolic Colonialism</strong>. The modern industrial environment is not designed to support your life; it is designed to harvest your attention and your biology for profit.
          </p>

          <p className="mb-8">The symptoms are everywhere, but we mistake them for personal failures:</p>

          {/* DIAGNOSTIC LIST */}
          <div className="space-y-6 my-8 p-6 sm:p-8 border border-gray-800 bg-black/40">
            <div className="flex gap-4">
              <span className="font-mono text-indigo-500 font-bold shrink-0">[ FOG ]</span>
              <p className="m-0 text-sm sm:text-base">You struggle to focus. The pull of every notification is engineered to fragment your attention — and it is working exactly as designed.</p>
            </div>
            <div className="flex gap-4">
              <span className="font-mono text-indigo-500 font-bold shrink-0">[ FATIGUE ]</span>
              <p className="m-0 text-sm sm:text-base">You feel constantly drained. The modern food environment is built to sell, not to nourish — and the cumulative load it places on the body is real.</p>
            </div>
            <div className="flex gap-4">
              <span className="font-mono text-indigo-500 font-bold shrink-0">[ DRIFT ]</span>
              <p className="m-0 text-sm sm:text-base">You feel like a spectator in your own life, unable to focus on what matters.</p>
            </div>
          </div>

          <p className="font-sans font-bold text-white tracking-widest uppercase border-l-2 border-indigo-500 pl-4 my-12">
            This publication is not a blog. It is a Field Manual.
          </p>

          <p>
            The Maha Principle is a blueprint for reclaiming Sovereignty. It is about building a “Stronghold”—a protected space where your biology, your focus, and your family are immune to the entropy of the modern world.
          </p>
          <p className="font-bold text-white mb-16">
            We do not ask for permission to be healthy. We seize it.
          </p>

        </article>

        {/* ASSET DOWNLOAD SECTOR */}
        <section className="mt-16 pt-12 border-t border-gray-800">
          <h3 className="font-sans text-2xl font-bold text-white tracking-widest uppercase mb-2">
            The Field Assets
          </h3>
          <p className="font-serif text-gray-400 mb-8 italic">
            Theory is useless without logistics. To begin the protocol, you must first secure your perimeter. I have declassified two assets from the manuscript to help you audit your immediate environment today.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* ASSET 1 */}
            <div className="flex flex-col justify-between p-6 border border-gray-700 bg-black hover:border-indigo-500 transition-colors">
              <div>
                <h4 className="font-sans text-lg font-bold text-white uppercase mb-2">1. The Shopper’s Integrity Card</h4>
                <p className="font-serif text-sm text-gray-400 mb-6">
                  A wallet-sized tactical checklist for spotting ultra-processed products and choosing whole foods instead. Print it. Share it with your household. A simple standard for what makes the cut.
                </p>
              </div>
              <a 
                href="/assets/shoppers-integrity-card.pdf" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block w-full py-3 border border-gray-600 bg-gray-900 text-center font-mono text-xs text-white hover:bg-white hover:text-black transition-colors uppercase tracking-widest"
              >
                Download Integrity Card ↓
              </a>
            </div>

            {/* ASSET 2 */}
            <div className="flex flex-col justify-between p-6 border border-gray-700 bg-black hover:border-indigo-500 transition-colors">
              <div>
                <h4 className="font-sans text-lg font-bold text-white uppercase mb-2">2. The School Lunch Audit</h4>
                <p className="font-serif text-sm text-gray-400 mb-6">
                  A template for parents to understand and discuss what is in their children’s school meals. Use it to ask informed questions and bring the same standards you set at home into the conversation.
                </p>
              </div>
              <a 
                href="/assets/school-lunch-audit.pdf" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block w-full py-3 border border-gray-600 bg-gray-900 text-center font-mono text-xs text-white hover:bg-white hover:text-black transition-colors uppercase tracking-widest"
              >
                Download Audit Script ↓
              </a>
            </div>

          </div>
        </section>

        {/* NEXT STEPS / MAILING LIST PREP */}
        <section className="mt-20 p-8 sm:p-12 border border-indigo-900/50 bg-indigo-950/10">
          <h3 className="font-sans text-xl font-bold text-white tracking-widest uppercase mb-4">
            The Next Step: The 24-Hour Crucible
          </h3>
          <p className="font-serif text-gray-300 mb-8">
            Once you have secured the perimeter, you are ready for the internal work. Join the network to receive the next dispatch. We are building the Army of the Remnant.
          </p>
          
          {state.success ? (
            <div className="bg-emerald-950/20 border border-emerald-900 p-6 text-center">
              <p className="text-emerald-400 font-bold font-mono tracking-widest uppercase text-sm">
                [ PROTOCOL INITIALIZED ]
              </p>
              <p className="font-serif text-zinc-400 text-sm mt-3">
                Your signal has been received. Check your inbox — the next dispatch is inbound.
              </p>
            </div>
          ) : (
            <form action={formAction} className="flex flex-col sm:flex-row gap-4">
              <label htmlFor="gateway-email" className="sr-only">Email address</label>
              <input
                type="email"
                id="gateway-email"
                name="email"
                placeholder="ENTER SECURE EMAIL COMMUNICATOR"
                disabled={isPending}
                className="flex-grow bg-black border border-gray-700 p-3 font-mono text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                required
              />
              <button
                type="submit"
                disabled={isPending}
                className="bg-white text-black font-bold font-mono text-xs tracking-widest px-8 py-3 hover:bg-gray-200 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
              >
                {isPending ? 'TRANSMITTING…' : 'INITIALIZE PROTOCOL'}
              </button>
            </form>
          )}
          {state.error && (
            <p className="text-red-400 text-xs font-mono uppercase tracking-widest mt-4">
              [ ERROR: {state.error} ]
            </p>
          )}
        </section>

        {/* INTERNAL MESH */}
        <div className="mt-16 text-center">
          <Link href="/" className="font-mono text-xs text-gray-600 hover:text-white transition-colors">
            [ RETURN TO MASTER NODE ]
          </Link>
        </div>

      </div>
    </main>
  );
}