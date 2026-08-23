"use client"

import React, { useActionState } from 'react'
import Link from 'next/link'

import { TrackedLink } from '@/components/ConversionTracker'
import { subscribeToGateway } from './actions'

export default function StartGateway() {
  const [state, formAction, isPending] = useActionState(subscribeToGateway, {
    success: false,
    error: null,
  })

  return (
    <main className="evidence-page">
      <div className="evidence-container">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker mb-4 flex justify-between gap-4">
            <span>[ GATEWAY NODE // INITIALIZATION ]</span>
            <span className="text-[var(--status-verified)]">STATUS: SECURE</span>
          </p>
          <p className="evidence-kicker">[ Personal Protocols // Companion to The Maha Principle ]</p>
          <h1 className="evidence-title evidence-title--product">Personal Protocol 001: The Stronghold</h1>
          <p className="evidence-kicker mt-3">[ Start here ]</p>
        </header>

        <section className="evidence-inset mt-8">
          <p className="evidence-copy mb-4">
            Looking for research for an investment, market, or corporate strategy decision?
          </p>
          <TrackedLink
            href="/consulting"
            event="cta_personal_protocols_to_consulting"
            className="evidence-action"
          >
            Commission a Verified Research Brief ↗
          </TrackedLink>
        </section>

        <article className="evidence-section">
          <p className="evidence-copy text-xl">The war is no longer fought on a battlefield. It is fought in the supermarket aisle, in the notifications tab, and in the mitochondria of your cells.</p>
          <p className="evidence-copy mt-7">
            We are currently living through a period of <strong>Metabolic Colonialism</strong>. The modern industrial environment is
            not designed to support your life; it is designed to harvest your attention and your biology for profit.
          </p>
          <p className="evidence-copy mt-7">The symptoms are everywhere, but we mistake them for personal failures:</p>

          <div className="mt-8 space-y-6 evidence-card">
            <div className="flex gap-4">
              <span className="shrink-0 text-sm font-bold text-[var(--status-sourced)]">[ FOG ]</span>
              <p className="evidence-copy mt-0">You struggle to focus. The pull of every notification is engineered to fragment your attention — and it is working exactly as designed.</p>
            </div>
            <div className="flex gap-4">
              <span className="shrink-0 text-sm font-bold text-[var(--status-sourced)]">[ FATIGUE ]</span>
              <p className="evidence-copy mt-0">You feel constantly drained. The modern food environment is built to sell, not to nourish — and the cumulative load it places on the body is real.</p>
            </div>
            <div className="flex gap-4">
              <span className="shrink-0 text-sm font-bold text-[var(--status-sourced)]">[ DRIFT ]</span>
              <p className="evidence-copy mt-0">You feel like a spectator in your own life, unable to focus on what matters.</p>
            </div>
          </div>

          <p className="evidence-kicker mt-12">[ This publication is not a blog. It is a Field Manual. ]</p>
          <p className="evidence-copy mt-7">
            The Maha Principle is a blueprint for reclaiming sovereignty. It is about building a “Stronghold”—a protected space where your biology,
            your focus, and your family are immune to the entropy of the modern world.
          </p>
          <p className="evidence-copy mt-6 font-bold">We do not ask for permission to be healthy. We seize it.</p>
        </article>

        <section className="evidence-section">
          <p className="evidence-kicker">[ The Field Assets ]</p>
          <h2 className="evidence-section-title mt-4">Theory is useless without logistics.</h2>
          <p className="evidence-copy mt-5 mb-8">
            To begin the protocol, you must first secure your perimeter. I have declassified two assets from the manuscript to help you
            audit your immediate environment today.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <article className="evidence-card flex flex-col justify-between">
              <div>
                <h3 className="evidence-card-title">1. The Shopper&rsquo;s Integrity Card</h3>
                <p className="evidence-card-copy mt-4">
                  A wallet-sized tactical checklist for spotting ultra-processed products and choosing whole foods instead. Print it. Share it with
                  your household. A simple standard for what makes the cut.
                </p>
              </div>
              <a
                href="/assets/shoppers-integrity-card.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 evidence-link"
              >
                Download Integrity Card ↓
              </a>
            </article>

            <article className="evidence-card flex flex-col justify-between">
              <div>
                <h3 className="evidence-card-title">2. The School Lunch Audit</h3>
                <p className="evidence-card-copy mt-4">
                  A template for parents to understand and discuss what is in their children&rsquo;s school meals. Use it to ask informed questions and bring
                  the same standards you set at home into the conversation.
                </p>
              </div>
              <a
                href="/assets/school-lunch-audit.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 evidence-link"
              >
                Download Audit Script ↓
              </a>
            </article>
          </div>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">[ The Next Step: The 24-Hour Crucible ]</p>
          <p className="evidence-copy mt-5">
            Once you have secured the perimeter, you are ready for the internal work. Join the network to receive the next dispatch. We are building the
            Army of the Remnant.
          </p>

          {state.success ? (
            <div className="mt-8 evidence-card border-[var(--status-verified)]">
              <p className="evidence-kicker text-[var(--status-verified)]">[ PROTOCOL INITIALIZED ]</p>
              <p className="evidence-copy mt-4 text-[var(--text-primary)]">Your signal has been received. Check your inbox — the next dispatch is inbound.</p>
            </div>
          ) : (
            <form action={formAction} className="evidence-card mt-8">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <label className="sr-only" htmlFor="gateway-email">Email address</label>
                <input
                  type="email"
                  id="gateway-email"
                  name="email"
                  placeholder="ENTER SECURE EMAIL COMMUNICATOR"
                  disabled={isPending}
                  className="evidence-input w-full"
                  required
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="evidence-action evidence-action--primary min-w-[14rem]"
                >
                  {isPending ? 'TRANSMITTING…' : 'INITIALIZE PROTOCOL'}
                </button>
              </div>
            </form>
          )}

          {state.error && (
            <p className="mt-4 evidence-kicker text-[var(--status-failed)]">[ ERROR: {state.error} ]</p>
          )}
        </section>

        <section className="evidence-section">
          <div className="text-center">
            <Link href="/" className="evidence-link">
              [ RETURN TO MASTER NODE ]
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
