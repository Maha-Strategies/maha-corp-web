import { readFileSync, writeFileSync } from 'node:fs'

import { assertNoAuditInternals, disclosureFor } from '../lib/evidence-status-disclosure.ts'

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
    inspectedSourceCount: page.after.explanatorySources ?? 0,
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
