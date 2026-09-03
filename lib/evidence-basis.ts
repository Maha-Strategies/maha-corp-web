import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'

/**
 * What kind of authority an evidence source carries, separately from how deep
 * the page using it is.
 *
 * Ten batches have used one label, "independently supported", for everything
 * that passed the gate. That label carries a scientific meaning: someone other
 * than the subject examined it and could have found otherwise. It fits a
 * peer-reviewed paper and a government measurement standard. It does not fit a
 * primary religious text, which establishes what an edition says and nothing
 * about whether the events it describes occurred.
 *
 * Forcing a textual page through a scientific-independence label to pass a gate
 * would be the same substitution this programme has refused everywhere else,
 * so the basis is named separately and the gate reads the basis.
 */

export const EVIDENCE_BASES = [
  'independent-scientific-or-technical',
  'government-or-standards-authority',
  'first-party-documentation',
  'primary-textual',
  'secondary-historical-scholarship',
  'formal-mathematical',
  'metadata-only',
  'inaccessible-or-unsupported',
] as const
export type EvidenceBasis = (typeof EVIDENCE_BASES)[number]

/** What each basis can and cannot establish. */
export const BASIS_CONTRACT: Record<EvidenceBasis, {
  establishes: string
  cannotEstablish: readonly string[]
  countsAsIndependentSupport: boolean
}> = {
  'independent-scientific-or-technical': {
    establishes: 'A finding examined by someone other than its subject, who could have reported otherwise.',
    cannotEstablish: ['anything outside the study stated scope'],
    countsAsIndependentSupport: true,
  },
  'government-or-standards-authority': {
    establishes: 'A definition, method or requirement published by a standards or government body.',
    cannotEstablish: ['that any particular implementation conforms', 'measured performance of any product'],
    countsAsIndependentSupport: true,
  },
  'first-party-documentation': {
    establishes: 'What an organisation publishes about its own products, services or declared capabilities.',
    cannotEstablish: ['superiority', 'independent reliability', 'measured yield', 'industry adoption', 'comparative advantage'],
    countsAsIndependentSupport: false,
  },
  'primary-textual': {
    establishes: 'What a named edition or translation says at a named locator.',
    cannotEstablish: ['that described events occurred', 'empirical efficacy', 'theological truth', 'metaphysical reality'],
    countsAsIndependentSupport: false,
  },
  'secondary-historical-scholarship': {
    establishes: 'A historian argument about what happened, with their evidence and reasoning.',
    cannotEstablish: ['theological truth', 'empirical efficacy', 'that the argument is settled'],
    countsAsIndependentSupport: true,
  },
  'formal-mathematical': {
    establishes: 'A theorem at exactly the scope its statement declares.',
    cannotEstablish: ['any empirical claim', 'a prose claim broader than the theorem'],
    countsAsIndependentSupport: true,
  },
  'metadata-only': {
    establishes: 'That a record exists with a title, author and identifier.',
    cannotEstablish: ['anything the source says'],
    countsAsIndependentSupport: false,
  },
  'inaccessible-or-unsupported': {
    establishes: 'Nothing.',
    cannotEstablish: ['anything'],
    countsAsIndependentSupport: false,
  },
}

/** Bases that may carry an explanatory claim on a public page. */
export function isExplanatoryBasis(basis: EvidenceBasis): boolean {
  return basis !== 'metadata-only' && basis !== 'inaccessible-or-unsupported'
}

/**
 * The public page state a basis maps to.
 *
 * Primary textual and secondary historical evidence get their own state rather
 * than being folded into the scientific one, because a reader deserves to know
 * which kind of thing is standing behind the page.
 */
export type PublicEvidenceState =
  | 'independently-source-supported'
  | 'textually-source-supported'
  | 'first-party-documented'
  | 'structurally-uplifted'
  | 'blocked'

export function publicStateFor(basis: EvidenceBasis): PublicEvidenceState {
  switch (basis) {
    case 'independent-scientific-or-technical':
    case 'government-or-standards-authority':
    case 'formal-mathematical':
      return 'independently-source-supported'
    case 'primary-textual':
    case 'secondary-historical-scholarship':
      return 'textually-source-supported'
    case 'first-party-documentation':
      return 'first-party-documented'
    default:
      return 'structurally-uplifted'
  }
}

export class FrameTransferError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'FrameTransferError'
  }
}

export type ClaimKind = 'textual' | 'historical' | 'theological' | 'empirical' | 'first-person' | 'technical' | 'formal'

const CARRIES: Record<EvidenceBasis, readonly ClaimKind[]> = {
  'independent-scientific-or-technical': ['empirical', 'technical'],
  'government-or-standards-authority': ['technical'],
  'first-party-documentation': ['first-person'],
  'primary-textual': ['textual'],
  'secondary-historical-scholarship': ['historical', 'textual'],
  'formal-mathematical': ['formal'],
  'metadata-only': [],
  'inaccessible-or-unsupported': [],
}

/**
 * Refuses a claim a basis cannot carry.
 *
 * The cases this corpus would actually be tempted by: a scripture cited for a
 * historical event, a vendor page cited for reliability, a theorem cited for an
 * empirical effect. No basis carries a theological claim at all.
 */
export function assertBasisCanCarry(basis: EvidenceBasis, claimKind: ClaimKind): void {
  if (!CARRIES[basis].includes(claimKind)) {
    throw new FrameTransferError('frame-transfer-refused',
      `${basis} evidence cannot carry a ${claimKind} claim. ${BASIS_CONTRACT[basis].establishes}`)
  }
}

export function basisDigest(basis: EvidenceBasis, locator: string): string {
  return `sha256:${createHash('sha256').update(canonicalJson({ basis, locator }), 'utf8').digest('hex')}`
}
