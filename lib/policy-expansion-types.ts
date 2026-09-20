export type ClaimKind = 'current-law' | 'empirical-evidence' | 'source-description' | 'forecast' | 'value' | 'existing-published-proposal' | 'draft-option'
export type Readiness = 'options-brief' | 'revise-current-baseline'
export type PolicySource = {
  id: string; title: string; url: string; locator: string; version: string;
  inspected: string; depth: 'section'; supports: string; limitation: string; rights: string;
}
export type PolicyClaim = { kind: ClaimKind; text: string; sources: string[] }
export type PolicyDraft = {
  slug: string; issue: string; question: string; answer: string;
  status: 'draft option' | 'undecided'; readiness: Readiness;
  baselineDate: string; baseline: PolicyClaim[];
  options: string[]; mechanism: string;
  authority: { actor: string; role: string; sources: string[]; status: 'source-bounded' | 'requires-legal-review' }[];
  costs: { status: 'uncosted'; assumptions: string; funding: string; distribution: string; uncertainty: string };
  objection: string; alternative: string; sequence: string[]; outcomes: string[]; reconsider: string[];
  gaps: string[]; sources: string[]; related: string[]; existingProposal?: string;
}
export const POLICY_REVIEW_DATE = '2026-09-19'
export const POLICY_REVIEW_BASIS = 'AI-assisted source inspection and drafting; no independent expert, legal or budget review; no personal position approval.'
export const POLICY_INTEREST_DISCLOSURE = 'Maha Strategies develops and offers evidence and AI-governance services. That commercial interest is relevant to its AI policy analysis; these briefs are not product endorsements or purchasing requirements.'
export const POLICY_DRAFT_ROBOTS = { index: false, follow: false } as const

// Draft availability is deliberately not an opt-in production feature flag.
// Publishing therefore takes a reviewed code change, which is what the
// predicates below are: publication is a property of the draft's own
// readiness, not of an environment variable someone can flip.
export function policyDraftsAvailable(environment: string | undefined) {
  return environment === 'development'
}

/**
 * A draft is published only when its own readiness says it is a reviewable
 * options brief. The four drafts still marked `revise-current-baseline` carry
 * historical or partial sources — archived 2009 material in one case, an
 * October 2023 document in another — and stay unpublished until those are
 * refreshed. Approved as an options library on 2026-09-20: these pages compare
 * mechanisms without selecting one, and none is an attributed Maha position.
 */
export function policyDraftPublished(draft: { readiness: string }) {
  return draft.readiness === 'options-brief'
}

/** Published everywhere, or visible in development for continued editing. */
export function policyDraftVisible(draft: { readiness: string }, environment: string | undefined) {
  return policyDraftPublished(draft) || policyDraftsAvailable(environment)
}
