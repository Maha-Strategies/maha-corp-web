/**
 * Whether a direct answer actually answers.
 *
 * The gate used a 120-character floor, which two comparison pages failed. They
 * failed for the right reason and the wrong measure: their direct answers were
 * the page's *question* ("How can ... be compared fairly?"), not an answer at
 * all. A character floor would have been cleared by padding the question.
 *
 * These properties can only be satisfied by saying something. A long vague
 * sentence fails every one of them.
 */

export interface CompletenessVerdict {
  complete: boolean
  failures: readonly string[]
  properties: {
    /** Does not merely restate the question. */
    assertsRatherThanAsks: boolean
    /** Names the conditions under which the answer holds. */
    statesScopeOrCondition: boolean
    /** Its substance appears in the page's own supporting passages. */
    groundedInPassages: boolean
    /** Carries more than one content-bearing term. */
    carriesSubstance: boolean
  }
}

const HEDGE = /\b(various|several|many|numerous|a number of|generally|typically|often|usually|complex|nuanced|multifaceted|it depends|significant|important|considerable|appropriate|relevant)\b/gi
const CONDITION = /\b(when|where|only if|under|provided that|given|requires?|must|unless|so long as|within|against|by declaring|subject to)\b/i
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'are', 'be', 'as', 'at', 'by', 'for', 'with', 'that', 'this', 'it', 'its', 'not', 'on', 'from', 'can', 'may', 'must', 'only', 'both', 'each', 'their', 'them', 'they', 'which', 'than', 'when', 'where', 'under', 'into', 'over'])

function contentTerms(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
}

/**
 * Grade one direct answer against the passages behind it.
 *
 * `passages` are the page's own supporting items. Grounding is checked against
 * them so an answer cannot be written past what the page can support.
 */
export function gradeAnswer(answer: string, passages: readonly string[]): CompletenessVerdict {
  const text = answer.trim()
  const terms = contentTerms(text)

  const assertsRatherThanAsks = !text.endsWith('?')
    && !/^(how|what|why|when|where|can|does|do|is|are|should|could|would)\b/i.test(text)

  const statesScopeOrCondition = CONDITION.test(text)

  const passageTerms = new Set(passages.flatMap(contentTerms))
  const shared = new Set(terms.filter((t) => passageTerms.has(t)))
  const groundedInPassages = shared.size >= 3

  // Hedges are not substance. An answer built from them carries little even
  // when it is long, which is precisely the failure a length floor rewards.
  const hedges = (text.match(HEDGE) ?? []).length
  const distinct = new Set(terms).size
  const carriesSubstance = distinct >= 8 && hedges * 3 < distinct

  const failures: string[] = []
  if (!assertsRatherThanAsks) failures.push('restates the question rather than answering it')
  if (!statesScopeOrCondition) failures.push('does not say under what conditions the answer holds')
  if (!groundedInPassages) failures.push('shares too little with the passages that would support it')
  if (!carriesSubstance) failures.push('too few content-bearing terms, or too much hedging for what it says')

  return {
    complete: failures.length === 0,
    failures,
    properties: { assertsRatherThanAsks, statesScopeOrCondition, groundedInPassages, carriesSubstance },
  }
}
