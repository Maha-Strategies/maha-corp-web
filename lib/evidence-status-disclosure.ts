/**
 * What a reader is told about the evidence behind a page.
 *
 * The corpus contains pages that carry every mark of a well-sourced article --
 * explanatory claims, stated limitations, a mechanism section, citations in the
 * margin -- and rest on sources nobody has opened. From the outside those pages
 * are indistinguishable from the ones that were checked, and that
 * indistinguishability is the problem this states out loud.
 *
 * Two rules shape the wording below.
 *
 * It does not call the content false. Nothing here has been shown to be wrong;
 * it has not been shown to be right either, and saying the first when you mean
 * the second is its own dishonesty.
 *
 * It appears on supported pages too. A warning that renders only on weak pages
 * makes silence ambiguous -- a reader cannot tell a checked page from one where
 * the banner failed to render. Saying which it is in both cases is what makes
 * either statement worth reading.
 */

export const EVIDENCE_STATUSES = [
  'independently-supported',
  'cited-but-uninspected',
  'first-party-documented',
] as const
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number]

export interface EvidenceStatusDisclosure {
  status: EvidenceStatus
  headline: string
  detail: string
  useFor: string
  doNotUseFor: string | null
}

/**
 * Build the disclosure for one page.
 *
 * Derived from counts the compiler already produces, so a page that gains an
 * inspected source loses the caveat on the next regeneration. Nothing here is
 * written per route, and there is no list of pages to keep in step.
 */
export function disclosureFor(input: {
  citedSourceCount: number
  inspectedSourceCount: number
  isFirstParty: boolean
}): EvidenceStatusDisclosure {
  if (input.isFirstParty) {
    return {
      status: 'first-party-documented',
      headline: 'Rests on the organisation\u2019s own published documentation',
      detail: 'The technical statements here come from documents the organisation publishes about itself. They were read and recorded, so what the company says is accurately reported.',
      useFor: 'What an organisation states about its own products, services and declared scope.',
      doNotUseFor: 'Measured performance, reliability, yield, adoption, or any comparison with another supplier. A company describing itself is not an independent test of it.',
    }
  }

  if (input.inspectedSourceCount > 0) {
    const n = input.inspectedSourceCount
    return {
      status: 'independently-supported',
      headline: `Checked against ${n} inspected ${n === 1 ? 'source' : 'sources'}`,
      detail: `${n === 1 ? 'One source was' : `${n} sources were`} retrieved, identified and read, and the claims below are tied to specific passages at the scope those passages state. Each source also records what it cannot establish.`,
      useFor: 'The specific claims that carry a cited passage, at the scope that passage states.',
      doNotUseFor: null,
    }
  }

  const n = input.citedSourceCount
  return {
    status: 'cited-but-uninspected',
    headline: n > 0
      ? `Cites ${n} ${n === 1 ? 'source' : 'sources'}, none of which has been read`
      : 'No source has been inspected for this page',
    detail: n > 0
      ? `The ${n === 1 ? 'source is' : 'sources are'} named, but ${n === 1 ? 'it has' : 'none has'} been retrieved and read as part of building this page. Nothing here has been matched to a passage, so the citations show where a reader might look rather than what was checked.`
      : 'Nothing on this page has been matched to a source passage.',
    useFor: 'Orientation: how the topic is organised, which terms matter, and where to start reading.',
    doNotUseFor: 'A claim you intend to act on or repeat. Follow the cited material yourself first.',
  }
}

/** A disclosure carries no audit internals. Enforced rather than intended. */
export const FORBIDDEN_IN_PUBLIC_DISCLOSURE = [
  'risk', 'riskFactors', 'disposition', 'dispositionBecause', 'assertionId',
  'whySupportIsMissing', 'remediation', 'proposedRevision', 'textFingerprint',
  'narrowedForm', 'reviewRationale',
] as const

export function assertNoAuditInternals(payload: unknown): void {
  const text = JSON.stringify(payload)
  for (const term of FORBIDDEN_IN_PUBLIC_DISCLOSURE) {
    if (text.includes(term)) {
      throw new Error(`A public disclosure must not carry the audit field ${term}.`)
    }
  }
}
