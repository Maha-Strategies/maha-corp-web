// The public catalog of autonomously-payable offers.
//
// Before this file the x402 surface had one offer, and its facts were written
// out five times: in X402_RESOURCES, in the PAYMENT-REQUIRED declaration, in
// the Bazaar schemas, in agent-offers.json, and in llms.txt. One offer can
// survive that. Three cannot -- the amount in a manifest and the amount in a
// challenge drift apart silently, and the first symptom is an agent that signs
// for one price and is refused for another.
//
// So the catalog is the single typed source of truth, and every other surface
// derives from it. X402_RESOURCES remains the deployment enablement mechanism
// -- it decides which offers are *on* in a given environment -- but it can no
// longer decide what they *cost* or what they claim: readiness fails when the
// two disagree. See assertResourcesMatchCatalog below.
//
// Nothing secret belongs here. This file's contents are published verbatim to
// unauthenticated callers, so facilitator credentials, wallet keys, and
// private deployment state are excluded by construction.

import type { OfferDiscoveryContract } from './offer-schemas.ts'
import {
  CONTEXT_COMPRESSION_DISCOVERY,
  DEEP_CONTEXT_EVALUATION_DISCOVERY,
  MPS_AUTONOMOUS_AUDIT_DISCOVERY,
} from './offer-schemas.ts'

export const USDC_DECIMALS = 6

/** CAIP-2 for Base Mainnet. The only network these offers are published on. */
export const BASE_MAINNET_CAIP2 = 'eip155:8453'

/**
 * Operational status, which is a public claim rather than an internal flag.
 *
 * `available`  an agent can pay for this today, in Production.
 * `preview`    the contract is implemented and exercised in Preview, but it is
 *              not payable in Production. Discovery may describe it; discovery
 *              must not present it as a callable payment contract.
 * `withheld`   authored and deliberately not enabled anywhere, because an
 *              external gate is unmet. Named rather than hidden, because an
 *              offer that appears and disappears between crawls reads as an
 *              unstable vendor -- but never advertised as payable.
 *
 * Only `available` may appear in Production's payable discovery. That rule is
 * enforced in tests rather than left to reviewers, because the failure mode is
 * an autonomous agent signing an authorization for an endpoint that cannot
 * serve it.
 */
export type OfferStatus = 'available' | 'preview' | 'withheld'

/** Why an offer is not yet available, and what would change that. */
export type OfferAvailability = {
  payableInProduction: boolean
  /** Plain-language gates. Published, so a buyer is never guessing. */
  blockedBy: readonly string[]
}

export type X402Offer = {
  /** Stable public identifier. Never reused for a different contract. */
  id: string
  /** Exactly one method. A GET on the same path is not this offer. */
  method: 'POST'
  /** Exact pathname. Not a prefix -- see priceFor in config.ts. */
  path: string
  /** Smallest indivisible unit of USDC. 1000 = $0.001. */
  amount: string
  /**
   * Published description. Bounded at 480 characters *and* 480 UTF-8 bytes by
   * the CDP facilitator; see MAX_RESOURCE_DESCRIPTION_CHARS in discovery.ts for
   * why that ceiling exists and what happens when it is exceeded.
   */
  description: string
  /** Most concurrent paid requests admitted. */
  concurrencyCap: number
  serviceName: string
  tags: readonly string[]
  status: OfferStatus
  availability: OfferAvailability
  /**
   * Whether a payer must declare an idempotency key and input hash, claimed
   * before settlement.
   *
   * True only for offers that create a durable job. A stateless offer that is
   * called twice simply does the work twice, which is what the payer paid for;
   * a job-creating offer called twice charges twice for one job, which is not.
   */
  requiresIdempotency: boolean
  /** Largest accepted request body, in UTF-8 bytes. */
  maxRequestBytes: number
  /**
   * What this offer is *not*, in the caller's language.
   *
   * Published rather than kept internal. An autonomous buyer has no human to
   * ask, so the boundary has to travel with the offer or it does not exist.
   */
  capabilityBoundaries: readonly string[]
  /**
   * What survives the request, stated precisely.
   *
   * An earlier revision published a flat "no source text is retained" for every
   * offer. That was true of the compression offers and false of the MPS audit,
   * whose stored result contains 6-25 word verbatim excerpts of the submitted
   * passage by design -- an audit that could not quote the claim it tagged
   * would be unusable. A retention promise that is wrong on one offer is worse
   * than no promise, so the shape now forces each offer to answer separately.
   */
  retention: {
    /** True only if the whole submitted document or passage is stored. */
    fullSourceTextStored: false
    /** True where short verbatim spans of the input survive in the result. */
    verbatimExcerptsRetained: boolean
    /** Fields the ledger keeps, so the claims above are auditable. */
    retainedFields: readonly string[]
    /** One sentence a buyer can act on. */
    note: string
  }
  discovery: OfferDiscoveryContract
}

