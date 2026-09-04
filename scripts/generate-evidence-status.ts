import { readFileSync, writeFileSync } from 'node:fs'

import { assertNoAuditInternals, disclosureFor } from '../lib/evidence-status-disclosure.ts'

/**
 * Claim-level support, per route.
 *
 * The label was computed from explanatorySources, which is a property of a
 * source rather than of a page: attesting one source marked every page citing
 * it as checked. Attaching the NIST algorithms dictionary after reading only
 * its entry for "graph" told four other pages -- optimization, modular
 * arithmetic, constraint satisfaction, formal logic -- that they had been
 * checked against an inspected source. Reading one dictionary entry does not
 * check an optimization page.
 *
 * A page is only described as checked when an inspected passage names that
 * route, which is the signal the depth audit already uses.
 */
const claimLevelRoutes = new Set<string>()
for (const file of [
  'content/evidence-batch-4/inspections.json', 'content/evidence-batch-8/inspections.json',
  'content/evidence-batch-9/inspections.json', 'content/evidence-batch-12/inspections.json',
  'content/evidence-batch-14/inspections.json',
]) {
  const batch = JSON.parse(readFileSync(file, 'utf8')) as { inspected?: { claimByClaimSupport?: { route: string }[] }[] }
  for (const source of batch.inspected ?? []) {
    for (const claim of source.claimByClaimSupport ?? []) claimLevelRoutes.add(claim.route)
  }
}
const reuse = JSON.parse(readFileSync('content/evidence-batch-7/reuse-audit.json', 'utf8')) as { accepted?: { route: string }[] }
for (const entry of reuse.accepted ?? []) claimLevelRoutes.add(entry.route)
for (const file of ['content/semiconductor-evidence/batch-1.json', 'content/evidence-batch-2/inspections.json', 'content/evidence-batch-3/inspections.json']) {
  const batch = JSON.parse(readFileSync(file, 'utf8')) as { inspected?: { supportsRoutes?: string[] }[] }
  for (const source of batch.inspected ?? []) for (const route of source.supportsRoutes ?? []) claimLevelRoutes.add(route)
}

const compiled = JSON.parse(readFileSync('content/legacy-uplift/uplift-compiled.json', 'utf8'))
const audit = JSON.parse(readFileSync('content/evidence-batch-9/depth-audit.json', 'utf8'))

const stateByRoute = new Map<string, string>(
  audit.verdicts.map((v: { route: string; state: string }) => [v.route, v.state]))

/**
 * The public evidence-status file.
 *
 * Sanitised at the point of writing rather than at the point of rendering: the
 * runtime imports this file, so anything included here reaches a served bundle.
 * Only route, counts and the derived wording go in. Every audit field -- risk
 * scores, dispositions, remediation text -- is refused by assertion below.
 */
const entries = []
for (const page of compiled.pages) {
  if (!page.eligible || !page.after) continue
  const state = stateByRoute.get(page.route) ?? ''
  const disclosure = disclosureFor({
    citedSourceCount: page.after.sourceCount ?? 0,
    // Claim-level, not source-level: a page counts as checked only where an
    // inspected passage names it.
    inspectedSourceCount: claimLevelRoutes.has(page.route) ? (page.after.explanatorySources ?? 0) : 0,
    isFirstParty: state.startsWith('first-party-documented'),
  })
  entries.push({ route: page.route, ...disclosure })
}

const counts: Record<string, number> = {}
for (const e of entries) counts[e.status] = (counts[e.status] ?? 0) + 1

const payload = {
  schemaVersion: 'maha-evidence-status-public/1.0',
  generatedFrom: 'uplift-compiled.json and the depth audit, both regenerated',
  note: 'Public. Rendered on the page it describes. Carries no audit internals.',
  counts,
  entries: entries.sort((a, b) => a.route.localeCompare(b.route)),
}

assertNoAuditInternals(payload)
writeFileSync('content/legacy-uplift/evidence-status-public.json', `${JSON.stringify(payload, null, 2)}\n`)
console.log(`evidence status for ${entries.length} pages`)
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`)
