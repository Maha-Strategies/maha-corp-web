/** Deterministic TBM citation-identity repair artifacts. No timestamps, no operational ids. */
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

import { rereviewLedger } from '../lib/substantial-repaired-record-rereview.ts'
import {
  TBM_CITATION_REPAIR_BOUNDARY,
  TBM_CITATION_REPAIR_VERSION,
  TBM_FRESH_ALIGNMENT,
  TBM_FRESH_LEDGER,
  TBM_IDENTITY_AFTER,
  TBM_IDENTITY_BEFORE,
  TBM_LINEAGE,
  TBM_NEW_CANONICAL_PATH,
  TBM_NEW_REVISION,
  TBM_RECORD_ID,
  TBM_RELEASE_PREFLIGHT,
  TBM_SUPERSEDED_REPAIRED_REVISION,
  tbmRepairedRecord,
  verifyCitationIdentity,
} from '../lib/substantial-tbm-citation-identity-repair.ts'

const record = tbmRepairedRecord()
const source = record.sources[0]!
const priorLedger = rereviewLedger(TBM_RECORD_ID)!

const reviewerPacket = (() => {
  const unsigned = {
    recordId: TBM_RECORD_ID,
    revisionSha256: TBM_NEW_REVISION,
    canonicalPath: TBM_NEW_CANONICAL_PATH,
    title: record.title,
    recordKind: record.recordKind,
    claimStatement: record.claims[0]!.statement,
    claimScope: record.claims[0]!.scope,
    claimBoundary: record.claims[0]!.boundary,
    sourceTitle: source.title,
    sourceUrl: source.url,
    sourceIdentifiers: source.identifiers,
    publisher: source.publisher,
    publishedAt: source.publishedAt,
    exactLocator: source.exactLocator,
    rightsBasis: source.rights.basis,
    boundaries: record.boundaries,
    prohibitedInferences: record.prohibitedInferences,
    checklistVersion: TBM_CITATION_REPAIR_VERSION,
    boundary: TBM_CITATION_REPAIR_BOUNDARY,
  }
  return { ...unsigned, packetDigest: `sha256:${createHash('sha256').update(JSON.stringify(unsigned)).digest('hex')}` }
})()

const artifact = {
  schemaVersion: TBM_CITATION_REPAIR_VERSION,
  recordId: TBM_RECORD_ID,
  boundary: TBM_CITATION_REPAIR_BOUNDARY,
  citationIdentityRepair: {
    before: TBM_IDENTITY_BEFORE,
    after: TBM_IDENTITY_AFTER,
    checksBefore: verifyCitationIdentity(TBM_IDENTITY_BEFORE),
    checksAfter: verifyCitationIdentity(TBM_IDENTITY_AFTER),
  },
  revisions: { superseded: TBM_SUPERSEDED_REPAIRED_REVISION, current: TBM_NEW_REVISION },
  supersededDecision: { state: priorLedger.state, blockingDimensions: priorLedger.blockingDimensions, ledgerDigest: priorLedger.ledgerDigest },
  freshAlignment: TBM_FRESH_ALIGNMENT,
  reviewerPacket,
  ledger: TBM_FRESH_LEDGER,
  releasePreflight: TBM_RELEASE_PREFLIGHT,
  lineage: TBM_LINEAGE,
  summary: {
    dimensionDecisions: TBM_FRESH_LEDGER.decisions.length,
    verdictTotals: TBM_FRESH_LEDGER.verdictTotals,
    state: TBM_FRESH_LEDGER.state,
    canonicalReleasesCreated: 0,
    releaseAuthorityUsed: false,
    frozenRemainderCohortModified: false,
  },
  digest: `sha256:${createHash('sha256').update(JSON.stringify([TBM_IDENTITY_AFTER, TBM_FRESH_LEDGER, TBM_LINEAGE])).digest('hex')}`,
}

writeFileSync('content/substantial-pages/tbm-citation-identity-repair.json', `${JSON.stringify(artifact, null, 2)}\n`)

const lines: string[] = []
lines.push('# Breeding blanket test modules — citation identity repair', '')
lines.push(TBM_CITATION_REPAIR_BOUNDARY, '')
lines.push(`Digest: \`${artifact.digest}\``, '')
lines.push('## Revisions', '')
lines.push(`- Superseded (revise-again): \`${TBM_SUPERSEDED_REPAIRED_REVISION}\``)
lines.push(`- Current: \`${TBM_NEW_REVISION}\``, '')
lines.push('## Source identity before and after', '', '| Field | Before | After |', '|---|---|---|')
for (const field of Object.keys(TBM_IDENTITY_AFTER) as (keyof typeof TBM_IDENTITY_AFTER)[]) {
  lines.push(`| \`${field}\` | ${String(TBM_IDENTITY_BEFORE[field] ?? '—')} | ${String(TBM_IDENTITY_AFTER[field] ?? '—')} |`)
}
lines.push('', '## Citation identity gate', '', '| Check | Before | After |', '|---|---|---|')
const before = verifyCitationIdentity(TBM_IDENTITY_BEFORE)
const after = verifyCitationIdentity(TBM_IDENTITY_AFTER)
for (const [index, check] of after.entries()) {
  lines.push(`| \`${check.check}\` | ${before[index]!.passed ? 'pass' : '**fail**'} | ${check.passed ? 'pass' : '**fail**'} |`)
}
lines.push('', '## Ten-dimension rereview of the new revision', '', '| Dimension | Verdict | Rationale | Disagreement or uncertainty |', '|---|---|---|---|')
for (const decision of TBM_FRESH_LEDGER.decisions) {
  lines.push(`| \`${decision.dimension}\` | **${decision.verdict}** | ${decision.rationale} | ${decision.disagreementsOrUncertainty} |`)
}
lines.push('', `**State: \`${TBM_FRESH_LEDGER.state}\`**`, '')
lines.push('## Lineage', '', '| Revision | Label | Source title | Stable identifier | Standing decision |', '|---|---|---|---|---|')
for (const entry of TBM_LINEAGE) {
  lines.push(`| \`${entry.revisionSha256.slice(7, 23)}\` | ${entry.label} | ${entry.sourceTitle} | ${entry.stableIdentifier} | ${entry.standingDecision} |`)
}
lines.push('')
for (const entry of TBM_LINEAGE) lines.push(`- **${entry.label}** (\`${entry.revisionSha256.slice(7, 23)}\`) — ${entry.whyItChanged}`)
lines.push('', '## Release-readiness preflight', '')
lines.push(`Internally approved: **${TBM_RELEASE_PREFLIGHT.internallyApproved ? 'yes' : 'no'}**. Canonical release created: **no**. Release authority used: **no**. In frozen 20-record cohort: **no**.`, '')
lines.push(TBM_RELEASE_PREFLIGHT.proposedNextStep, '')
writeFileSync('docs/substantial-pages/tbm-citation-identity-repair.md', lines.join('\n'))

console.log(JSON.stringify({ old: TBM_SUPERSEDED_REPAIRED_REVISION, new: TBM_NEW_REVISION, summary: artifact.summary, digest: artifact.digest }, null, 1))