export const CONTEXT_COMPRESSION_OFFER: X402Offer = {
  id: 'context-compression',
  method: 'POST',
  path: '/api/v1/compress',
  // Unchanged, and deliberately so. This contract has settled payments against
  // it; a price or schema change here is a breaking change to a live product.
  amount: '1000',
  description:
    'Compress long documents and RAG inputs into token-budgeted, deduplicated context packs with source-linked provenance. '
    + 'Returns original and compiled token counts, so the saving is verifiable. '
    + 'Net-positive above N = fee / (r x p) tokens: r your reduction, p your input price. '
    + 'Extractive and budget-bound, so check includedPassages before relying on it. '
    + 'Ranks Latin, Cyrillic, Greek, Arabic and CJK; CJK coarser (bigrams). '
    + 'Not for tabular or heavily-structured payloads.',
  concurrencyCap: 8,
  serviceName: 'Maha Context Compiler',
  tags: ['ai', 'context-compression', 'llm', 'rag', 'provenance'],
  status: 'available',
  availability: { payableInProduction: true, blockedBy: [] },
  requiresIdempotency: false,
  maxRequestBytes: 450_000,
  capabilityBoundaries: [
    'Extractive selection, not summarisation or rewriting.',
    'Does not verify claims, guarantee completeness, or prevent hallucination.',
    'Token counts are model-neutral estimates, not provider billing counts.',
  ],
  retention: {
    fullSourceTextStored: false,
    verbatimExcerptsRetained: false,
    retainedFields: ['input hash', 'output hash', 'token estimates', 'status class'],
    note: 'Nothing from the request is stored. The compiled pack is returned and discarded; only hashes, token estimates and a status class are retained.',
  },
  discovery: CONTEXT_COMPRESSION_DISCOVERY,
}

export const DEEP_CONTEXT_EVALUATION_OFFER: X402Offer = {
  id: 'deep-context-evaluation',
  method: 'POST',
  path: '/api/v1/compress/evaluate',
  amount: '10000',
  // Every clause is load-bearing and the field has a hard 480 ceiling, so this
  // states the metric and its boundary and nothing else. The metric is exact
  // span retention: whether the caller's own labelled spans survived selection.
  // It is not an accuracy, quality, or verification measure and must never be
  // described as one -- an agent that reads "evaluation" as "fact-checking"
  // will buy this for a job it cannot do.
  description:
    'Compile 1-8 documents into a token-budgeted context pack, then measure exact retention of 1-32 caller-labelled evidence spans. '
    + 'Returns the pack, source-linked passages, input and output hashes, original and compiled token estimates, tokensSaved, source coverage, and requiredEvidenceRetentionPercent. '
    + 'Retention is exact span matching only: not accuracy, answer quality, verification, or hallucination prevention. '
    + 'Extractive and budget-bound. Request content is not stored.',
  concurrencyCap: 4,
  serviceName: 'Maha Context Compiler',
  tags: ['ai', 'context-compression', 'llm', 'rag', 'evidence-retention'],
  // Implemented and exercised in Preview, deliberately not payable in
  // Production until its durable telemetry migration and a paid end-to-end
  // settlement have both been proven against the unified Maha platform store.
  // Promoted 2026-08-11. The telemetry migration is applied and verified in
  // Production -- readiness reports the tables and functions present -- and the
  // unpaid contract is proven at 10000 base units with x402-doctor passing
  // zero-error against both compression offers. The remaining gate, a paid
  // end-to-end settlement, is executed against this promotion rather than
  // before it: the offer has to be payable for a payment to prove anything.
  status: 'available',
  availability: { payableInProduction: true, blockedBy: [] },
  requiresIdempotency: false,
  // The enterprise ceiling. This offer is priced ten times the entry tier and
  // accepts the largest payload the compiler supports.
  maxRequestBytes: 1_050_000,
  capabilityBoundaries: [
    'Measures exact retention of caller-labelled evidence spans, nothing else.',
    'Not factual accuracy, answer quality, verification, or hallucination prevention.',
    'A retained span means the text survived selection, not that the text is true.',
    'Extractive and budget-bound: spans that exceed the token budget are dropped and reported.',
  ],
  retention: {
    fullSourceTextStored: false,
    verbatimExcerptsRetained: false,
    retainedFields: ['input hash', 'output hash', 'token estimates', 'evidence retention counts', 'status class'],
    note: 'Neither the documents nor the evidence spans are stored. Spans are hashed for the retention report; only hashes, counts and token estimates are retained.',
  },
  discovery: DEEP_CONTEXT_EVALUATION_DISCOVERY,
}

