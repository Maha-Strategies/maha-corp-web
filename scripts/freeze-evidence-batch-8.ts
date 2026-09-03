import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }

/**
 * Thirty structural pages in domains where lawful open literature actually
 * exists.
 *
 * Six batches of semiconductor search established that industrial process
 * engineering is largely closed. Astronomy, mathematics, neuromorphic research
 * and religious studies are not: they have arXiv, PubMed Central, open-access
 * journals, and primary texts in declared editions. This batch goes where the
 * sources are rather than where the blocked pages happen to be.
 */

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
type Page = {
  route: string; eligible: boolean
  after: { explanatorySources: number; sourceCount: number; relatedRouteCount: number; bridgeCount: number; dimensionCount: number } | null
}
const structural = (compiled.pages as unknown as Page[])
  .filter((p) => p.eligible && (p.after?.explanatorySources ?? 0) === 0)

const DOMAINS: { id: string; pattern: RegExp; openLiterature: number; stableIdentifiers: number }[] = [
  { id: 'astronomy', pattern: /^\/knowledge\/astronomy\//, openLiterature: 10, stableIdentifiers: 10 },
  { id: 'mathematics', pattern: /^\/knowledge\/mathematics\//, openLiterature: 9, stableIdentifiers: 9 },
  { id: 'neuromorphic', pattern: /^\/knowledge\/neuromorphic-biocomputing\//, openLiterature: 9, stableIdentifiers: 8 },
  { id: 'religion', pattern: /^\/knowledge\/religion\//, openLiterature: 7, stableIdentifiers: 6 },
]

const candidates = structural.map((page) => {
  const domain = DOMAINS.find((d) => d.pattern.test(page.route))
  if (!domain) return null
  const shape = page.after!
  const connectivity = shape.relatedRouteCount + shape.bridgeCount
  return {
    route: page.route,
    domain: domain.id,
    isComparison: page.route.includes('/comparisons/'),
    currentSources: shape.sourceCount,
    typedInternalLinks: connectivity,
    dimensions: shape.dimensionCount,
    // No family size anywhere: the weights are about whether a lawful full
    // text plausibly exists and whether the page can name an exact passage.
    score: Number((
      domain.openLiterature * 1.5
      + domain.stableIdentifiers * 1.0
      + connectivity * 0.7
      + shape.sourceCount * 0.5
      + shape.dimensionCount * 0.3
    ).toFixed(2)),
  }
}).filter((c): c is NonNullable<typeof c> => c !== null)
  .sort((a, b) => b.score - a.score || a.route.localeCompare(b.route))

// Spread across domains so one does not consume the cohort.
const perDomain = new Map<string, number>()
const selected: typeof candidates = []
for (const candidate of candidates) {
  if (selected.length >= 30) break
  const used = perDomain.get(candidate.domain) ?? 0
  if (used >= 9) continue
  perDomain.set(candidate.domain, used + 1)
  selected.push(candidate)
}

const frozen = {
  schemaVersion: 'maha-evidence-batch-8-cohort/1.0',
  batch: 'open-literature-depth-8',
  frozenAt: '2026-09-03',
  frozenBeforeSearching: true,
  domainShift: 'Away from semiconductor process engineering, where six batches established the open-access ceiling, toward domains whose literature is genuinely open.',
  exhaustedRoutesNotRetried: ['IEEE Xplore', 'SPIE', 'ECTC proceedings', 'CMP mechanism searches', 'vendor 403 paths', 'reCAPTCHA-walled PMC articles'],
  poolSize: candidates.length,
  scoringModel: {
    factors: ['lawful open literature for the domain', 'stable identifiers', 'typed internal links', 'existing source count', 'information dimensions'],
    familySizeUsed: false,
    domainCap: 9,
  },
  selected: selected.length,
  byDomain: Object.fromEntries([...perDomain.entries()].sort()),
  targets: selected,
  cohortDigest: '',
}
frozen.cohortDigest = sha({ ...frozen, cohortDigest: '' })
mkdirSync('content/evidence-batch-8', { recursive: true })
const PATH = 'content/evidence-batch-8/frozen-cohort.json'
if (existsSync(PATH)) console.log(JSON.stringify({ refused: 'cohort already frozen' }, null, 2))
else {
  writeFileSync(PATH, `${JSON.stringify(frozen, null, 2)}\n`)
  console.log(JSON.stringify({ pool: frozen.poolSize, selected: frozen.selected, byDomain: frozen.byDomain, digest: frozen.cohortDigest }, null, 2))
}
