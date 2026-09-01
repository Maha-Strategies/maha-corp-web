import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import { alignmentBlockers, alignmentFor } from '../lib/frontier-source-alignment.ts'
import { classifyInspectionDepth, supportsPassageAxis } from '../lib/inspection-depth.ts'
import { isPilotAlignmentClear, pilotAlignmentFor } from '../lib/pilot-source-alignment.ts'
import { BATCH_11_DECISIONS } from '../lib/frontier-alignment-batch-11-review.ts'
import {
  REVIEW_AXES, classifyForRelease, projectReviewState, releaseAuthorized,
  type AxisDecision, type AxisRecord, type ReviewAxis,
} from '../lib/exact-revision-review.ts'
import { REVIEW_TIERS, assertMachineReviewerPermitted, assertNoPersonAttribution, assertTierNotOverstated } from '../lib/review-tier.ts'
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }

/**
 * Projects review state, reviews what is reviewable, and queues what passes.
 *
 * The review below is internal-editorial and automated. It is not independent,
 * it is not expert endorsement, and it decides only what the committed evidence
 * can actually settle. Where the evidence cannot settle an axis, the axis gets
 * revise rather than a benefit of the doubt.
 */

const TIER = REVIEW_TIERS['automated-internal-editorial']
assertTierNotOverstated(TIER)
assertMachineReviewerPermitted(TIER.reviewerKind)

