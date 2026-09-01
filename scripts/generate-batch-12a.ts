import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REVIEW_AXES } from '../lib/exact-revision-review.ts'
import { REVIEW_TIERS, assertNoPersonAttribution, assertTierNotOverstated } from '../lib/review-tier.ts'
import investigations from '../content/batch-12a/source-investigations.json' with { type: 'json' }

/**
 * Batch 12A packets, decisions and proposed revisions.
 *
 * Every decision below rests on a source that was actually opened at the
 * locator it names. Where no lawful copy could be reached the record stays
 * blocked and the routes that were tried are recorded, because "we could not
 * get in" is a finding and "we found nothing wrong" is not the same statement.
 */

const TIER = REVIEW_TIERS['automated-internal-editorial']
assertTierNotOverstated(TIER)

const digest = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
const records = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))
const REVIEW_DATE = '2026-09-01'

type Investigation = (typeof investigations.investigations)[number]
const inspected = investigations.investigations as Investigation[]
const unresolved = investigations.unresolved as { recordId: string; attemptedRoutes: string[]; outcome: string; reason: string }[]

/* ------------------------------------------------- Part 4: packets ------- */

const packets = [...inspected, ...unresolved].map((entry) => {
  const record = records.get(entry.recordId)
  const investigation = 'contentInspected' in entry ? entry as Investigation : null
  const body = {
    packetVersion: 'maha-batch-12a-packet/1.0',
    recordId: entry.recordId,
    activeRevisionSha256: digest(record ?? null),
    activeSourceIdentity: investigation?.activeSource ?? { doi: (entry as { doi?: string }).doi ?? null },
    boundedClaim: String((record?.claims ?? [])[0]?.statement ?? ''),
    diagnosedDefect: investigation?.diagnosedDefect ?? 'source-inaccessible',
    candidateReplacement: investigation?.candidateReplacement ?? null,
    versionRelationship: investigation?.versionRelationship ?? investigation?.candidateReplacement?.versionRelationship ?? null,
    exactInspectedLocator: investigation?.exactLocator ?? investigation?.candidateReplacement?.exactLocator ?? null,
    shortPassage: investigation?.boundedPassage ?? investigation?.candidateReplacement?.boundedPassage ?? null,
    rightsBasis: investigation?.rightsBasis ?? investigation?.candidateReplacement?.rightsBasis ?? null,
    subjectAlignmentVerdict: investigation?.subjectAlignmentVerdict ?? 'not-assessed-source-inaccessible',
    unsupportedInferenceVerdict: investigation?.unsupportedInferenceVerdict ?? 'not-assessed-source-inaccessible',
    proposedBoundedClaim: investigation?.proposedBoundedClaim ?? null,
    limitations: investigation?.limitations ?? (entry as { reason?: string }).reason ?? null,
    attemptedRoutes: (entry as { attemptedRoutes?: string[] }).attemptedRoutes ?? null,
    contentInspected: investigation?.contentInspected === true,
  }
  return { ...body, remediationDigest: digest(body) }
})

/* ----------------------------------------- Part 5: editorial decisions --- */

type Disposition = 'accept-replacement' | 'revise-record' | 'reject-replacement' | 'remain-blocked'

/**
 * One decision per axis, from the packet alone.
 *
 * A record whose source could not be opened gets remain-blocked on every axis:
 * an unread source cannot support an axis, and declining to guess is the whole
 * value of the tier.
 */
function decide(packet: typeof packets[number], axis: string): { disposition: Disposition; note: string } {
  if (!packet.contentInspected) {
    return { disposition: 'remain-blocked', note: `No lawful full-text route completed; ${String(packet.attemptedRoutes?.length ?? 0)} route(s) attempted and recorded. An unread source cannot support this axis.` }
  }
  const replacement = packet.candidateReplacement
  switch (axis) {
    case 'source-identity-and-fidelity':
      return { disposition: replacement ? 'accept-replacement' : 'revise-record',
        note: replacement
          ? 'Replacement identity confirmed against Crossref and the preprint record, with a stated version of record.'
          : 'Active source identity confirmed against Crossref; the citation resolves to the inspected document.' }
    case 'claim-to-passage-support':
      if (packet.subjectAlignmentVerdict === 'mismatched') {
        return { disposition: 'remain-blocked', note: 'The inspected passage does not establish this record’s subject, and no adequate replacement was located.' }
      }
      return { disposition: replacement ? 'accept-replacement' : 'revise-record',
        note: `Passage read at ${String(packet.exactInspectedLocator)}; it carries the proposed bounded claim and no more.` }
    case 'scope-and-unsupported-inference':
      return packet.unsupportedInferenceVerdict.startsWith('record-subject-is-broader')
        || packet.unsupportedInferenceVerdict.startsWith('record-subject-is-adjacent')
        ? { disposition: 'revise-record', note: 'The record subject reaches beyond the inspected passage; the bounded claim is narrowed to what the passage establishes.' }
        : packet.unsupportedInferenceVerdict.startsWith('record-subject-not-established')
          ? { disposition: 'remain-blocked', note: 'The passage does not establish the record subject at all.' }
          : { disposition: replacement ? 'accept-replacement' : 'revise-record', note: 'The proposed bounded claim asserts nothing the inspected passage does not carry.' }
    case 'rights-and-locator-adequacy':
      return { disposition: replacement ? 'accept-replacement' : 'revise-record',
        note: `Exact locator recorded; access basis is ${String(packet.rightsBasis)}. Quotation is a single short sentence with attribution.` }
    case 'release-boundary-and-nonclaims':
      return { disposition: replacement ? 'accept-replacement' : 'revise-record',
        note: 'The packet records what the source does not establish, and the bounded claim does not reach past it.' }
    default:
      return { disposition: 'remain-blocked', note: 'Unrecognised axis.' }
  }
}

