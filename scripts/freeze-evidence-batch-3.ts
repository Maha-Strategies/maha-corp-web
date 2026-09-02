import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }

/**
 * Freezes 30 Batch 3 targets before any searching.
 *
 * Batch 2 scored on how many siblings shared a subject, which rewarded the
 * biggest families rather than the pages most in need. Sibling count is gone.
 * What remains is the subject's own priority, how connected the page is, and
 * whether independent literature plausibly exists for it. A source may still
 * end up serving several pages, but it has to earn each one record by record.
 */

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`

type Page = {
  route: string; family: string; eligible: boolean
  after: { explanatorySources: number; sourceCount: number; relatedRouteCount: number; bridgeCount: number; dimensionCount: number } | null
  before: { sourceCount: number; relatedRouteCount: number; bridgeCount: number; dimensionCount: number }
}
const pages = compiled.pages as unknown as Page[]
const blocked = pages.filter((p) => !p.eligible)
const structural = pages.filter((p) => p.eligible && (p.after?.explanatorySources ?? 0) === 0)

const SUBJECTS: { id: string; pattern: RegExp; priority: number; literature: boolean }[] = [
  { id: 'semiconductor-metrology', pattern: /metrolog|overlay|critical-dimension|film-metrology/i, priority: 10, literature: true },
  { id: 'defect-inspection', pattern: /defect|inspect|patterned-wafer|review-and-inspection/i, priority: 10, literature: true },
  { id: 'lithography-and-overlay', pattern: /lithograph|mask|reticle|resist|scanner|euv|patterning/i, priority: 10, literature: true },
  { id: 'deposition-and-etching', pattern: /deposit|etch|cvd|ald|pvd|epitax|sputter|implant|anneal/i, priority: 10, literature: true },
  { id: 'cmp', pattern: /planariz|cmp|polish/i, priority: 10, literature: true },
  { id: 'advanced-packaging', pattern: /packag|bonding|substrate|redistribution|underfill|molding|dicing|thinning|stack|interconnect/i, priority: 10, literature: true },
  { id: 'process-control-and-yield', pattern: /yield|statistical-process|process-control|contamination|cleanroom/i, priority: 10, literature: true },
  { id: 'mathematics', pattern: /^\/knowledge\/mathematics\//, priority: 7, literature: true },
  { id: 'neuromorphic', pattern: /^\/knowledge\/neuromorphic-biocomputing\//, priority: 7, literature: true },
  { id: 'astronomy', pattern: /^\/knowledge\/astronomy\//, priority: 7, literature: true },
]

const subjectOf = (route: string) => SUBJECTS.find((s) => s.pattern.test(route))
const candidates = [...blocked, ...structural].map((page) => {
  const subject = subjectOf(page.route)
  const shape = page.after ?? page.before
  const connectivity = shape.relatedRouteCount + shape.bridgeCount
  return {
    route: page.route, family: page.family,
    subject: subject?.id ?? 'other',
    state: page.eligible ? 'structural-only' : 'blocked',
    currentSources: shape.sourceCount,
    typedInternalLinks: connectivity,
    dimensions: shape.dimensionCount,
    // No sibling count anywhere in this expression.
    score: Number((
      (subject?.priority ?? 0) * 2
      + connectivity * 0.6
      + (subject?.literature ? 3 : 0)
      + (page.eligible ? 0 : 2)
      + shape.sourceCount * 0.4
    ).toFixed(2)),
  }
}).sort((a, b) => b.score - a.score || a.route.localeCompare(b.route))

const perSubject = new Map<string, number>()
const selected: typeof candidates = []
for (const candidate of candidates) {
  if (selected.length >= 30) break
  const used = perSubject.get(candidate.subject) ?? 0
  if (used >= 6) continue
  perSubject.set(candidate.subject, used + 1)
  selected.push(candidate)
}

const frozen = {
  schemaVersion: 'maha-evidence-batch-3-cohort/1.0',
  batch: 'evidence-recovery-3',
  frozenAt: '2026-09-02',
  frozenBeforeSearching: true,
  pool: { blocked: blocked.length, structuralOnly: structural.length, total: candidates.length },
  scoringModel: {
    factors: ['subject priority', 'typed internal links', 'plausible independent literature', 'blocked pages weighted above structural', 'existing source count as a depth proxy'],
    siblingCountUsed: false,
    siblingCountNote: 'Deliberately excluded. Batch 2 rewarded large families rather than pages most in need, and a source must earn each page record by record.',
    subjectCap: 6,
    searchRelevance: 'not used; no privacy-safe query-level data exists locally',
  },
  selected: selected.length,
  bySubject: Object.fromEntries([...perSubject.entries()].sort()),
  byState: {
    blocked: selected.filter((s) => s.state === 'blocked').length,
    structuralOnly: selected.filter((s) => s.state === 'structural-only').length,
  },
  targets: selected,
  cohortDigest: '',
}
frozen.cohortDigest = sha({ ...frozen, cohortDigest: '' })

mkdirSync('content/evidence-batch-3', { recursive: true })
const PATH = 'content/evidence-batch-3/frozen-cohort.json'
if (existsSync(PATH)) {
  console.log(JSON.stringify({ refused: 'cohort already frozen', path: PATH }, null, 2))
} else {
  writeFileSync(PATH, `${JSON.stringify(frozen, null, 2)}\n`)
  console.log(JSON.stringify({ pool: frozen.pool, selected: frozen.selected, bySubject: frozen.bySubject, byState: frozen.byState, digest: frozen.cohortDigest }, null, 2))
}
