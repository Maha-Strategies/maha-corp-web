import { createHash } from 'node:crypto'

/**
 * Dispositions available for one unsupported public assertion.
 *
 * Every one of them preserves the sentence in some form except
 * `remove-pending-review`, which withdraws it for a human decision rather than
 * deleting it. Nothing here silently rewrites what the site has already said.
 */
export const DISPOSITIONS = [
  'inspect-current-source',
  'locate-replacement-source',
  'narrow',
  'split',
  'reframe-as-limitation',
  'remove-pending-review',
  'retain-as-clearly-labelled-interpretation',
  'retain-blocked',
] as const
export type Disposition = (typeof DISPOSITIONS)[number]

export const ASSERTION_TYPES = [
  'definitional', 'procedural-step', 'empirical-assertion', 'taxonomic-entry',
] as const
export type AssertionType = (typeof ASSERTION_TYPES)[number]

export interface AssertionRecord {
  assertionId: string
  route: string
  pageRevision: string
  /** A fingerprint, not the sentence. Enough to find it, not to republish it. */
  textFingerprint: string
  textPreview: string
  assertionType: AssertionType
  currentSourceIds: readonly string[]
  currentLocator: string | null
  evidentiaryFrame: string
  whySupportIsMissing: string
  narrowingCouldSupport: boolean
  removalChangesCentralMeaning: boolean
  disposition: Disposition
}

export function fingerprint(route: string, text: string): string {
  return `sha256:${createHash('sha256').update(`${route} ${text}`, 'utf8').digest('hex')}`
}

/**
 * Choose a disposition from what is actually known about the assertion.
 *
 * A cited-but-unread source is the commonest case here and has an obvious next
 * step, so it is separated from the case where no source exists at all. The
 * difference matters: one is work not yet done, the other is a gap.
 */
export function recommendDisposition(input: {
  assertionType: AssertionType
  hasCitedSource: boolean
  sourceInspected: boolean
  centralToPage: boolean
}): { disposition: Disposition; because: string } {
  if (input.assertionType === 'taxonomic-entry') {
    return { disposition: 'retain-as-clearly-labelled-interpretation',
      because: 'A category name in a list asserts nothing that could be unsupported.' }
  }
  if (input.hasCitedSource && !input.sourceInspected) {
    return { disposition: 'inspect-current-source',
      because: 'The page already cites a source for this. Reading it is the cheapest way to find out whether the sentence is supported, and it has not been done.' }
  }
  if (!input.hasCitedSource && input.assertionType === 'procedural-step') {
    return { disposition: 'reframe-as-limitation',
      because: 'A procedure with no source reads as received practice. Presenting it as the page own working method removes the false authority without losing the content.' }
  }
  if (!input.hasCitedSource && input.assertionType === 'definitional') {
    return { disposition: 'narrow',
      because: 'A definition with no source can stand as this page stated usage rather than as the field settled definition.' }
  }
  if (input.centralToPage) {
    return { disposition: 'locate-replacement-source',
      because: 'Central to the page, so withdrawing it would gut the page. It needs a source rather than a narrower scope.' }
  }
  return { disposition: 'remove-pending-review',
    because: 'Not central, unsourced, and not reframable without changing what it says. Withdrawn for a human decision rather than quietly kept.' }
}
