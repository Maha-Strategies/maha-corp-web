import { NextResponse } from 'next/server'

import { API_CORS_HEADERS } from '@/lib/api-proxy-policy'
import { BASE_MAINNET_CAIP2, USDC_DECIMALS, offerById, X402_OFFERS } from '@/lib/x402/offers'
import { OFFER_METADATA_VERSION, declarationUrl } from '@/lib/x402/discovery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The complete discovery declaration for one offer.
//
// This exists because the inline declaration in a PAYMENT-REQUIRED challenge is
// compacted. x402 v2 asks a payer to echo the declaration it was served, and
// Vercel caps a request header at 16 KB, so a full Bazaar declaration for a
// richly documented offer cannot travel inside the payment header -- see
// lib/x402/declaration-compaction.ts for the measurements. The challenge
// therefore carries a complete-but-compact form and points here, and this is
// the form a catalog should index.
//
// Unauthenticated and uncharged by design: this is public product
// documentation, and an agent must be able to read what an offer does before
// deciding whether to pay for it. It is served from /api/discovery, which the
// payment proxy does not match, so it is reachable without a key or a payment.
//
// Nothing environment-specific is published. The catalog holds no secrets by
// construction, and the amount and network below are the offer's published
// commercial terms rather than a live settlement configuration.

export async function GET(_request: Request, context: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await context.params
  const offer = offerById(offerId)

  if (!offer) {
    return NextResponse.json(
      {
        error: { code: 'not_found', message: 'No such x402 offer.' },
        offers: X402_OFFERS.map((entry) => ({ offerId: entry.id, status: entry.status })),
      },
      { status: 404, headers: { ...API_CORS_HEADERS, 'Cache-Control': 'no-store' } },
    )
  }

  const origin = new URL(_request.url).origin

  return NextResponse.json(
    {
      offerId: offer.id,
      metadataVersion: OFFER_METADATA_VERSION,
      declarationUrl: declarationUrl(origin, offer.id),
      resource: { method: offer.method, url: `${origin}${offer.path}` },
      description: offer.description,
      // The published commercial terms. A live challenge is still the
      // authoritative quote -- Preview settles on a different network -- so
      // this names the network the offer is *published* on and says so.
      payment: {
        protocol: 'x402',
        version: 2,
        scheme: 'exact',
        publishedNetwork: BASE_MAINNET_CAIP2,
        asset: 'USDC',
        assetDecimals: USDC_DECIMALS,
        amount: offer.amount,
        note: 'The live PAYMENT-REQUIRED challenge is authoritative for network and terms.',
      },
      status: offer.status,
      availability: offer.availability,
      maxRequestBytes: offer.maxRequestBytes,
      capabilityBoundaries: [...offer.capabilityBoundaries],
      retention: {
        fullSourceTextStored: offer.retention.fullSourceTextStored,
        retainedFields: [...offer.retention.retainedFields],
        note: offer.retention.note,
      },
      // The uncompacted schemas and examples. This is the whole point of the
      // route: what the challenge had to drop to fit inside a header.
      contract: {
        input: { example: offer.discovery.input, schema: offer.discovery.inputSchema },
        output: { example: offer.discovery.output, schema: offer.discovery.outputSchema },
      },
    },
    {
      status: 200,
      headers: {
        ...API_CORS_HEADERS,
        // Immutable per deployment; a new deployment rebuilds it.
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      },
    },
  )
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...API_CORS_HEADERS, Allow: 'GET, OPTIONS' } })
}
