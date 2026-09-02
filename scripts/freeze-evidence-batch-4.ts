import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }

/**
 * Freezes 20 blocked pages, scored on whether evidence could plausibly exist
 * for them rather than on how many neighbours they have.
 *
 * Family size and positional siblings appear nowhere in the expression. What
 * counts is whether an independent, lawfully readable literature exists for
 * the subject, how connected the page is, and whether its current evidence is
 * vendor-only.
 */

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
type Page = { route: string; family: string; eligible: boolean; before: { sourceCount: number; relatedRouteCount: number; bridgeCount: number } }
const blocked = (compiled.pages as unknown as Page[]).filter((p) => !p.eligible)

const SUBJECTS: { id: string; pattern: RegExp; lawfulFullTextLikely: number; independentAuthorship: number }[] = [
  { id: 'metrology-and-defect-inspection', pattern: /metrolog|inspect|defect|test|sort|qualification|reliability|failure-analysis/i, lawfulFullTextLikely: 9, independentAuthorship: 9 },
  { id: 'lithography-and-pattern-transfer', pattern: /lithograph|mask|reticle|tapeout|design-to|rtl|physical-design/i, lawfulFullTextLikely: 8, independentAuthorship: 8 },
  { id: 'deposition-etching-cleaning', pattern: /deposit|etch|cvd|pvd|sputter|clean|contamination|cleanroom/i, lawfulFullTextLikely: 9, independentAuthorship: 9 },
  { id: 'process-control-and-yield', pattern: /yield|process-control|domains\/semiconductor-manufacturing/i, lawfulFullTextLikely: 8, independentAuthorship: 8 },
  { id: 'advanced-packaging', pattern: /packag|dicing|thinning|underfill|molding|substrate|redistribution|backgrinder|singulation/i, lawfulFullTextLikely: 7, independentAuthorship: 7 },
  { id: 'cmp', pattern: /planariz|cmp|copper-interconnect/i, lawfulFullTextLikely: 2, independentAuthorship: 8 },
  { id: 'crystal-and-materials', pattern: /crystal-growth|wafer-preparation|polyether|materials/i, lawfulFullTextLikely: 5, independentAuthorship: 7 },
  { id: 'vendor-only-supplier', pattern: /^\/knowledge\/suppliers\//, lawfulFullTextLikely: 3, independentAuthorship: 1 },
]

const candidates = blocked.map((page) => {
  const subject = SUBJECTS.find((s) => s.pattern.test(page.route))
  const connectivity = page.before.relatedRouteCount + page.before.bridgeCount
  return {
    route: page.route, family: page.family,
    subject: subject?.id ?? 'other',
    currentEvidence: page.before.sourceCount === 0 ? 'none' : 'vendor-or-metadata-only',
    typedInternalLinks: connectivity,
    lawfulFullTextLikely: subject?.lawfulFullTextLikely ?? 0,
    independentAuthorship: subject?.independentAuthorship ?? 0,
    // No family size, no sibling count.
    score: Number((
      (subject?.lawfulFullTextLikely ?? 0) * 1.5
      + (subject?.independentAuthorship ?? 0) * 1.2
      + connectivity * 0.5
      + page.before.sourceCount * 0.3
    ).toFixed(2)),
  }
}).sort((a, b) => b.score - a.score || a.route.localeCompare(b.route))

const selected = candidates.slice(0, 20)
const frozen = {
  schemaVersion: 'maha-evidence-batch-4-cohort/1.0',
  batch: 'source-acquisition-4',
  frozenAt: '2026-09-02',
  frozenBeforeSearching: false,
  frozenBeforeSearchingNote: 'Batch 4 inverted the order deliberately: collections were searched first and pages mapped to what was found. The cohort is therefore recorded after acquisition, and the honesty guarantee comes from the claim-by-claim mapping rather than from the freeze order.',
  poolSize: blocked.length,
  scoringModel: {
    factors: ['likelihood a lawful full text exists for the subject', 'independent rather than vendor authorship', 'typed internal links', 'current evidence state'],
    familySizeUsed: false,
    positionalSiblingsUsed: false,
  },
  selected: selected.length,
  bySubject: selected.reduce((m: Record<string, number>, s) => { m[s.subject] = (m[s.subject] ?? 0) + 1; return m }, {}),
  targets: selected,
  cohortDigest: '',
}
frozen.cohortDigest = sha({ ...frozen, cohortDigest: '' })
mkdirSync('content/evidence-batch-4', { recursive: true })
const PATH = 'content/evidence-batch-4/frozen-cohort.json'
if (existsSync(PATH)) console.log(JSON.stringify({ refused: 'cohort already frozen' }, null, 2))
else {
  writeFileSync(PATH, `${JSON.stringify(frozen, null, 2)}\n`)
  console.log(JSON.stringify({ pool: frozen.poolSize, selected: frozen.selected, bySubject: frozen.bySubject, digest: frozen.cohortDigest }, null, 2))
}
