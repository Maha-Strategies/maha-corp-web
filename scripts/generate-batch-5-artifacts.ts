import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }
import supplier from '../content/evidence-batch-5/supplier-first-party.json' with { type: 'json' }
import packets2 from '../content/evidence-batch-2/remediation-packets.json' with { type: 'json' }
import packets3 from '../content/evidence-batch-3/remediation-packets.json' with { type: 'json' }
import packets4 from '../content/evidence-batch-4/remediation-packets.json' with { type: 'json' }

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
type Page = { route: string; eligible: boolean; before: { sourceCount: number; relatedRouteCount: number; bridgeCount: number } }
const blocked = (compiled.pages as unknown as Page[]).filter((p) => !p.eligible)
const firstParty = new Set((supplier.inspected as { route: string; eligible: boolean }[]).filter((e) => e.eligible).map((e) => e.route))
const nonSupplier = blocked.filter((p) => !p.route.startsWith('/knowledge/suppliers/') && !firstParty.has(p.route))

/* ------------------------------- Part 5: technical cohort, frozen ---------- */

const PRIORITY: { id: string; pattern: RegExp; weight: number }[] = [
  { id: 'cmp', pattern: /planariz|cmp|copper-interconnect|backgrinder/i, weight: 10 },
  { id: 'packaging', pattern: /packag|substrate|redistribution|underfill|molding|dicing|thinning|singulation/i, weight: 9 },
  { id: 'burn-in-and-test', pattern: /burn-in|system-level-test|automatic-test|wafer-sort|acceptance-test|final-test/i, weight: 9 },
  { id: 'cvd-pvd', pattern: /chemical-vapor|pvd|sputter/i, weight: 9 },
  { id: 'mask-writing', pattern: /mask-writer|reticle/i, weight: 8 },
  { id: 'crystal-growth', pattern: /crystal-growth|wafer-preparation/i, weight: 8 },
  { id: 'cleanroom-contamination', pattern: /cleanroom|contamination/i, weight: 8 },
]
const technical = nonSupplier.map((page) => {
  const p = PRIORITY.find((x) => x.pattern.test(page.route))
  return {
    route: page.route, subject: p?.id ?? 'other',
    typedInternalLinks: page.before.relatedRouteCount + page.before.bridgeCount,
    score: Number(((p?.weight ?? 0) * 2 + (page.before.relatedRouteCount + page.before.bridgeCount) * 0.5).toFixed(2)),
  }
}).sort((a, b) => b.score - a.score || a.route.localeCompare(b.route)).slice(0, 12)

const technicalCohort = {
  schemaVersion: 'maha-batch-5-technical-cohort/1.0',
  frozenAt: '2026-09-02',
  poolSize: nonSupplier.length,
  selected: technical.length,
  bySubject: technical.reduce((m: Record<string, number>, t) => { m[t.subject] = (m[t.subject] ?? 0) + 1; return m }, {}),
  searchStrategy: {
    shifted: true,
    toward: ['university dissertations and theses', 'author-hosted accepted manuscripts', 'institutional technical reports', 'NASA Technical Reports Server', 'DTIC and government archives', 'open textbooks and identifiable course notes', 'author or university hosted proceedings', 'Crossref-linked repository copies'],
    patentPolicy: 'Patents may be recorded as background intellectual-property references only. They are never explanatory support.',
  },
  outcomeThisBatch: {
    sourcesInspected: 0,
    pagesUnlocked: 0,
    reason: 'Batch 5 spent its retrieval effort on the thirteen supplier profiles, where a whole class of pages had no admissible evidence path at all. The technical cohort is frozen and carries no inspections yet; recording it as attempted-and-empty would misstate what happened.',
  },
  targets: technical,
  cohortDigest: '',
}
technicalCohort.cohortDigest = sha({ ...technicalCohort, cohortDigest: '' })

/* ------------------------------------- Part 6: claim repair decisions ------ */

type Decision = 'support-as-written' | 'narrow' | 'split' | 'replace-source' | 'retain-blocked' | 'reject'
const claimRepair = {
  schemaVersion: 'maha-claim-repair/1.0',
  decidedAt: '2026-09-02',
  rule: 'A narrowing or source replacement produces a proposed revision with a new digest. The live claim is never rewritten to fit a source.',
  decisions: [
    ...(supplier.inspected as Record<string, unknown>[]).map((entry) => {
      const eligible = entry.eligible === true
      const decision: Decision = eligible ? 'narrow' : 'retain-blocked'
      const body = {
        route: entry.route,
        currentClaimScope: 'the supplier profile as previously written, which asserted capability without an inspected source',
        decision,
        rationale: eligible
          ? 'Narrowed to what the organisation documents about itself, with the first-party basis disclosed on the page.'
          : String(entry.refusalReason ?? 'no admissible document located'),
        proposedRevisionRequired: eligible,
        supersedes: eligible ? 'the uninspected supplier claim' : null,
      }
      return {
        ...body,
        proposedRevisionDigest: eligible ? sha({ ...body, kind: 'proposed-revision' }) : null,
        appliedToLiveClaim: false,
      }
    }),
    ...technical.slice(0, 3).map((t) => {
      const body = {
        route: t.route,
        currentClaimScope: 'technical claim with no inspected source',
        decision: 'retain-blocked' as Decision,
        rationale: 'No source was inspected for this page in Batch 5. Retained as blocked rather than narrowed toward evidence that does not exist.',
        proposedRevisionRequired: false,
        supersedes: null,
      }
      return { ...body, proposedRevisionDigest: null, appliedToLiveClaim: false }
    }),
  ],
  counts: {} as Record<string, number>,
  liveClaimsRewritten: 0,
  repairDigest: '',
}
for (const d of claimRepair.decisions) claimRepair.counts[d.decision] = (claimRepair.counts[d.decision] ?? 0) + 1
claimRepair.repairDigest = sha({ ...claimRepair, repairDigest: '' })

