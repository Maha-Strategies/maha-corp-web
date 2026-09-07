/**
 * Formal review of the frozen prerequisite definitions.
 *
 * The cohort is derived, never assumed: every definition candidate that is
 * unresolved in unified readiness ledger v7 and carries incoming dependency
 * fan-out in repaired dependency graph v3. Four qualify.
 *
 * Each is reviewed against the same five requirements — exact source identity,
 * locator, rights, scope and boundary — and each is decided on its own
 * evidence. A decision here binds one candidate. It never travels along an
 * edge: a definition reaching evidence-ready says what the term means, and
 * says nothing about whether any page applying it has sources for its own
 * claims. That separation is the point of the exercise, not a caveat on it.
 */
import { HEALTH_DATA_CONSENT_SOURCES } from './health-data-consent-sources.ts'

export type RequirementCheck = {
  sourceIdentity: boolean
  locator: boolean
  rights: boolean
  scope: boolean
  boundary: boolean
}

export type PrerequisiteDecision = {
  conceptId: string
  path: string
  siteId: string
  /** Incoming dependency edges, derived from graph v3. Never hard-coded. */
  fanIn: number
  priorState: string
  decision: 'evidence-ready' | 'revise' | 'blocked'
  basis: 'inspected-external-authority' | 'no-inspected-source' | 'first-party-documentation'
  requirements: RequirementCheck
  reason: string
  /** What the decision does and does not reach. */
  clearanceBoundary: string
}

/**
 * The health-data-consent definition, reviewed against the eight inspected
 * authorities.
 *
 * Every requirement is met by sources already inspected and recorded: identity
 * and version for each instrument, a locator per finding, rights for both the
 * CFR and GDPR texts, an actor-and-jurisdiction scope, and a boundary naming
 * what the instrument does not license.
 *
 * The four distinctions the definition must carry are each held by a source
 * that states them, not by assertion:
 *
 *   consent        GDPR Art. 4(11) — freely given, specific, informed, unambiguous
 *   authorization  45 CFR 164.508(a)(1), (c)(1) — a document with required contents
 *   notice         45 CFR 164.520(b)(1)(ii)(E) — notice is not permission
 *   lawful basis   GDPR Art. 6(1)(a)-(f) — consent is one of six
 *
 * Two differences are preserved rather than smoothed:
 *
 *   revocation     GDPR 7(3) is prospective and unconditional; 164.508(b)(5)
 *                  carries reliance and insurance-condition exceptions
 *   emergency use  GDPR 9(2)(c) turns on incapacity; 164.510(b)(3) turns on a
 *                  covered entity's professional judgement
 *
 * Two readings are rejected outright. There is no universal law of health-data
 * consent — every instrument binds a named class of actor in a named
 * jurisdiction, and a device in neither regime is governed by neither. And no
 * executable machine rule follows: "freely given", "professional judgment" and
 * IRB waiver findings are human judgements, and no inspected provision
 * specifies a data structure, receipt format or interface.
 */
export const HEALTH_DATA_CONSENT_DECISION: PrerequisiteDecision = {
  conceptId: 'urn:maha:concept:consent:health-data-consent',
  path: '/knowledge/private-machine-systems/health-data-consent/definition',
  siteId: 'maha-os',
  fanIn: 0, // derived at generation time
  priorState: 'revise',
  decision: 'evidence-ready',
  basis: 'inspected-external-authority',
  requirements: { sourceIdentity: true, locator: true, rights: true, scope: true, boundary: true },
  reason:
    'Eight authorities inspected across two jurisdictions, seventeen findings, each with an exact locator. The ' +
    'definition can distinguish consent from authorization from notice from lawful basis, and can preserve the ' +
    'revocation and emergency-use differences between the regimes, entirely on sources that state those things.',
  clearanceBoundary:
    'This clears one candidate: the health-data-consent definition itself. It confers nothing on the 65 routes ' +
    'that depend on it. Each of those makes its own claims about caregiver access, emergency override, biometric ' +
    'boundaries and the rest, and needs its own inspected sources for them. A definition establishes what a term ' +
    'means; it is not evidence for what any page says using the term.',
}

/**
 * The remaining three, reviewed independently and none cleared.
 *
 * They fail on the same requirement — no inspected source — but for different
 * reasons, and the reasons determine what would fix each.
 */
