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
  RESEARCH_INTAKE_EVIDENCE_PACK_DISCOVERY,
} from './offer-schemas.ts'
import {
  CONTEXT_BUDGET_LADDER_DISCOVERY,
  EVIDENCE_RETENTION_MATRIX_DISCOVERY,
  GOVERNED_CONTEXT_VERIFICATION_DISCOVERY,
} from './context-product-offer-schemas.ts'

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
  // Returned to withheld on 2026-08-12, hours after the first promotion, by
  // the first paid Mainnet verification -- which is what that verification
  // was for. Re-promoted on 2026-09-05 only after the request preimage,
  // request identity and body became pre-settlement admission checks and the
  // repaired boundary passed its non-paying Preview suite.
  // The cause was reconstructed: the buyer hashed the complete JSON request,
  // while the route expected the text field alone, and that disagreement was
  // detected only after settlement. The contract now publishes the preimage
  // and the gateway checks the body on a clone before any payment can move.
  //
  // One settlement of 100000 base units confirmed on chain
  // (0x1c6cf823546de43b33b79974bfe2309d44a11fcf7d15a833b755fc05b4e1b0c4),
  // and the request that paid it did not receive a deliverable response. The
  // catalog said `available` while Production had already removed the path
  // from X402_RESOURCES, so discovery was advertising a contract nobody could
  // buy. That gap is the reason this field exists, and leaving it open would
  // have been worse than never promoting. A later paid verification is a
  // separately authorized post-deployment observation, not permission to
  // publish the repaired contract.
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

export const CONTEXT_BUDGET_LADDER_OFFER: X402Offer = {
  id: 'context-budget-ladder', method: 'POST', path: '/api/v1/context/budget-ladder', amount: '5000',
  description: 'Compile the same supplied documents at exactly five ascending token budgets. Returns five source-linked extractive Context Packs, a compact comparison table, stable hashes, and a deterministic receipt digest. Price basis: five $0.001 compilations. No model inference, source acquisition, claim verification, completeness guarantee, or answer-quality assessment. Request and result bodies are not stored.',
  concurrencyCap: 3, serviceName: 'Maha Context Budget Ladder', tags: ['ai', 'context', 'budget', 'provenance', 'x402'],
  status: 'available', availability: { payableInProduction: true, blockedBy: [] }, requiresIdempotency: false, maxRequestBytes: 450_000,
  capabilityBoundaries: ['Exactly five deterministic compilations at caller-declared budgets.', 'Extractive selection only; no claim verification, model inference, completeness guarantee, or answer-quality assessment.'],
  retention: { fullSourceTextStored: false, verbatimExcerptsRetained: false, retainedFields: ['offer usage status and aggregate counts'], note: 'Request and response bodies are returned transiently and are not stored.' },
  discovery: CONTEXT_BUDGET_LADDER_DISCOVERY,
}

export const EVIDENCE_RETENTION_MATRIX_OFFER: X402Offer = {
  id: 'evidence-retention-matrix', method: 'POST', path: '/api/v1/context/evidence-matrix', amount: '50000',
  description: 'Evaluate exact retention of 1-32 caller-labelled evidence spans at exactly five ascending token budgets. Returns five source-linked Context Packs, per-run retention metrics, an evidence frontier, stable hashes, and a deterministic receipt digest. Price basis: five $0.01 evaluations. Retention is not truth, accuracy, answer quality, legal compliance, or hallucination prevention. Bodies are not stored.',
  concurrencyCap: 2, serviceName: 'Maha Evidence Retention Matrix', tags: ['ai', 'context', 'evidence-retention', 'budget', 'x402'],
  status: 'available', availability: { payableInProduction: true, blockedBy: [] }, requiresIdempotency: false, maxRequestBytes: 1_050_000,
  capabilityBoundaries: ['Exactly five deterministic exact-span retention evaluations.', 'Retention is not truth, accuracy, answer quality, legal compliance, or hallucination prevention.'],
  retention: { fullSourceTextStored: false, verbatimExcerptsRetained: false, retainedFields: ['offer usage status and aggregate counts'], note: 'Documents, evidence spans, compiled packs, and response bodies are not stored.' },
  discovery: EVIDENCE_RETENTION_MATRIX_DISCOVERY,
}

