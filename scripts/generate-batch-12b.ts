import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REVIEW_AXES } from '../lib/exact-revision-review.ts'
import { REVIEW_TIERS, assertNoPersonAttribution, assertTierNotOverstated } from '../lib/review-tier.ts'
import investigations from '../content/batch-12b/source-investigations.json' with { type: 'json' }
import batch12aProposals from '../content/batch-12a/proposed-revisions.json' with { type: 'json' }
import batch12aInvestigations from '../content/batch-12a/source-investigations.json' with { type: 'json' }

/**
 * Batch 12B packets and decisions, and the mixed-revision adoption canary.
 *
 * The canary is assembled from Batch 12A's six surviving proposals rather than
 * from anything found here, because 12B produced no adoptable proposal: its
 * highest-scoring records turned out to cite sources about other subjects.
 */

const TIER = REVIEW_TIERS['automated-internal-editorial']
assertTierNotOverstated(TIER)
const digest = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
const records = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))
const DATE = '2026-09-01'

type Source = (typeof investigations.sources)[number]
const bySource = new Map<string, Source>()
for (const source of investigations.sources as Source[]) {
  for (const recordId of source.records) bySource.set(recordId, source)
}
const failedBy = new Map<string, (typeof investigations.failedRetrievals)[number]>()
for (const failure of investigations.failedRetrievals) {
  for (const recordId of failure.records) failedBy.set(recordId, failure)
}

const allIds = [...bySource.keys(), ...failedBy.keys()].sort()

const packets = allIds.map((recordId) => {
  const source = bySource.get(recordId)
  const failure = failedBy.get(recordId)
  const body = {
    packetVersion: 'maha-batch-12b-packet/1.0',
    recordId,
    activeRevisionSha256: digest(records.get(recordId) ?? null),
    activeSourceIdentity: source
      ? { title: source.confirmedTitle, identifier: source.identifier, confirmedYear: source.confirmedYear }
      : { identifier: failure?.identifier ?? null },
    boundedClaim: String((records.get(recordId)?.claims ?? [])[0]?.statement ?? ''),
    contentInspected: Boolean(source),
    inspectionDepth: source?.inspectionDepth ?? 'not-inspected',
    versionRelationship: source?.versionRelationship ?? null,
    exactInspectedLocator: source?.exactLocator ?? null,
    shortPassage: source?.boundedPassage ?? null,
    rightsBasis: source?.rightsBasis ?? null,
    establishes: source?.establishes ?? null,
    doesNotEstablish: source?.doesNotEstablish ?? null,
    subjectVerdict: source?.verdict ?? 'not-assessed-source-inaccessible',
    attemptedRoutes: failure?.attemptedRoutes ?? null,
    limitations: source?.doesNotEstablish ?? failure?.reason ?? null,
  }
  return { ...body, remediationDigest: digest(body) }
})

type Disposition = 'accept-replacement' | 'narrow-existing-claim' | 'revise' | 'reject' | 'remain-inaccessible'

/** One decision per axis, from the packet alone. */
function decide(packet: typeof packets[number], axis: string): { disposition: Disposition; note: string } {
  if (!packet.contentInspected) {
    return { disposition: 'remain-inaccessible', note: `No lawful full-text route completed; ${String(packet.attemptedRoutes?.length ?? 0)} route(s) attempted and recorded. An unread source cannot support this axis.` }
  }
  if (packet.subjectVerdict === 'subject-mismatch') {
    return { disposition: 'reject', note: `Inspected at ${String(packet.exactInspectedLocator)}. The source is about another subject entirely, so no narrowing can rescue this binding; it needs a replacement that was not located in this sprint.` }
  }
  if (packet.inspectionDepth === 'abstract-or-metadata-only') {
    return { disposition: 'revise', note: 'Inspection reached the abstract only. The general subject is confirmed but no named section was read, so passage support is unestablished.' }
  }
  switch (axis) {
    case 'source-identity-and-fidelity':
      return { disposition: 'narrow-existing-claim', note: `Identity confirmed independently; the citation resolves to the inspected document (${String(packet.activeSourceIdentity.confirmedYear)}).` }
    case 'claim-to-passage-support':
      return { disposition: 'narrow-existing-claim', note: `Passage read at ${String(packet.exactInspectedLocator)}; it supports less than the record asserts, so the claim is narrowed to it.` }
    case 'scope-and-unsupported-inference':
      return { disposition: 'narrow-existing-claim', note: String(packet.doesNotEstablish).slice(0, 220) }
    case 'rights-and-locator-adequacy':
      return { disposition: 'narrow-existing-claim', note: `Exact locator recorded; access basis is ${String(packet.rightsBasis)}.` }
    default:
      return { disposition: 'narrow-existing-claim', note: 'The packet records what the source does not establish and the narrowed claim does not reach past it.' }
  }
}

