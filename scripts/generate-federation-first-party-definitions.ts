/**
 * Emits the first-party definition artifact.
 *
 * Twenty-nine definitions reached Tranche 18 blocked on source inspection.
 * Fifteen are Maha's own operational concepts and are defined in
 * lib/federation/first-party-definitions.ts. Two name practices nothing
 * implements and are deferred. Twelve have real external authorities and are
 * refused. All three groups are recorded here, so a later reader sees three
 * decisions rather than one list and two omissions.
 */
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import {
  DEFERRED_PENDING_IMPLEMENTATION,
  EXTERNAL_AUTHORITY_REQUIRED,
  FIRST_PARTY_BASIS,
  FIRST_PARTY_DEFINITIONS,
} from '../lib/federation/first-party-definitions.ts'

const OUT = 'content/federation'
const digest = (s: string) => `sha256:${createHash('sha256').update(s, 'utf8').digest('hex')}`

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

const body = {
  artifact: 'federation-first-party-definitions',
  version: 'v1',
  writtenOn: '2026-09-07',
  situation:
    'Tranche 18 completed review of the full 1,660-candidate map. Of the 29 definitions added in map v3, none ' +
    'could reach evidence-ready because a definition needs an inspected source like any other claim. Fifteen are ' +
    'this organisation\'s own operational concepts, for which no external source exists, and are written here. Two ' +
    'name practices that nothing in the codebase implements and are deferred rather than described as though they ' +
    'ran. Twelve are established concepts with real external authorities and are refused.',
  review:
    'The first draft of this artifact defined 17 concepts. Review against the implementations withdrew two and ' +
    'corrected four: conflicting-literature and source-recovery had no implementation; delivery-acknowledgement ' +
    'cited the x402 ledger, which states three times that it does not establish delivery; uncertainty-recording ' +
    'claimed a per-claim judgement where the code offers a per-basis lookup; claim-intake claimed to separate a ' +
    'passage into claims, which nothing does; and three locators named symbols their cited file only imports. ' +
    'Each definition now carries supportsDefinitionBecause, a stated judgement that its locator bears it.',
  basis: FIRST_PARTY_BASIS,
  counts: {
    blockedDefinitionsAtTranche18:
      FIRST_PARTY_DEFINITIONS.length + DEFERRED_PENDING_IMPLEMENTATION.length + EXTERNAL_AUTHORITY_REQUIRED.length,
    written: FIRST_PARTY_DEFINITIONS.length,
    deferredPendingImplementation: DEFERRED_PENDING_IMPLEMENTATION.length,
    refusedPendingExternalAuthority: EXTERNAL_AUTHORITY_REQUIRED.length,
  },
  definitions: FIRST_PARTY_DEFINITIONS,
  deferred: DEFERRED_PENDING_IMPLEMENTATION,
  refusals: EXTERNAL_AUTHORITY_REQUIRED.map((r) => ({
    ...r,
    reason:
      'An established concept with a real external authority. A first-party definition here would manufacture ' +
      'authority rather than cite it. Remains blocked pending inspection of the named authority.',
  })),
  whatThisDoesNotDo: [
    'It does not make the 15 concepts evidence-ready on its own. Each definition must still be reviewed, and the ' +
      'pages depending on it still need their own sources for their own claims.',
    'It does not upgrade the basis of any page. A page citing a first-party definition may say what Maha means by ' +
      'a term; it may not present that as what the field holds.',
    'It does not unblock the 12 refused concepts, and is not intended to.',
    'It does not verify that any locator bears the definition citing it. supportsDefinitionBecause is a stated ' +
      'judgement a reviewer can disagree with; the automated check confirms only that a file exists and that a ' +
      'named symbol is declared in it.',
  ],
}

writeFileSync(
  `${OUT}/federation-first-party-definitions-v1.json`,
  `${JSON.stringify({ ...body, provenanceDigest: digest(canonicalJson(body)) }, null, 2)}\n`,
)
console.log(
  `wrote ${body.counts.written} definitions, deferred ${body.counts.deferredPendingImplementation}, ` +
  `refused ${body.counts.refusedPendingExternalAuthority}`,
)
