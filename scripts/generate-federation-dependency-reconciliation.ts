/**
 * What reviewing the v3 definitions unblocks.
 *
 * Tranches 13-17 recorded 94 dependency records as missing. Map v3 supplied the
 * 32 definitions they named, and Tranche 18 reviewed them. This reports which
 * of those records a re-run would now resolve, and which would not.
 *
 * A separate artifact rather than a rewrite of the five tranches. Their cohorts
 * and digests were computed against v2, and re-running them against a larger
 * map would reshuffle five completed reviews — changing which candidates were
 * selected, not merely their dependency state. Reconciliation reports the
 * effect without falsifying the record of what was reviewed when.
 *
 * The distinction that matters: a dependency resolves when its definition has
 * been reviewed, not when it has been added. A definition that Tranche 18 left
 * blocked on source inspection does not unblock anything, and is reported as
 * such rather than counted.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

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

const v3 = JSON.parse(readFileSync(`${OUT}/federation-route-candidates-v3.json`, 'utf8')) as
  { candidates: { candidateId: string; conceptId: string; siteId: string; routeRole: string; addedIn?: string }[] }
const t18Decisions = JSON.parse(readFileSync(`${OUT}/federation-tranche-18-decisions-v1.json`, 'utf8')) as
  { decisions: { candidateId: string; conceptId: string; finalState: string; topic: string }[] }

// A definition unblocks its dependents only once it is evidence-ready. Reviewed
// and blocked is still reviewed, but it carries no inspected source, so a page
// depending on it would inherit a definition that cannot yet be cited.
const readyDefinitions = new Set(
  t18Decisions.decisions.filter((d) => d.finalState === 'evidence-ready').map((d) => d.conceptId))
const reviewedDefinitions = new Set(t18Decisions.decisions.map((d) => d.conceptId))

type Row = { tranche: string; candidateId: string; conceptId: string; outcome: string; reason: string }
const rows: Row[] = []

for (const t of ['13', '14', '15', '16', '17']) {
  const deps = JSON.parse(readFileSync(`${OUT}/federation-tranche-${t}-dependency-validation-v1.json`, 'utf8')) as
    { dependencies: { candidateId: string; conceptId: string; declaredOwner: string; state: string }[] }
  for (const d of deps.dependencies) {
    if (d.state !== 'missing') continue
    if (readyDefinitions.has(d.conceptId)) {
      rows.push({
        tranche: t, candidateId: d.candidateId, conceptId: d.conceptId,
        outcome: 'would-resolve',
        reason: 'The definition was added in map v3 and reached evidence-ready in Tranche 18.',
      })
    } else if (reviewedDefinitions.has(d.conceptId)) {
      rows.push({
        tranche: t, candidateId: d.candidateId, conceptId: d.conceptId,
        outcome: 'definition-reviewed-but-blocked',
        reason:
          'The definition exists and was reviewed in Tranche 18, but is blocked on source inspection. A dependent ' +
          'would inherit a definition with no inspected source, so it does not unblock.',
      })
    } else {
      rows.push({
        tranche: t, candidateId: d.candidateId, conceptId: d.conceptId,
        outcome: 'still-absent',
        reason: 'No definition for this concept was added in v3.',
      })
    }
  }
}

const tally = (keys: string[]) => Object.fromEntries(
  Object.entries(keys.reduce<Record<string, number>>((a, k) => ({ ...a, [k]: (a[k] ?? 0) + 1 }), {}))
    .sort(([a], [b]) => a.localeCompare(b)))

const body = {
  schemaVersion: 'maha-federation-dependency-reconciliation/1.0',
  frozenOn: '2026-09-06',
  purpose:
    'Reports which Tranche 13-17 dependency gaps the v3 additions and their Tranche 18 review would resolve, ' +
    'without re-running those tranches.',
  method:
    'A dependency resolves when its definition has been reviewed and reached evidence-ready. Added but unreviewed ' +
    'does not resolve it; reviewed but blocked on source inspection does not resolve it either, because the ' +
    'dependent would inherit a definition that cannot yet be cited.',
  boundary:
    'An analysis. It rewrites no tranche, changes no classification, and does not itself unblock anything. ' +
    'Tranches 13-17 were computed against map v2 and their artifacts stand as the record of what was reviewed when.',
  counts: {
    missingRecordsAtTrancheTime: rows.length,
    byOutcome: tally(rows.map((r) => r.outcome)),
    byTranche: tally(rows.map((r) => r.tranche)),
    definitionsAddedInV3: v3.candidates.filter((c) => c.addedIn === 'v3').length,
    definitionsReviewedInTranche18: reviewedDefinitions.size,
    definitionsEvidenceReady: readyDefinitions.size,
  },
  rows: rows.sort((a, b) =>
    a.tranche.localeCompare(b.tranche) || a.candidateId.localeCompare(b.candidateId)),
}

writeFileSync(`${OUT}/federation-dependency-reconciliation-v1.json`,
  `${JSON.stringify({ ...body, provenanceDigest: digest(canonicalJson(body)) }, null, 2)}\n`)

console.log(`missing records reconciled: ${rows.length}`)
console.log(`  ${JSON.stringify(body.counts.byOutcome)}`)
console.log(`definitions: ${body.counts.definitionsAddedInV3} added, ${body.counts.definitionsReviewedInTranche18} reviewed, ${body.counts.definitionsEvidenceReady} evidence-ready`)