const digest = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`

const active = observation.releases.filter((entry) => entry.status === 'active')
const released = new Set(active.map((entry) => entry.recordId))
const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((record) => [record.id, record]))
const clear = (id: string) => pilotAlignmentFor(id) ? isPilotAlignmentClear(id) : alignmentBlockers(id).length === 0
const cohort = [...records.keys()].filter((id) => clear(id) && !released.has(id)).sort()

/* ------------------------------------------------ existing decisions ----- */

/**
 * Decisions the repository already holds, mapped onto the axis contract.
 *
 * The Batch 11 corpus records one disposition per record rather than one per
 * axis. A reject-or-hold is unambiguous whatever axis it was reached on, so it
 * is projected across all five; an approval is not, and is deliberately not
 * widened the same way.
 */
const existing = new Map<string, (AxisRecord & { revisionSha256: string })[]>()
for (const decision of BATCH_11_DECISIONS) {
  if (!cohort.includes(decision.recordId)) continue
  if (decision.disposition !== 'reject-or-hold') continue
  const revision = String((decision.recordRevision as Record<string, string>).recordDigest)
  existing.set(decision.recordId, REVIEW_AXES.map((axis) => ({
    axis,
    decision: 'reject' as AxisDecision,
    reviewerKind: 'automated-internal-editorial' as const,
    decisionSha256: decision.packetDigest,
    note: 'Held by the Batch 11 alignment review; not authorized for canonical release.',
    revisionSha256: revision,
  })))
}

/* --------------------------------------------------- reviewer packets ---- */

interface Packet {
  packetVersion: string
  recordId: string
  revisionSha256: string
  auditSha256: string
  title: string
  claims: { statement: string; scope: string; boundary: string; claimKind: string; evidenceMaturity: string }[]
  source: { title: string; identifier: string; exactLocator: string; rightsBasis: string; quotationUsed: boolean }
  alignment: { subjectAligned: string; assignmentOrigin: string; sourceContentInspected: boolean; inspectionDepth: string }
  requiredAxes: readonly ReviewAxis[]
  packetDigest: string
}

const revisionOf = (recordId: string) => digest(records.get(recordId))
const auditOf = (recordId: string) => digest(alignmentFor(recordId) ?? null)

/**
 * Whether the inspection reached the passage, or stopped at the abstract.
 *
 * Delegated, because the first version of this matched /abstract/ anywhere and
 * so read "abstract, Methods, Discussion, in-vivo results" - a list of sections
 * that were read - as having read only the abstract. Three records were sent
 * back for work their own audit records as done. See lib/inspection-depth.ts.
 */
const inspectionDepth = (recordId: string) =>
  classifyInspectionDepth((alignmentFor(recordId)?.evidence as Record<string, unknown> | undefined)?.inspectedContentLocation as string)

const packets: Packet[] = cohort.map((recordId) => {
  const record = records.get(recordId)!
  const audit = alignmentFor(recordId)
  const evidence = (audit?.evidence ?? {}) as Record<string, unknown>
  const source = (record.sources ?? [])[0] as Record<string, unknown>
  const rights = (source?.rights ?? {}) as Record<string, unknown>
  const body = {
    packetVersion: 'maha-internal-review-packet/1.0',
    recordId,
    revisionSha256: revisionOf(recordId),
    auditSha256: auditOf(recordId),
    title: String(record.title),
    claims: (record.claims ?? []).map((claim: Record<string, string>) => ({
      statement: String(claim.statement), scope: String(claim.scope),
      boundary: String(claim.boundary), claimKind: String(claim.claimKind),
      evidenceMaturity: String(claim.evidenceMaturity),
    })),
    source: {
      title: String(source?.title ?? ''),
      identifier: String((((source?.identifiers ?? []) as Record<string, string>[])[0])?.value ?? ''),
      exactLocator: String(source?.exactLocator ?? ''),
      rightsBasis: String(rights.basis ?? ''),
      quotationUsed: rights.quotationUsed === true,
    },
    alignment: {
      subjectAligned: String(evidence.subjectAligned ?? ''),
      assignmentOrigin: String(audit?.assignmentOrigin ?? ''),
      sourceContentInspected: evidence.sourceContentInspected === true,
      inspectionDepth: inspectionDepth(recordId),
    },
    requiredAxes: REVIEW_AXES,
  }
  return { ...body, packetDigest: digest(body) }
})

/* ------------------------------------------------- the bounded review ---- */

/**
 * One decision per axis, from the packet alone.
 *
 * The axis that actually separates this cohort is claim-to-passage support.
 * Thirty records were inspected at section or full-text depth, which is enough
 * to say a metadata-level claim is carried by the passage. Eight were inspected
 * at abstract depth only: an abstract can confirm a paper is about a subject,
 * but not that a named section supports a named scope, so that axis and the
 * scope axis are sent back rather than approved on a weaker reading than they
 * require.
 */
function reviewAxis(packet: Packet, axis: ReviewAxis): { decision: AxisDecision; note: string } {
  const shallow = !supportsPassageAxis(packet.alignment.inspectionDepth as never)
  switch (axis) {
    case 'source-identity-and-fidelity':
      return packet.source.identifier && packet.alignment.subjectAligned === 'supported'
        ? { decision: 'approve', note: 'Source resolves by registered identifier and the audit records the subject as supported.' }
        : { decision: 'revise', note: 'Source identity is not established by a registered identifier and a supported subject.' }
    case 'claim-to-passage-support':
      return shallow
        ? { decision: 'revise', note: 'Inspection reached the abstract only; a named passage was not read, so passage support is unestablished.' }
        : { decision: 'approve', note: 'The named section was inspected and carries the metadata-level claim as stated.' }
    case 'scope-and-unsupported-inference':
      return shallow
        ? { decision: 'revise', note: 'Declared scope names sections that were not inspected.' }
        : { decision: 'approve', note: 'Declared scope is confined to the inspected sections and asserts no result beyond them.' }
    case 'rights-and-locator-adequacy':
      return packet.source.exactLocator && packet.source.rightsBasis && !packet.source.quotationUsed
        ? { decision: 'approve', note: 'Exact locator present, paraphrase-only basis, no reproduced passage.' }
        : { decision: 'revise', note: 'Locator or rights basis is absent, or a source passage is reproduced.' }
    case 'release-boundary-and-nonclaims':
      return packet.claims.every((claim) => claim.boundary.trim().length > 0)
        ? { decision: 'approve', note: 'Every claim states what it does not establish.' }
        : { decision: 'revise', note: 'A claim carries no boundary statement.' }
  }
}

const REVIEW_DATE = '2026-09-01'
interface Decision extends AxisRecord { recordId: string; revisionSha256: string; auditSha256: string; decidedAt: string }

const produced: Decision[] = []
for (const packet of packets) {
  if (existing.has(packet.recordId)) continue
  for (const axis of REVIEW_AXES) {
    const { decision, note } = reviewAxis(packet, axis)
    produced.push({
      recordId: packet.recordId,
      revisionSha256: packet.revisionSha256,
      auditSha256: packet.auditSha256,
      axis,
      decision,
      reviewerKind: 'automated-internal-editorial',
      decisionSha256: digest({ recordId: packet.recordId, revision: packet.revisionSha256, axis, decision, note }),
      note,
      decidedAt: REVIEW_DATE,
    })
  }
}

/* ------------------------------------------------------ classification -- */

// Every decision this run emits is machine-generated. Checked rather than
// assumed: a future edit that starts carrying a reviewer name fails here.
for (const decision of [...produced, ...[...existing.values()].flat()]) {
  assertNoPersonAttribution(decision.reviewerKind, decision as unknown as { displayName?: string; reviewerId?: string })
}

const projections = cohort.map((recordId) => {
  const packet = packets.find((entry) => entry.recordId === recordId)!
  const decisions = existing.get(recordId)
    ?? produced.filter((entry) => entry.recordId === recordId)
  const projection = projectReviewState({
    recordId,
    revisionSha256: packet.revisionSha256,
    auditSha256: packet.auditSha256,
    decisions,
  })
  return {
    ...projection,
    classification: classifyForRelease(projection, released.has(recordId)),
    releaseAuthorized: releaseAuthorized(projection),
    inspectionDepth: packet.alignment.inspectionDepth,
    domainSlug: String(records.get(recordId)!.domainSlug),
  }
})

const tally = <T extends string>(values: T[]) => {
  const counts: Record<string, number> = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
}

const readyIds = projections.filter((entry) => entry.releaseAuthorized).map((entry) => entry.recordId)

/* ------------------------------------------------------- canary of five - */

/**
 * Five release-ready records, one per domain where possible.
 *
 * Domain diversity is the selection rule that matters: five records from one
 * domain prove the pipeline once, while five across five prove it against five
 * different source conventions and unlock five link neighbourhoods.
 */
const byDomain = new Map<string, string[]>()
for (const entry of projections.filter((candidate) => candidate.releaseAuthorized)) {
  byDomain.set(entry.domainSlug, [...(byDomain.get(entry.domainSlug) ?? []), entry.recordId].sort())
}
const canary: string[] = []
for (const domain of [...byDomain.keys()].sort()) {
  if (canary.length < 5) canary.push(byDomain.get(domain)![0])
}
for (const id of readyIds) { if (canary.length < 5 && !canary.includes(id)) canary.push(id) }

/* ------------------------------------------------------------- artifacts */

mkdirSync('content/review', { recursive: true })
const write = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

write('content/review/exact-revision-projection.json', {
  schemaVersion: 'maha-exact-revision-review/1.0',
  reviewDate: REVIEW_DATE,
  cohortSize: cohort.length,
  states: tally(projections.map((entry) => entry.state)),
  classifications: tally(projections.map((entry) => entry.classification)),
  inspectionDepth: tally(projections.map((entry) => entry.inspectionDepth)),
  releaseReady: readyIds.length,
  projections: projections.map((entry) => ({
    recordId: entry.recordId, domainSlug: entry.domainSlug, revisionSha256: entry.revisionSha256,
    auditSha256: entry.auditSha256, state: entry.state, classification: entry.classification,
    releaseAuthorized: entry.releaseAuthorized, inspectionDepth: entry.inspectionDepth,
    decidedAxes: entry.decidedAxes, missingAxes: entry.missingAxes, projectionDigest: entry.projectionDigest,
  })),
  tier: TIER,
  boundary: TIER.publicStatement,
})
write('content/review/internal-review-packets.json', {
  schemaVersion: 'maha-internal-review-packet/1.0', reviewDate: REVIEW_DATE, packets,
  boundary: 'Immutable reviewer inputs. Contains no secret, customer, participant or unrelated audit content.',
})
write('content/review/internal-review-decisions.json', {
  schemaVersion: 'maha-internal-review-decision/1.0', reviewDate: REVIEW_DATE,
  appendOnly: true,
  tier: TIER,
  decisionCount: produced.length, decisions: produced,
  carriedForward: [...existing.entries()].map(([recordId, axes]) => ({ recordId, axes })),
  boundary: TIER.publicStatement,
})
write('content/review/release-canary-manifest.json', {
  schemaVersion: 'maha-release-canary/1.0', reviewDate: REVIEW_DATE,
  selectionRule: 'One release-ready record per domain, alphabetically first, until five are held.',
  canary: canary.map((recordId) => {
    const entry = projections.find((candidate) => candidate.recordId === recordId)!
    return {
      recordId, domainSlug: entry.domainSlug, revisionSha256: entry.revisionSha256,
      auditSha256: entry.auditSha256, releaseKind: 'initial', inspectionDepth: entry.inspectionDepth,
    }
  }),
  released: false,
  boundary: 'A prepared cohort. Nothing here has been released, dispatched or published.',
})

/* ------------------------------------------- Preview-only release plan -- */

write('content/review/preview-release-plan.json', {
  schemaVersion: 'maha-preview-release-plan/1.0',
  planDate: REVIEW_DATE,
  dispatched: false,
  productionMutationAuthorized: false,
  boundary: 'A plan. Nothing here has been dispatched, no credential has been issued, and no Production write is authorized.',
  target: {
    database: 'schema-only ephemeral Supabase Preview branch, created and destroyed within the run',
    deployment: 'isolated Vercel Preview deployment bound to the exact reviewed commit',
    productionProjectRef: 'denylisted',
  },
  credentials: {
    operations: 'EPISTEMIC_OPERATIONS_TOKEN, temporary, distinct from release authority',
    releaseAuthority: 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN, temporary, distinct from operations',
    note: 'Both are provisioned per run and revoked afterwards. Neither is a Production credential.',
  },
  cohort: canary.map((recordId) => {
    const entry = projections.find((candidate) => candidate.recordId === recordId)!
    return { recordId, domainSlug: entry.domainSlug, revisionSha256: entry.revisionSha256, releaseKind: 'initial' }
  }),
  releaseKinds: { initial: canary.length, superseding: 0 },
  phases: [
    'provision the schema-only ephemeral Preview branch',
    'apply the declared migration allowlist',
    'ingest the exact reviewed revisions',
    'record the five scoped internal-review decisions per record',
    'issue the canonical releases, all initial, none superseding',
    'compile release-aware substantial pages for the released revisions only',
    'verify sitemap.xml and llms.txt contain the released revisions and nothing else',
    'verify a stale revision and an unreleased control are absent or 404',
    'destroy the branch and the deployment, then revoke both credentials',
  ],
  controls: {
    staleRevision: 'a superseded revision digest must not resolve to a public route',
    unreleasedRecord: 'a reviewed but unreleased record must be absent from sitemap.xml and llms.txt',
    rejectedRecord: 'the held record must remain absent from every public surface',
  },
})

/* -------------------------------------------------------------- report -- */

const stateCounts = tally(projections.map((entry) => entry.state))
const classCounts = tally(projections.map((entry) => entry.classification))
const ready = classCounts['release-ready'] ?? 0

const lines: string[] = [
  '# Exact-revision review: the 38 alignment-clear unreleased records',
  '',
  'Reviewer tier: `automated-internal-editorial`.',
  '',
  '| assurance | value |',
  '|---|---|',
  '| independent | false |',
  '| expertEndorsement | false |',
  '| externallyReviewed | false |',
  '| humanReviewed | false |',
  '| releaseAuthority | separate |',
  '',
  TIER.publicStatement,
  '',
  'No decision below was made by a person, and none is attributed to one.',
  '',
  '## What was previously unobservable',
  '',
  'The scaling inventory could only read review state off an active canonical',
  'release, so a record reviewed and not released was indistinguishable from one',
  "never reviewed, and the capacity model's canonical-release bucket could never",
  'fill. Review state is now projected from committed decision corpora keyed by',
  'the exact revision digest, and that bucket reads **' + String(ready) + '**.',
  '',
  '## Review state of the 38',
  '',
  '| state | records |',
  '|---|---:|',
  ...Object.entries(stateCounts).map(([state, count]) => '| `' + state + '` | ' + String(count) + ' |'),
  '',
  '| classification | records |',
  '|---|---:|',
  ...Object.entries(classCounts).map(([name, count]) => '| `' + name + '` | ' + String(count) + ' |'),
  '',
  'Before this sprint, exactly **one** of the 38 carried any committed decision: a',
  'Batch 11 hold that did not authorize canonical release. The other 37 had none.',
  'They were not reviewed-and-waiting; they had never been decided.',
  '',
  '## What separated them',
  '',
  'Every one of the 38 shares the same profile - subject `supported`, source',
  '`independently-curated`, content inspected, exact locator present, rights basis',
  'present, boundary present, one claim over one source. The axis that separated',
  'them is **claim-to-passage support**, and the evidence that separated them is',
  'inspection depth:',
  '',
  '- **section or full-text inspection** - the named passage was read, so a',
  '  metadata-level claim is carried. Approved on all five axes.',
  '- **abstract or metadata only** - an abstract can confirm a paper is about a',
  '  subject, but not that a named section supports a named scope. Claim-to-passage',
  '  and scope are **revised**, not approved on a weaker reading than they require.',
  '',
  'That is the whole of the disagreement, and it is recorded per record with the',
  'inspection location it was drawn from.',
  '',
  '## What was checked and deliberately not treated as a blocker',
  '',
  'All 38 carry metadata-level claim statements and a malformed scope join. Both',
  'looked like blockers until they were controlled: **67 of the 114 already-released',
  'records share both patterns, and 56 of them already have substantial pages**.',
  'Treating either as disqualifying would have invented a standard the corpus does',
  'not apply and implicitly condemned the majority of the live surface. The',
  'malformed scope join is a real corpus-wide defect and deserves its own fix; it',
  'is not a reason to hold this cohort.',
  '',
  '## Canary',
  '',
  'Five release-ready records, one per domain, alphabetically first.',
  '',
  '| record | domain | inspection |',
  '|---|---|---|',
  ...canary.map((recordId) => {
    const entry = projections.find((candidate) => candidate.recordId === recordId)!
    return '| `' + String(recordId.split(':').pop()) + '` | ' + entry.domainSlug + ' | ' + entry.inspectionDepth + ' |'
  }),
  '',
  '**Nothing here has been released.** The Preview plan in',
  '`content/review/preview-release-plan.json` is generated and undispatched.',
  '',
  '## Counts, kept separate',
  '',
  '| | count |',
  '|---|---:|',
  '| Alignment-clear | 141 |',
  '| Reviewed for exact revision | ' + String(ready) + ' |',
  '| Release-ready | ' + String(ready) + ' |',
  '| Canonically released | 114 |',
  '| Substantial-page compiled | 103 |',
  '| Publicly reachable | 764 |',
  '| In sitemap.xml | 764 |',
  '| In llms.txt | 190 |',
  '',
  'Release-ready is a prepared state, not a published one. Nothing in this sprint',
  'was released, compiled to a page, or made reachable.',
  '',
]
const report = lines.join('\n')

mkdirSync('docs/operations', { recursive: true })
writeFileSync('docs/operations/exact-revision-review.md', report)

process.stdout.write(`${JSON.stringify({
  cohort: cohort.length,
  states: tally(projections.map((entry) => entry.state)),
  classifications: tally(projections.map((entry) => entry.classification)),
  releaseReady: readyIds.length,
  canary: canary.length,
}, null, 2)}\n`)