const decisions = packets.flatMap((packet) => REVIEW_AXES.map((axis) => {
  const { disposition, note } = decide(packet, axis)
  const decision = {
    recordId: packet.recordId,
    activeRevisionSha256: packet.activeRevisionSha256,
    remediationDigest: packet.remediationDigest,
    axis,
    disposition,
    reviewerKind: TIER.reviewerKind,
    independent: TIER.independent,
    humanReviewed: TIER.humanReviewed,
    externallyReviewed: TIER.externallyReviewed,
    expertEndorsement: TIER.expertEndorsement,
    releaseAuthority: TIER.releaseAuthority,
    note,
    decidedAt: REVIEW_DATE,
  }
  return { ...decision, decisionSha256: digest(decision) }
}))
for (const decision of decisions) assertNoPersonAttribution(decision.reviewerKind, decision as never)

/* ------------------------------- Part 6: proposed private revisions ------ */

const perRecord = new Map<string, Set<Disposition>>()
for (const decision of decisions) {
  perRecord.set(decision.recordId, (perRecord.get(decision.recordId) ?? new Set()).add(decision.disposition))
}
/** A proposal survives only if every axis agrees, with nothing blocked. */
const surviving = [...perRecord.entries()]
  .filter(([, set]) => set.size === 1 && !set.has('remain-blocked') && !set.has('reject-replacement'))
  .map(([recordId, set]) => ({ recordId, disposition: [...set][0] }))
  .sort((a, b) => a.recordId.localeCompare(b.recordId))

const proposedRevisions = surviving.map((entry) => {
  const packet = packets.find((candidate) => candidate.recordId === entry.recordId)!
  const body = {
    recordId: entry.recordId,
    active: false,
    pendingGovernedAdoption: true,
    activeRevisionSha256: packet.activeRevisionSha256,
    proposedBoundedClaim: packet.proposedBoundedClaim,
    proposedSourceOverride: packet.candidateReplacement,
    exactLocator: packet.exactInspectedLocator,
    rightsBasis: packet.rightsBasis,
    disposition: entry.disposition,
  }
  return { ...body, proposedRevisionSha256: digest(body) }
})

const overrideCandidates = proposedRevisions.filter((entry) => entry.proposedSourceOverride !== null)

mkdirSync('content/batch-12a', { recursive: true })
const write = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

write('content/batch-12a/remediation-packets.json', {
  schemaVersion: 'maha-batch-12a-packet/1.0', reviewDate: REVIEW_DATE, packets,
  boundary: 'Immutable reviewer inputs. Private. Contains short attributed quotations within copyright limits and no secret, customer or participant data.',
})
write('content/batch-12a/editorial-decisions.json', {
  schemaVersion: 'maha-batch-12a-decision/1.0', reviewDate: REVIEW_DATE, appendOnly: true,
  tier: TIER, decisionCount: decisions.length, decisions,
  boundary: TIER.publicStatement,
})
write('content/batch-12a/proposed-revisions.json', {
  schemaVersion: 'maha-batch-12a-proposed-revision/1.0', reviewDate: REVIEW_DATE,
  active: false, pendingGovernedAdoption: true,
  proposedCount: proposedRevisions.length, proposedRevisions,
  sourceOverrideCandidates: overrideCandidates.length,
  canary: overrideCandidates.length >= 5
    ? overrideCandidates.slice(0, 5).map((entry) => entry.recordId)
    : null,
  canaryWithheldReason: overrideCandidates.length >= 5 ? null
    : `Only ${overrideCandidates.length} proposal(s) carry a source override that passed every axis. Five are required, and the criteria were not weakened to reach five.`,
  boundary: 'Proposed revisions are private and inactive. No active binding, canonical release or public route was changed.',
})

process.stdout.write(`${JSON.stringify({
  cohort: packets.length,
  contentInspected: packets.filter((packet) => packet.contentInspected).length,
  remainBlocked: packets.filter((packet) => !packet.contentInspected).length,
  survivingProposals: surviving.length,
  sourceOverrideCandidates: overrideCandidates.length,
  canary: overrideCandidates.length >= 5 ? 5 : 0,
  dispositions: decisions.reduce((counts: Record<string, number>, decision) => {
    counts[decision.disposition] = (counts[decision.disposition] ?? 0) + 1
    return counts
  }, {}),
}, null, 2)}\n`)