export const GOVERNED_CONTEXT_VERIFICATION_OFFER: X402Offer = {
  id: 'governed-context-verification-pack', method: 'POST', path: '/api/v1/context/governed-verification', amount: '500000',
  description: 'Produce one machine-readable context-control evidence packet from caller-supplied documents and exact evidence spans: compiled Context Pack, retention results, policy and budget observations, integrity hashes, boundaries, and deterministic receipt digest. A machine-generated preflight, not factual or compliance certification, new research, human judgment, or proof of downstream model behavior. Bodies are not stored.',
  concurrencyCap: 2, serviceName: 'Maha Governed Context Verification Pack', tags: ['ai', 'context-control', 'evidence', 'governance', 'x402'],
  status: 'available', availability: { payableInProduction: true, blockedBy: [] }, requiresIdempotency: false, maxRequestBytes: 1_050_000,
  capabilityBoundaries: ['Machine-generated context-control evidence packet, not factual or compliance certification.', 'No source acquisition, new research, human judgment, model inference, or guarantee of downstream behavior.'],
  retention: { fullSourceTextStored: false, verbatimExcerptsRetained: false, retainedFields: ['offer usage status and aggregate counts'], note: 'Documents, evidence spans, compiled packs, and response bodies are not stored.' },
  discovery: GOVERNED_CONTEXT_VERIFICATION_DISCOVERY,
}

export const RESEARCH_INTAKE_EVIDENCE_PACK_OFFER: X402Offer = {
  id: 'research-intake-evidence-pack',
  method: 'POST',
  path: '/api/v1/research/intake',
  amount: '1000000',
  description:
    'Machine-generated intake packet for one question and 1-10 supplied source sections. '
    + 'Returns one MPS triage per section, an ordered manifest, claim inventory, citation gaps, potential conflicts, unresolved questions, proposed human-research scope, and deterministic digests. '
    + 'Fixed $1 capacity price: up to ten $0.10 section audits. Not a research brief, new research, factual certification, human judgment, or a recommendation.',
  concurrencyCap: 1,
  serviceName: 'Maha Research Intake',
  tags: ['research-intake', 'provenance', 'claim-triage', 'evidence', 'research-scoping'],
  status: 'available',
  availability: { payableInProduction: true, blockedBy: [] },
  requiresIdempotency: true,
  maxRequestBytes: 65_536,
  capabilityBoundaries: [
    'Machine-generated intake packet, not a research brief.',
    'Uses only 1-10 source sections supplied by the buyer; no source acquisition or new research.',
    'Accepts only material declared public or synthetic and non-sensitive; supplied sections are transmitted to Anthropic for processing.',
    'MPS statuses and potential conflicts are automated triage requiring human review.',
    'Does not provide factual certification, legal advice, human judgment, or a recommendation.',
  ],
  retention: {
    fullSourceTextStored: false,
    verbatimExcerptsRetained: true,
    retainedFields: [
      'input and receipt hashes', 'question and optional intake metadata', 'ordered source and section identifiers',
      'short verbatim claim excerpts', 'MPS classifications and rationales', 'citation gaps', 'potential conflict candidates',
      'payment transaction and payer',
    ],
    note: 'Complete supplied source sections are transmitted to Anthropic for processing but are not stored by Maha. The result retains the question, supplied identifiers and metadata, short verbatim claim excerpts, classifications, digests, and operational metadata.',
  },
  discovery: RESEARCH_INTAKE_EVIDENCE_PACK_DISCOVERY,
}

export const X402_OFFERS: readonly X402Offer[] = Object.freeze([
  CONTEXT_COMPRESSION_OFFER,
  CONTEXT_BUDGET_LADDER_OFFER,
  DEEP_CONTEXT_EVALUATION_OFFER,
  EVIDENCE_RETENTION_MATRIX_OFFER,
  MPS_AUTONOMOUS_AUDIT_OFFER,
  GOVERNED_CONTEXT_VERIFICATION_OFFER,
  RESEARCH_INTAKE_EVIDENCE_PACK_OFFER,
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