export const MPS_AUTONOMOUS_AUDIT_OFFER: X402Offer = {
  id: 'mps-autonomous-audit',
  method: 'POST',
  path: '/api/v1/mps/audit',
  amount: '100000',
  // "Triage" rather than "audit" in the buyer-facing sentence, because the
  // statuses are model-assigned and the word audit implies an assurance
  // engagement this is not.
  description:
    'Automated claim triage for a nonfiction passage under the Maha Provenance Standard v0.1. '
    + 'Each substantive claim returns a provenance status (VERIFIED, SOURCED, BOUNDARY, ILLUSTRATIVE, UNVERIFIED), a rationale, and a suggested action. '
    + 'Model-assigned triage: not factual certification, legal advice, or human verification, and must be checked before publication. '
    + 'Passage limit 6000 characters. The full passage is not stored; results keep short verbatim claim excerpts.',
  // Deliberately low. Each admitted request crosses the Anthropic boundary and
  // holds a slot for the length of a model call, so the cap is sized to what
  // the model budget tolerates rather than to what the route could serve.
  concurrencyCap: 2,
  serviceName: 'Maha Provenance Standard',
  tags: ['ai', 'provenance', 'claim-triage', 'editorial', 'fact-status'],
  // Withheld until 2026-08-12, because the honest consequence of shipping
  // without the gates below is a settled payment with no job behind it.
  //
  // Flipping this field is the whole promotion: the moment it lands and
  // deploys, an autonomous agent can sign for $0.10. The staged gates -- and
  // in particular the fresh authorization required for the single paid
  // settlement, which no earlier authorization satisfies -- are in
  // docs/x402-mps-promotion.md.
  //
  //   1. The paid-job and admission migrations (20260810000400 and
  //      20260810000500) applied in Production AND their objects directly
  //      censused: x402_mps_audits, resume_x402_mps_audit, x402_offer_admissions
  //      and the three admission RPCs. The prior evidence was inferential --
  //      the Production census deliberately excluded the MPS tables -- and
  //      inference is what this gate exists to refuse.
  //   2. Durable paid-job recovery exercised against a real deployment rather
  //      than only in unit tests: a paid job resumes at
  //      /api/v1/mps/audit/{auditId} against its retrieval token, free, and an
  //      idempotent replay returns the same job without a second charge.
  //   3. Exactly one explicitly authorized paid end-to-end settlement.
  //
  // Everything commercial is unchanged by the promotion: the path, 100000 base
  // units, Base Mainnet, Base USDC, the merchant payee, the concurrency cap of
  // 2, the 32 KiB ceiling, the idempotency and input-hash requirements, the
  // triage limitations, and the retained claim excerpts. A promotion that also
  // re-priced or re-scoped the offer would be two changes wearing one review.
  status: 'available',
  availability: { payableInProduction: true, blockedBy: [] },
  // This offer creates a job and calls a model. A duplicate is a double
  // charge, not duplicated work.
  requiresIdempotency: true,
  maxRequestBytes: 32_768,
  capabilityBoundaries: [
    'Automated triage that assigns provenance statuses to claims.',
    'Not factual certification: a VERIFIED status is a model judgement, not a confirmation.',
    'Not legal advice.',
    'Not human verification, and not a substitute for editorial review before publication.',
  ],
  // The correction that matters most on this offer. An audit result is a list
  // of tagged claims, and a claim is identified by a 6-25 word verbatim excerpt
  // of the passage -- an audit that could not quote what it tagged would be
  // useless. So excerpts are retained by design, and saying otherwise was
  // wrong. What is not retained is the passage as submitted.
  retention: {
    fullSourceTextStored: false,
    verbatimExcerptsRetained: true,
    retainedFields: [
      'input hash', 'status', 'payer address', 'payment transaction',
      'short verbatim claim excerpts (6-25 words each)', 'provenance classifications', 'rationales', 'operational metadata',
    ],
    note: 'The complete submitted passage is not retained. Audit results retain short verbatim claim excerpts, classifications, rationales, hashes, and operational metadata.',
  },
  discovery: MPS_AUTONOMOUS_AUDIT_DISCOVERY,
}