export const REMAINING_PREREQUISITE_DECISIONS: readonly PrerequisiteDecision[] = [
  {
    conceptId: 'urn:maha:concept:release:agentic-query-letter',
    path: '/agentic-publishing/agentic-query-letter/definition',
    siteId: 'agentic-publishing',
    fanIn: 0,
    priorState: 'revise',
    decision: 'revise',
    basis: 'no-inspected-source',
    requirements: { sourceIdentity: false, locator: false, rights: false, scope: false, boundary: false },
    reason:
      'No implementation of an agentic query letter exists in this repository and no external authority defines ' +
      'the term. lib/agent-inquiries.ts implements a machine-submitted structured inquiry with a review lifecycle, ' +
      'which is a genuinely reusable shape, but it concerns commercial offers: nothing there models a manuscript, ' +
      'a work, an author or a publishing decision. An adjacent implementation is not an implementation of this ' +
      'concept, and treating it as one would turn a proposal into a standard by association.',
    clearanceBoundary:
      'Unchanged at revise. Its seven dependents stay held, and this review adds no evidence to any of them.',
  },
  {
    conceptId: 'urn:maha:concept:autonomy:public-reason',
    path: '/concepts/public-reason/definition',
    siteId: 'mayone-maharajan',
    fanIn: 0,
    priorState: 'revise',
    decision: 'revise',
    basis: 'no-inspected-source',
    requirements: { sourceIdentity: false, locator: false, rights: false, scope: false, boundary: false },
    reason:
      'The candidate is filed as an authorial concept, but "public reason" is an established term in political ' +
      'philosophy. The Stanford Encyclopedia of Philosophy entry (first published 2013-05-20, substantively ' +
      'revised 2022-04-20) defines it as the requirement that rules regulating common life be justifiable to those ' +
      'they bind, and associates it primarily with Rawls, Political Liberalism. A definition on this property is ' +
      'therefore either the established concept, in which case it must cite that literature, or a distinct ' +
      'authorial sense, in which case it must say so and disambiguate. Neither is done, and no source is ' +
      'inspected for either reading.',
    clearanceBoundary:
      'Unchanged at revise. Clearing it requires either an inspected citation to the political-philosophy ' +
      'literature or an explicit statement that the authorial sense differs, with the difference named.',
  },
  {
    conceptId: 'urn:maha:concept:autonomy:machine-civilization',
    path: '/concepts/machine-civilization/definition',
    siteId: 'mayone-maharajan',
    fanIn: 0,
    priorState: 'revise',
    decision: 'revise',
    basis: 'no-inspected-source',
    requirements: { sourceIdentity: false, locator: false, rights: false, scope: false, boundary: false },
    reason:
      'An authorial coinage with no external authority and no implementation in this repository. A first-party ' +
      'definition is the appropriate form, but a first-party definition is only legitimate when it is grounded in ' +
      'something real that it describes, and there is nothing here for it to describe. Writing one now would be a ' +
      'proposal presented as a definition.',
    clearanceBoundary:
      'Unchanged at revise. Clearing it requires either an inspected source or an implementation the definition ' +
      'can be grounded in and cite.',
  },
]

/** A supplementary inspection supporting the public-reason collision finding. */
export const PUBLIC_REASON_COLLISION_SOURCE = {
  sourceId: 'sep-public-reason',
  title: 'Public Reason',
  instrument: 'Stanford Encyclopedia of Philosophy',
  version: 'First published 2013-05-20; substantive revision 2022-04-20',
  retrievedFrom: 'https://plato.stanford.edu/entries/public-reason/',
  retrievedOn: '2026-09-07',
  retrievalStanding: 'secondary-rendering' as const,
  jurisdiction: 'Not jurisdictional — an academic reference work',
  rights:
    'Copyright of the Stanford Encyclopedia of Philosophy and its authors. Cited here by locator with short ' +
    'quotation; not reproduced.',
  scope: 'A survey of the concept in political philosophy, not a normative rule binding anyone.',
  boundary:
    'Establishes that "public reason" is an established term with a substantial literature. It does not establish ' +
    'what this property means by it, and cannot be cited as a definition of an authorial sense.',
  findings: [
    {
      locator: 'Opening definition',
      states:
        'Public reason "requires that the moral or political rules that regulate our common life be, in some ' +
        'sense, justifiable or acceptable to all those persons over whom the rules purport to have authority", and ' +
        'the entry associates the concept primarily with Rawls, Political Liberalism.',
    },
  ],
}

export function allDecisions(): PrerequisiteDecision[] {
  return [HEALTH_DATA_CONSENT_DECISION, ...REMAINING_PREREQUISITE_DECISIONS]
}

/** Distinctions the health-data-consent definition is cleared to draw. */
export const CLEARED_DISTINCTIONS = [
  'consent', 'authorization', 'privacy-notice', 'lawful-basis', 'revocation', 'emergency-use', 'research-consent',
] as const

export const REJECTED_INTERPRETATIONS = [
  'A universal or global law of health-data consent. Every inspected instrument binds a named class of actor in a ' +
    'named jurisdiction; a device in neither regime is governed by neither.',
  'An executable machine rule for consent. "Freely given", "professional judgment" and IRB waiver findings are ' +
    'human judgements, and no inspected provision specifies a data structure, receipt format or interface.',
] as const

export function inspectedAuthorityCount(): number {
  return HEALTH_DATA_CONSENT_SOURCES.length
}