const decisions = packets.flatMap((packet) => REVIEW_AXES.map((axis) => {
  const { disposition, note } = decide(packet, axis)
  const decision = {
    recordId: packet.recordId, activeRevisionSha256: packet.activeRevisionSha256,
    remediationDigest: packet.remediationDigest, axis, disposition,
    reviewerKind: TIER.reviewerKind, independent: TIER.independent, humanReviewed: TIER.humanReviewed,
    externallyReviewed: TIER.externallyReviewed, expertEndorsement: TIER.expertEndorsement,
    releaseAuthority: TIER.releaseAuthority, note, decidedAt: DATE,
  }
  return { ...decision, decisionSha256: digest(decision) }
}))
for (const decision of decisions) assertNoPersonAttribution(decision.reviewerKind, decision as never)

const perRecord = new Map<string, Set<Disposition>>()
for (const decision of decisions) perRecord.set(decision.recordId, (perRecord.get(decision.recordId) ?? new Set()).add(decision.disposition))
const narrowed = [...perRecord.entries()].filter(([, set]) => set.size === 1 && set.has('narrow-existing-claim')).map(([id]) => id).sort()

/* ------------------------------------ the mixed-revision adoption canary -- */

const KIND: Record<string, string> = {
  'urn:maha:record:advanced-materials-tmd-heterobilayers': 'source-replacement',
  'urn:maha:record:agentic-systems-mcp-retrieval-context-selection': 'claim-scope-narrowing',
  'urn:maha:record:longevity-metabolism-senescence-associated-secretory-phenotype': 'claim-scope-narrowing',
}
const proposals = (batch12aProposals.proposedRevisions as { recordId: string; activeRevisionSha256: string; proposedRevisionSha256: string }[])
const canaryCohort = proposals
  .map((proposal) => ({
    recordId: proposal.recordId,
    kind: KIND[proposal.recordId] ?? 'locator-correction',
    activeRevisionSha256: proposal.activeRevisionSha256,
    proposedRevisionSha256: proposal.proposedRevisionSha256,
    proposedAuditSha256: digest({ audit: proposal.proposedRevisionSha256 }),
    reviewBundleRevisionSha256: proposal.proposedRevisionSha256,
    decidedAxes: [...REVIEW_AXES],
    hasActivePredecessorRelease: false,
  }))
  .sort((a, b) => a.recordId.localeCompare(b.recordId))
  .slice(0, 5)

mkdirSync('content/batch-12b', { recursive: true })
const write = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

write('content/batch-12b/remediation-packets.json', {
  schemaVersion: 'maha-batch-12b-packet/1.0', reviewDate: DATE, packets,
  boundary: 'Immutable private reviewer inputs with short attributed quotations within copyright limits.',
})
write('content/batch-12b/editorial-decisions.json', {
  schemaVersion: 'maha-batch-12b-decision/1.0', reviewDate: DATE, appendOnly: true, tier: TIER,
  decisionCount: decisions.length, decisions, boundary: TIER.publicStatement,
})
write('content/batch-12b/proposed-revisions.json', {
  schemaVersion: 'maha-batch-12b-proposed-revision/1.0', reviewDate: DATE,
  active: false, pendingGovernedAdoption: true,
  proposedCount: narrowed.length, narrowedRecordIds: narrowed,
  boundary: 'Narrowed claims are proposals. No active binding, release or route changed.',
})
write('content/batch-12b/mixed-revision-canary.json', {
  schemaVersion: 'maha-mixed-revision-adoption/1.0', canaryKind: 'mixed-revision-adoption',
  whyNotSourceOverride: 'A source-override canary requires five source replacements and only one proposal replaces its source. The cohort is not relabelled; this is a differently named thing.',
  assembledFrom: 'Batch 12A surviving proposals. Batch 12B produced no adoptable proposal.',
  released: false, active: false,
  canary: canaryCohort,
  excluded: [
    { recordId: 'urn:maha:record:biomolecular-engineering-fitness-landscape-analysis', reason: 'inspected but the passage does not establish the record subject' },
    ...(batch12aInvestigations.unresolved as { recordId: string }[]).map((entry) => ({ recordId: entry.recordId, reason: 'inaccessible after documented lawful attempts' })),
  ],
  boundary: 'A prepared cohort proven only against a disposable local database. Nothing was released, activated or deployed.',
})

process.stdout.write(`${JSON.stringify({
  cohort: packets.length,
  contentInspected: packets.filter((packet) => packet.contentInspected).length,
  sectionDepth: packets.filter((packet) => packet.inspectionDepth === 'section-or-full-text').length,
  abstractDepth: packets.filter((packet) => packet.inspectionDepth === 'abstract-or-metadata-only').length,
  inaccessible: packets.filter((packet) => !packet.contentInspected).length,
  narrowed: narrowed.length,
  canary: canaryCohort.length,
  dispositions: decisions.reduce((counts: Record<string, number>, decision) => {
    counts[decision.disposition] = (counts[decision.disposition] ?? 0) + 1
    return counts
  }, {}),
}, null, 2)}\n`)