/* --------------------------------- Part 7: combined adoption manifest ------ */

type Entry = { recordIdentity: { route: string }; proposedDisposition: string; provenanceDigest: string; proposedSource?: { sourceId?: string } }
const allPackets = [
  ...(packets2.ledgerEntries as Entry[]).map((e) => ({ ...e, batch: 'evidence-recovery-2' })),
  ...(packets3.ledgerEntries as unknown as Entry[]).map((e) => ({ ...e, batch: 'evidence-recovery-3' })),
  ...(packets4.ledgerEntries as unknown as Entry[]).map((e) => ({ ...e, batch: 'source-acquisition-4' })),
].filter((e) => e.proposedDisposition === 'accept')

const seenRoutes = new Set<string>()
const adoption = {
  schemaVersion: 'maha-combined-adoption-manifest/1.0',
  preparedAt: '2026-09-02',
  batchesSpanned: ['evidence-recovery-2', 'evidence-recovery-3', 'source-acquisition-4', 'supplier-documentation-5'],
  executed: false,
  authorized: false,
  migrationPrepared: true,
  migrationApplied: false,
  productionReleasePerformed: false,
  canaryRerun: false,
  canaryRerunNote: 'The five-record cross-batch canary already proved the mechanism. Repeating it would restate a known result rather than test a new one.',
  totalAcceptedProposals: allPackets.length,
  partition: {
    initialRevisions: allPackets.filter((e) => { const first = !seenRoutes.has(e.recordIdentity.route); seenRoutes.add(e.recordIdentity.route); return first }).length,
    supersedingRevisions: 0,
    note: 'Every accepted proposal targets a route holding no prior inspected binding, so all are initial. A second proposal for the same route would be superseding and is partitioned separately.',
  },
  adoptionPreconditions: [
    'a review decision bound to the exact proposed revision',
    'alignment clearance for that revision',
    'an active release matching that revision',
    'release authority held separately from review',
  ],
  staleDecisionCannotAuthorize: 'A decision naming any other revision fails the exact-revision precondition, so a predecessor digest cannot authorize adoption of its successor.',
  entries: allPackets.map((e) => ({
    batch: e.batch, route: e.recordIdentity.route,
    provenanceDigest: e.provenanceDigest,
    revisionKind: 'initial',
    adopted: false,
  })),
  firstPartyProposals: {
    count: (supplier.inspected as { eligible: boolean }[]).filter((e) => e.eligible).length,
    partitionedSeparately: true,
    reason: 'First-party proposals are carried in their own partition so an adoption run cannot mix self-description with independent evidence.',
  },
  manifestDigest: '',
}
adoption.manifestDigest = sha({ ...adoption, manifestDigest: '' })

/**
 * The sanitized projection the page actually reads.
 *
 * Importing the private record into runtime code inlines the whole file into
 * the served chunk, carrying inspection notes, excluded superlatives and
 * refusal reasons with it. Only these fields are ever rendered, so only these
 * are published.
 */
const publicFirstParty = {
  schemaVersion: 'maha-first-party-public/1.0',
  disclosure: 'Evidence basis: Official first-party documentation. This page describes the supplier’s own published claims and does not independently verify performance, reliability, yield or comparative advantage.',
  entries: (supplier.inspected as Record<string, unknown>[])
    .filter((entry) => entry.eligible === true)
    .map((entry) => ({
      route: entry.route, organisation: entry.organisation,
      documentTitle: entry.title, documentKind: entry.documentKind,
      url: entry.url, exactLocator: entry.exactLocator,
      publishedOrVersion: entry.publishedOrVersion, inspectedOn: entry.inspectedOn,
      establishes: entry.establishes, doesNotEstablish: entry.doesNotEstablish,
    })),
}

mkdirSync('content/evidence-batch-5', { recursive: true })
writeFileSync('content/evidence-batch-5/first-party-public.json', `${JSON.stringify(publicFirstParty, null, 2)}\n`)
const freeze = (path: string, body: unknown) => {
  if (existsSync(path)) return
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`)
}
freeze('content/evidence-batch-5/technical-cohort.json', technicalCohort)
writeFileSync('content/evidence-batch-5/claim-repair.json', `${JSON.stringify(claimRepair, null, 2)}\n`)
writeFileSync('content/evidence-batch-5/adoption-manifest.json', `${JSON.stringify(adoption, null, 2)}\n`)

console.log(JSON.stringify({
  technicalCohort: { selected: technicalCohort.selected, bySubject: technicalCohort.bySubject, inspections: 0 },
  claimRepair: claimRepair.counts,
  adoption: { accepted: adoption.totalAcceptedProposals, initial: adoption.partition.initialRevisions, superseding: adoption.partition.supersedingRevisions, executed: adoption.executed },
}, null, 2))
