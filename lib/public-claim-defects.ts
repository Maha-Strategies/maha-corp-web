/**
 * A deterministic detector for the public-claim defects this programme keeps
 * finding by hand.
 *
 * This is a product-relevance fixture, not a truth oracle. Every rule below
 * checks the *relationship* between a claim and its evidence: whether a source
 * was read, whether a locator exists, whether the claim reaches past the
 * passage, whether the frames match. None of them checks whether the claim is
 * true, and the contract says so in a field rather than in a comment, so a
 * caller cannot quietly present it as verification.
 *
 * Separate from lib/evidence-preflight-contract.ts, which is the shipped
 * product's own API contract. This file is a private fixture showing that the
 * product's detection model would cover the defects found in this corpus.
 */

export const PUBLIC_CLAIM_DEFECTS = [
  'source-cited-but-uninspected',
  'locator-absent',
  'claim-stronger-than-passage',
  'quantitative-inputs-missing',
  'evidence-frame-mismatch',
  'unsupported-causal-inference',
] as const
export type PublicClaimDefect = (typeof PUBLIC_CLAIM_DEFECTS)[number]

export interface ClaimUnderTest {
  text: string
  citedSourceIds: readonly string[]
  sourceInspected: boolean
  locator: string | null
  /** What the inspected passage states, when there is one. */
  passageText: string | null
  /** The scope the source declares for itself, e.g. a reporting standard. */
  sourceDeclaredScope: 'reporting-standard' | 'research-finding' | 'oversight-guidance' | 'vendor-catalogue' | 'reference-work' | null
  claimFrame: 'conduct-guidance' | 'empirical' | 'definitional' | 'oversight' | 'product-scope' | null
}

export interface Detection {
  code: PublicClaimDefect
  detail: string
}

const QUANT = /\b\d+(\.\d+)?\s*(%|percent|nm|mm|ms|hz|khz|mhz|ghz|w|mw|j|k|v|db)\b/i
const CAUSAL = /\b(causes?|leads? to|results? in|produces?|improves?|reduces?|increases?|decreases?|enables?|ensures?|prevents?|can change)\b/i
const STRONG = /\b(proves?|demonstrates?|establishes?|confirms?|guarantees?|always|never|every)\b/i

/**
 * Frames a source's declared scope cannot carry.
 *
 * The PRISMA case is the one that motivated this: a reporting standard cited
 * behind study-conduct guidance, when the standard itself states it must not be
 * used that way. A topical match hides it; a frame check catches it.
 */
const SCOPE_CANNOT_CARRY: Record<string, readonly string[]> = {
  'reporting-standard': ['conduct-guidance', 'empirical'],
  'vendor-catalogue': ['empirical'],
  'oversight-guidance': ['empirical'],
  'reference-work': ['conduct-guidance'],
  'research-finding': [],
}

export function detectPublicClaimDefects(claim: ClaimUnderTest): Detection[] {
  const out: Detection[] = []

  if (claim.citedSourceIds.length > 0 && !claim.sourceInspected) {
    out.push({ code: 'source-cited-but-uninspected',
      detail: `Cites ${claim.citedSourceIds.length} source(s), none of which has been read. A citation is not support.` })
  }
  if (claim.citedSourceIds.length > 0 && !claim.locator) {
    out.push({ code: 'locator-absent',
      detail: 'A source is cited with no locator, so a reader cannot check the claim against anything.' })
  }
  if (claim.passageText && STRONG.test(claim.text) && !STRONG.test(claim.passageText)) {
    out.push({ code: 'claim-stronger-than-passage',
      detail: 'The claim asserts more certainty than the passage it rests on.' })
  }
  if (QUANT.test(claim.text) && !claim.passageText) {
    out.push({ code: 'quantitative-inputs-missing',
      detail: 'A quantity is stated with no inspected passage supplying it.' })
  }
  if (claim.sourceDeclaredScope && claim.claimFrame
    && (SCOPE_CANNOT_CARRY[claim.sourceDeclaredScope] ?? []).includes(claim.claimFrame)) {
    out.push({ code: 'evidence-frame-mismatch',
      detail: `A ${claim.sourceDeclaredScope} is cited behind ${claim.claimFrame}, which that kind of source does not carry.` })
  }
  if (CAUSAL.test(claim.text) && (!claim.passageText || !CAUSAL.test(claim.passageText))) {
    out.push({ code: 'unsupported-causal-inference',
      detail: 'A causal relation is asserted that no inspected passage states.' })
  }
  return out
}

export const RELEVANCE_CONTRACT = {
  name: 'Evidence Preflight, public-claim relevance fixture',
  detects: PUBLIC_CLAIM_DEFECTS,
  /** Stated as data so a caller cannot present this as verification. */
  independentlyVerifiesTruth: false,
  whatItDoes: 'Checks the relationship between a public claim and the evidence attached to it: whether the source was read, whether a locator exists, whether the claim reaches past the passage, and whether the frames match.',
  whatItDoesNot: [
    'It does not determine whether a claim is true.',
    'It does not read a source for the operator; an uninspected source is reported as uninspected, not resolved.',
    'It does not rank or score a publisher.',
    'A clean result means no defect of these six kinds was detected, not that the page is correct.',
  ],
} as const
