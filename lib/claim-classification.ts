/**
 * What kind of utterance a rendered line is, before asking what supports it.
 *
 * A page's "explanatory claims" are not all factual assertions. A procedural
 * step tells the reader how to proceed, a taxonomic entry names a category, and
 * a definitional sentence fixes a term. Demanding an empirical citation for
 * "Atomize the claim." would be as wrong as letting an empirical assertion pass
 * because it sits in a methodology list.
 *
 * Classifying the utterance first is what stops both mistakes.
 */

export const CLAIM_STATUSES = [
  'supported-as-written',
  'supportable-after-narrowing',
  'unsupported',
  'contradicted',
  'interpretive',
  'navigation-or-non-factual',
] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

export const UTTERANCE_KINDS = [
  'empirical-assertion',
  'epistemic-caution',
  'definitional',
  'procedural-step',
  'taxonomic-entry',
  'normative-or-interpretive',
  'navigation',
] as const
export type UtteranceKind = (typeof UTTERANCE_KINDS)[number]

const IMPERATIVE = /^(atomize|assess|report|identify|distinguish|separate|record|compare|state|check|verify|collect|apply|measure|define|list|name|trace|weigh|test|document|declare|treat|avoid|prefer|use)\b/i
const QUANTIFIED = /\b\d+(\.\d+)?\s*(%|percent|x|×|nm|µm|um|mm|ms|s|hz|khz|mhz|ghz|w|mw|kw|j|mj|k|°c|v|mv|a|ma|db|bit|bits|byte|bytes)\b/i
const CAUSAL = /\b(causes?|leads? to|results? in|produces?|improves?|reduces?|increases?|decreases?|outperforms?|demonstrates?|proves?|shows? that|is faster|is more efficient|is better)\b/i
const NORMATIVE = /\b(should|ought|must be understood|is best|properly|appropriately|meaningful|significance|matters|important to)\b/i
/**
 * A statement that limits what may be inferred rather than asserting anything.
 *
 * "Similarity is not descent." and "Must not be read as: ..." are the page
 * restraining a reader, not making a claim. Filing them as unsupported would
 * count the corpus's own carefulness as a defect and badly overstate how much
 * unevidenced assertion there is.
 */
const CAUTION = /^must not be read as\b|\b(is|are) not\b|\bdoes not (erase|preclude|prove|establish|imply|entail|follow|make|guarantee)\b|\bneither proves nor\b|\bcannot establish\b|\bis not automatically\b|\bdo not preclude\b/i
const DEFINITIONAL = /\b(is a|are a|is the|are the|consists? of|refers? to|denotes?|means that|is defined)\b/i

/** Classify one rendered line. */
export function classifyUtterance(text: string): UtteranceKind {
  const t = text.trim()
  if (t.startsWith('/')) return 'navigation'
  if (CAUTION.test(t)) return 'epistemic-caution'
  if (IMPERATIVE.test(t)) return 'procedural-step'
  // A short line with no finite verb is a list entry, not an assertion.
  const hasFiniteVerb = /\b(is|are|was|were|has|have|can|does|do|will|may|must|becomes?|remains?|requires?|depends?)\b/i.test(t)
  if (!hasFiniteVerb && t.split(/\s+/).length <= 8 && !/[.]$/.test(t)) return 'taxonomic-entry'
  if (QUANTIFIED.test(t) || CAUSAL.test(t)) return 'empirical-assertion'
  if (NORMATIVE.test(t)) return 'normative-or-interpretive'
  if (DEFINITIONAL.test(t)) return 'definitional'
  return 'empirical-assertion'
}

export interface ClaimAudit {
  text: string
  kind: UtteranceKind
  citedSourceIds: readonly string[]
  sourceIdentityVerified: boolean
  sourceContentInspected: boolean
  passageSupportsScope: boolean
  status: ClaimStatus
  reason: string
}

/**
 * Decide a claim's status from what was actually established about its source.
 *
 * Being already public buys a line nothing here: `alreadyPublic` is not a
 * parameter, because a grandfather exemption is exactly what this audit exists
 * to refuse.
 */
export function auditClaim(input: {
  text: string
  citedSourceIds: readonly string[]
  sourceIdentityVerified: boolean
  sourceContentInspected: boolean
  passageSupportsScope: boolean
  contradictedByPassage?: boolean
}): ClaimAudit {
  const kind = classifyUtterance(input.text)
  const base = {
    text: input.text, kind,
    citedSourceIds: input.citedSourceIds,
    sourceIdentityVerified: input.sourceIdentityVerified,
    sourceContentInspected: input.sourceContentInspected,
    passageSupportsScope: input.passageSupportsScope,
  }
  if (kind === 'navigation') {
    return { ...base, status: 'navigation-or-non-factual', reason: 'A link to another record. It asserts nothing.' }
  }
  if (input.contradictedByPassage) {
    return { ...base, status: 'contradicted', reason: 'An inspected passage says otherwise.' }
  }
  if (kind === 'epistemic-caution') {
    return { ...base, status: 'interpretive', reason: 'A limit on what may be inferred, not an assertion. It needs to be logically sound, not sourced.' }
  }
  if (kind === 'normative-or-interpretive') {
    return { ...base, status: 'interpretive', reason: 'A judgement about significance or proper practice. No source makes it true; it must read as interpretation.' }
  }
  if (kind === 'taxonomic-entry') {
    return { ...base, status: 'navigation-or-non-factual', reason: 'A category name in a list. It asserts nothing on its own.' }
  }
  if (kind === 'procedural-step') {
    return input.sourceContentInspected && input.passageSupportsScope
      ? { ...base, status: 'supported-as-written', reason: 'A methodology source was inspected and states this step.' }
      : { ...base, status: 'unsupported', reason: 'A procedure attributed to no inspected methodology source. It reads as authoritative practice and is not.' }
  }
  if (input.sourceContentInspected && input.passageSupportsScope && input.sourceIdentityVerified) {
    return { ...base, status: 'supported-as-written', reason: 'An inspected passage from a verified source covers this at its stated scope.' }
  }
  if (input.sourceContentInspected && input.sourceIdentityVerified) {
    return { ...base, status: 'supportable-after-narrowing', reason: 'The source was inspected but its passage is narrower than the claim. The claim holds at the narrower scope.' }
  }
  if (kind === 'definitional') {
    return { ...base, status: 'unsupported', reason: 'A definition attributed to no inspected source. A definition still needs an authority; readers cannot tell whose it is.' }
  }
  return { ...base, status: 'unsupported', reason: input.citedSourceIds.length > 0
    ? 'A source is cited but was never inspected, so nothing establishes this line.'
    : 'No source is cited and nothing establishes this line.' }
}

export function summarise(audits: readonly ClaimAudit[]): Record<ClaimStatus, number> {
  const out = Object.fromEntries(CLAIM_STATUSES.map((s) => [s, 0])) as Record<ClaimStatus, number>
  for (const a of audits) out[a.status] += 1
  return out
}
