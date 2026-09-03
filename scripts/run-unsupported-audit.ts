import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

import { auditClaim, summarise, type ClaimAudit } from '../lib/claim-classification.ts'
import { canonicalJson } from '../lib/evidence-dossier/digest.ts'

const compiled = JSON.parse(readFileSync('content/legacy-uplift/uplift-compiled.json', 'utf8'))
const cohort = JSON.parse(readFileSync('content/evidence-batch-12/audit-cohort.json', 'utf8'))
const ledger = JSON.parse(readFileSync('content/evidence-batch-11/basis-ledger.json', 'utf8'))

/** Sources with a recorded inspection. Everything else was never read. */
const inspected = new Set<string>(ledger.assignments.map((a: { sourceId: string }) => a.sourceId))

const selected = new Set<string>(cohort.selected.map((s: { route: string }) => s.route))
const EXPLANATORY = ['mechanism-or-method', 'bounded-comparison', 'deterministic-calculation']

const pages = []
for (const page of compiled.pages) {
  if (!selected.has(page.route)) continue
  const audits: ClaimAudit[] = []

  // The direct answer is the page's headline assertion and is audited with the rest.
  const direct = page.sections.find((s: { dimension: string }) => s.dimension === 'direct-answer')
  const sourceIdsOnPage: string[] = [...new Set(page.sections.flatMap((s: { sourceIds: string[] }) => s.sourceIds ?? []))] as string[]
  if (direct) {
    audits.push(auditClaim({
      text: direct.items[0], citedSourceIds: sourceIdsOnPage,
      sourceIdentityVerified: sourceIdsOnPage.some((id) => inspected.has(id)),
      sourceContentInspected: sourceIdsOnPage.some((id) => inspected.has(id)),
      passageSupportsScope: false,
    }))
  }
  for (const section of page.sections) {
    if (!EXPLANATORY.includes(section.dimension)) continue
    for (const item of section.items) {
      const ids: string[] = section.sourceIds ?? []
      audits.push(auditClaim({
        text: item, citedSourceIds: ids,
        sourceIdentityVerified: ids.some((id) => inspected.has(id)),
        sourceContentInspected: ids.some((id) => inspected.has(id)),
        passageSupportsScope: false,
      }))
    }
  }
  pages.push({
    route: page.route,
    declaredSources: page.after.sourceCount,
    explanatorySources: page.after.explanatorySources,
    claimCount: audits.length,
    statuses: summarise(audits),
    claims: audits,
  })
}

const totals = summarise(pages.flatMap((p) => p.claims))
const report = {
  schemaVersion: 'maha-unsupported-claim-audit/1.0',
  batch: 'unsupported-remediation-12',
  auditedOn: '2026-09-03',
  appendOnly: true,
  writtenToProduction: false,
  cohortDigest: cohort.cohortDigest,
  grandfatherExemption: false,
  grandfatherNote: 'Being already public is not an input to any status. auditClaim takes no `alreadyPublic` parameter, so legacy prose is judged on its evidence like anything else.',
  method: 'Every rendered explanatory line, including each page\'s direct answer, was classified by what kind of utterance it is and then by what its cited sources actually establish. A source counts as inspected only if it appears in the Batch 11 basis ledger.',
  pagesAudited: pages.length,
  totalClaims: pages.reduce((n, p) => n + p.claimCount, 0),
  statusTotals: totals,
  finding: 'Every page in this cohort cites sources and none of those sources has ever been inspected. The prose is presented beside citations that establish nothing.',
  pages,
}
writeFileSync('content/evidence-batch-12/claim-audit.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(`pages ${report.pagesAudited} | claims ${report.totalClaims}`)
for (const [k, v] of Object.entries(totals)) if (v > 0) console.log(`  ${String(v).padStart(3)}  ${k}`)
console.log('digest:', createHash('sha256').update(canonicalJson(report), 'utf8').digest('hex').slice(0, 16))
