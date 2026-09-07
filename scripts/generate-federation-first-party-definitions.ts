/**
 * Emits the first-party definition artifact.
 *
 * Twenty-nine definitions reached Tranche 18 blocked on source inspection.
 * Seventeen are Maha's own operational concepts and are defined in
 * lib/federation/first-party-definitions.ts. Twelve have real external
 * authorities and are deliberately left blocked — recorded here as refusals so
 * a later reader sees a decision rather than an omission.
 */
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import {
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
    'could reach evidence-ready because a definition needs an inspected source like any other claim. For 17 of ' +
    'them no external source exists, because the concepts are this organisation\'s own. Those are written here as ' +
    'first-party definitions. The remaining 12 are established concepts with real authorities and are not written.',
  basis: FIRST_PARTY_BASIS,
  counts: {
    blockedDefinitionsAtTranche18: FIRST_PARTY_DEFINITIONS.length + EXTERNAL_AUTHORITY_REQUIRED.length,
    written: FIRST_PARTY_DEFINITIONS.length,
    refusedPendingExternalAuthority: EXTERNAL_AUTHORITY_REQUIRED.length,
  },
  definitions: FIRST_PARTY_DEFINITIONS,
  refusals: EXTERNAL_AUTHORITY_REQUIRED.map((r) => ({
    ...r,
    reason:
      'An established concept with a real external authority. A first-party definition here would manufacture ' +
      'authority rather than cite it. Remains blocked pending inspection of the named authority.',
  })),
  whatThisDoesNotDo: [
    'It does not make the 17 concepts evidence-ready on its own. Each definition must still be reviewed, and the ' +
      'pages depending on it still need their own sources for their own claims.',
    'It does not upgrade the basis of any page. A page citing a first-party definition may say what Maha means by ' +
      'a term; it may not present that as what the field holds.',
    'It does not unblock the 12 refused concepts, and is not intended to.',
  ],
}

writeFileSync(
  `${OUT}/federation-first-party-definitions-v1.json`,
  `${JSON.stringify({ ...body, provenanceDigest: digest(canonicalJson(body)) }, null, 2)}\n`,
)
console.log(`wrote ${body.counts.written} definitions, ${body.counts.refusedPendingExternalAuthority} refusals`)
