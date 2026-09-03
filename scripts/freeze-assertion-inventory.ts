import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { fingerprint, recommendDisposition, type AssertionType } from '../lib/assertion-inventory.ts'

const audit = JSON.parse(readFileSync('content/evidence-batch-12/claim-audit.json', 'utf8'))
const compiled = JSON.parse(readFileSync('content/legacy-uplift/uplift-compiled.json', 'utf8'))
const ledger = JSON.parse(readFileSync('content/evidence-batch-11/basis-ledger.json', 'utf8'))
const inspected = new Set<string>(ledger.assignments.map((a: { sourceId: string }) => a.sourceId))
const revisionByRoute = new Map<string, string>(compiled.pages.map((p: { route: string; upliftDigest: string }) => [p.route, p.upliftDigest]))

const FRAME: Record<AssertionType, string> = {
  definitional: 'definitional: fixes a term, and needs an authority for whose definition it is',
  'procedural-step': 'methodological: prescribes practice, and needs a methodology source',
  'empirical-assertion': 'empirical: states how something behaves, and needs a study or measurement',
  'taxonomic-entry': 'taxonomic: names a category and asserts nothing on its own',
}

/**
 * Risk weights.
 *
 * Ranked by what a wrong sentence would cost a reader, not by how easy it
 * would be to fix. Quantitative and causal claims lead because they are the
 * ones a reader would act on.
 */
const QUANT = /\b\d+(\.\d+)?\s*(%|percent|x|nm|µm|mm|ms|hz|khz|mhz|ghz|w|mw|j|k|v|db|bit|byte)\b/i
const CAUSAL = /\b(causes?|leads? to|results? in|produces?|improves?|reduces?|increases?|decreases?|outperforms?|enables?|ensures?|prevents?)\b/i
const CERTAINTY = /\b(proves?|demonstrates?|establishes?|shows? that|confirms?|guarantees?|always|never|must)\b/i
const CONSEQUENCE = /\b(safety|biosafety|risk|hazard|toxic|ethics|governance|compliance|regulat|clinical|patient|yield|cost|commercial|contamination)\b/i

function score(text: string, route: string, central: boolean): { risk: number; factors: string[] } {
  const f: string[] = []
  let n = 0
  if (QUANT.test(text)) { n += 5; f.push('quantitative specificity') }
  if (CAUSAL.test(text)) { n += 4; f.push('causal strength') }
  if (CONSEQUENCE.test(text) || /biosafety|ethics-and-governance/.test(route)) { n += 4; f.push('safety or commercial consequence') }
  if (CERTAINTY.test(text)) { n += 3; f.push('scientific-certainty wording') }
  if (central) { n += 3; f.push('central to the page') }
  // A shorter route is nearer the top of a family index and more visible.
  if (route.split('/').length <= 4) { n += 1; f.push('search visibility') }
  return { risk: n, factors: f }
}

const records = []
for (const page of audit.pages) {
  const claims = page.claims as { text: string; kind: string; status: string; citedSourceIds: string[] }[]
  for (const [index, claim] of claims.entries()) {
    if (claim.status !== 'unsupported') continue
    const central = index === 0
    const type = claim.kind as AssertionType
    const hasCited = claim.citedSourceIds.length > 0
    const srcInspected = claim.citedSourceIds.some((id) => inspected.has(id))
    const { disposition, because } = recommendDisposition({
      assertionType: type, hasCitedSource: hasCited, sourceInspected: srcInspected, centralToPage: central,
    })
    const { risk, factors } = score(claim.text, page.route, central)
    records.push({
      assertionId: `a${String(records.length + 1).padStart(3, '0')}`,
      route: page.route,
      pageRevision: revisionByRoute.get(page.route) ?? 'unknown',
      textFingerprint: fingerprint(page.route, claim.text),
      textPreview: claim.text.slice(0, 60),
      assertionType: type,
      currentSourceIds: claim.citedSourceIds,
      currentLocator: null,
      evidentiaryFrame: FRAME[type],
      whySupportIsMissing: hasCited
        ? 'A source is cited but has never been inspected, so nothing establishes the sentence.'
        : 'No source is cited for this sentence.',
      narrowingCouldSupport: type === 'definitional' || type === 'procedural-step',
      removalChangesCentralMeaning: central,
      disposition, dispositionBecause: because,
      risk, riskFactors: factors,
    })
  }
}

const byDisposition: Record<string, number> = {}
for (const r of records) byDisposition[r.disposition] = (byDisposition[r.disposition] ?? 0) + 1

const inventory = {
  schemaVersion: 'maha-assertion-inventory/1.0',
  batch: 'public-claim-remediation-13',
  frozenAt: '2026-09-03',
  immutable: true,
  appendOnly: true,
  writtenToProduction: false,
  privateArtifact: true,
  containsFullSourcePassages: false,
  note: 'Assertion text is stored as a fingerprint plus a short preview. Full source passages and review rationale live only in this private artifact and are never rendered.',
  totalAssertions: records.length,
  byDisposition,
  assertions: records,
  boundary: 'This inventory records what is unsupported and what should be done about it. It changes no page.',
}
if (existsSync('content/evidence-batch-13/assertion-inventory.json')) {
  console.log('REFUSING: the inventory is frozen and already exists.')
  process.exit(0)
}
writeFileSync('content/evidence-batch-13/assertion-inventory.json', `${JSON.stringify(inventory, null, 2)}\n`)
console.log(`frozen ${records.length} assertions | digest ${createHash('sha256').update(canonicalJson(inventory), 'utf8').digest('hex').slice(0, 16)}`)
for (const [k, v] of Object.entries(byDisposition).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(2)}  ${k}`)