export const X402_OFFERS: readonly X402Offer[] = Object.freeze([
  CONTEXT_COMPRESSION_OFFER,
  DEEP_CONTEXT_EVALUATION_OFFER,
  MPS_AUTONOMOUS_AUDIT_OFFER,
])

/**
 * The offers Production discovery may present as callable payment contracts.
 *
 * Everything else may be *described* -- a withheld offer that vanishes between
 * crawls reads as an unstable vendor -- but must not be handed to an
 * autonomous agent as something it can pay for today.
 */
export function payableOffers(): readonly X402Offer[] {
  return X402_OFFERS.filter((offer) => offer.status === 'available')
}

export function offerById(id: string): X402Offer | undefined {
  return X402_OFFERS.find((offer) => offer.id === id)
}

/** Exact method and path. Never a prefix: see the note in config.ts. */
export function offerFor(method: string, pathname: string): X402Offer | undefined {
  return X402_OFFERS.find((offer) => offer.method === method.toUpperCase() && offer.path === pathname)
}

/** Human-readable price, for documentation surfaces only. Never for signing. */
export function offerPriceUsd(offer: X402Offer): string {
  const units = Number(offer.amount)
  return `$${(units / 10 ** USDC_DECIMALS).toFixed(USDC_DECIMALS)}`.replace(/0+$/, '').replace(/\.$/, '.0')
}

export const OFFER_PATHS: readonly string[] = Object.freeze(X402_OFFERS.map((offer) => offer.path))

/**
 * Fails when a deployment's X402_RESOURCES contradicts the published catalog.
 *
 * The environment variable stays in charge of *whether* an offer is enabled,
 * because that is a deployment decision and belongs in deployment config. It
 * is not in charge of price or description, because those are published claims
 * and a deployment that quietly disagrees with them is selling something the
 * catalog does not describe. Enabling a subset is fine; enabling a *different*
 * contract is not.
 *
 * Returns the problems rather than throwing, so readiness can report all of
 * them at once instead of one per deploy attempt.
 */
export function catalogMismatches(
  resources: readonly { pathPrefix?: string; path?: string; method?: string; amount: string; description: string; concurrencyCap: number }[],
): string[] {
  const problems: string[] = []
  for (const resource of resources) {
    const path = resource.path ?? resource.pathPrefix ?? ''
    const method = (resource.method ?? 'POST').toUpperCase()
    const offer = offerFor(method, path)
    if (!offer) {
      problems.push(`X402_RESOURCES declares ${method} ${path}, which is not in the public offer catalog.`)
      continue
    }
    if (resource.amount !== offer.amount) {
      problems.push(`${offer.id}: X402_RESOURCES prices ${method} ${path} at ${resource.amount} but the catalog publishes ${offer.amount}.`)
    }
    if (resource.description !== offer.description) {
      problems.push(`${offer.id}: X402_RESOURCES describes ${method} ${path} differently from the catalog. The challenge and the manifests would disagree.`)
    }
    if (resource.concurrencyCap !== offer.concurrencyCap) {
      problems.push(`${offer.id}: X402_RESOURCES caps ${method} ${path} at ${resource.concurrencyCap} but the catalog publishes ${offer.concurrencyCap}.`)
    }
  }
  return problems
}
