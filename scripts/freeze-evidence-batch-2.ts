import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }

/**
 * Freezes the Batch 2 cohort before any source is searched for.
 *
 * Selection runs on structure alone: subject clusters that one source could
 * plausibly serve, how connected a page is, and whether its subject is one
 * where independent literature exists at all. Nothing here looks at what was
 * found, because a cohort chosen after the search is a cohort chosen to
 * succeed.
 */

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`

type Page = {
  route: string; family: string; slug: string; eligible: boolean
  after: { explanatorySources: number; sourceCount: number; relatedRouteCount: number; bridgeCount: number } | null
  before: { sourceCount: number; relatedRouteCount: number; bridgeCount: number }
}
const pages = compiled.pages as unknown as Page[]

const blocked = pages.filter((p) => !p.eligible)
const structural = pages.filter((p) => p.eligible && (p.after?.explanatorySources ?? 0) === 0)

/** Subject clusters where one inspected source can serve several pages. */
// `priority` reflects the subject areas this batch was asked to target. It is
// weighted above cluster size, or the largest families simply win regardless
// of whether they are the ones that need evidence most.
const CLUSTERS: { id: string; pattern: RegExp; independentLiteratureLikely: boolean; vendorReliant: boolean; priority: number }[] = [
  { id: 'metrology-and-process-control', pattern: /metrolog|inspect|overlay|critical-dimension|defect|yield|statistical-process/i, independentLiteratureLikely: true, vendorReliant: false, priority: 10 },
  { id: 'lithography-and-pattern-transfer', pattern: /lithograph|mask|reticle|resist|patterning|scanner|euv|photomask/i, independentLiteratureLikely: true, vendorReliant: false, priority: 10 },
  { id: 'deposition-and-etch', pattern: /deposit|etch|cvd|ald|pvd|epitax|sputter|anneal|implant/i, independentLiteratureLikely: true, vendorReliant: false, priority: 10 },
  { id: 'planarization-and-interconnect', pattern: /planariz|cmp|interconnect|damascene|copper/i, independentLiteratureLikely: true, vendorReliant: false, priority: 10 },
  { id: 'advanced-packaging', pattern: /packag|bonding|substrate|redistribution|underfill|molding|dicing|thinning|stack|test/i, independentLiteratureLikely: true, vendorReliant: false, priority: 10 },
  { id: 'supplier-vendor-reliant', pattern: /^\/knowledge\/suppliers\//, independentLiteratureLikely: false, vendorReliant: true, priority: 6 },
  { id: 'neuromorphic-and-biocomputing', pattern: /neuromorphic|organoid|synapt|spiking|electrode|biocomput/i, independentLiteratureLikely: true, vendorReliant: false, priority: 3 },
  { id: 'astronomy-and-measurement', pattern: /^\/knowledge\/astronomy\//, independentLiteratureLikely: true, vendorReliant: false, priority: 2 },
]

const clusterOf = (route: string) => CLUSTERS.find((c) => c.pattern.test(route))?.id ?? 'other'
const clusterMeta = (id: string) => CLUSTERS.find((c) => c.id === id)

const candidates = [...blocked, ...structural].map((page) => {
  const cluster = clusterOf(page.route)
  const meta = clusterMeta(cluster)
  const shape = page.after ?? page.before
  const links = shape.relatedRouteCount + shape.bridgeCount
  const siblings = [...blocked, ...structural].filter((p) => clusterOf(p.route) === cluster).length
  return {
    route: page.route, family: page.family, cluster,
    state: page.eligible ? 'structural-only' : 'blocked',
    currentSources: shape.sourceCount,
    internalLinks: links,
    pagesOneSourceCouldServe: siblings,
    independentLiteratureLikely: meta?.independentLiteratureLikely ?? false,
    vendorReliant: meta?.vendorReliant ?? false,
    priority: meta?.priority ?? 0,
    score: Number((
      (meta?.priority ?? 0) * 2.0
      + Math.min(siblings, 12) * 0.4
      + links * 0.5
      + (meta?.independentLiteratureLikely ? 3 : 0)
      + (page.eligible ? 0 : 2)
      + shape.sourceCount * 0.3
    ).toFixed(2)),
  }
}).sort((a, b) => b.score - a.score || a.route.localeCompare(b.route))

// Spread across clusters so one subject cannot take the whole cohort.
const perCluster = new Map<string, number>()
const selected: typeof candidates = []
for (const candidate of candidates) {
  if (selected.length >= 25) break
  const used = perCluster.get(candidate.cluster) ?? 0
  if (used >= 5) continue
  perCluster.set(candidate.cluster, used + 1)
  selected.push(candidate)
}

const frozen = {
  schemaVersion: 'maha-evidence-batch-2-cohort/1.0',
  batch: 'evidence-recovery-2',
  frozenAt: '2026-09-02',
  frozenBeforeSearching: true,
  poolSize: candidates.length,
  pool: { blocked: blocked.length, structuralOnly: structural.length },
  scoringModel: {
    factors: [
      'pages one inspected source could serve, via subject cluster',
      'graph centrality: related routes plus typed bridges',
      'whether independent literature plausibly exists for the subject',
      'independence from vendors',
      'existing source count as a proxy for technical depth',
    ],
    searchRelevance: 'not used; no privacy-safe query-level data exists locally',
    clusterCap: 5,
    priorityWeighting: 'The six subject areas this batch targets are weighted above cluster size, so the largest families do not win by volume alone.',
  },
  selected: selected.length,
  byCluster: Object.fromEntries([...perCluster.entries()].sort()),
  byState: {
    blocked: selected.filter((s) => s.state === 'blocked').length,
    structuralOnly: selected.filter((s) => s.state === 'structural-only').length,
  },
  targets: selected,
  cohortDigest: '',
}
frozen.cohortDigest = sha({ ...frozen, cohortDigest: '' })
mkdirSync('content/evidence-batch-2', { recursive: true })
const COHORT_PATH = 'content/evidence-batch-2/frozen-cohort.json'
// A freeze that quietly re-freezes is not a freeze. Once the cohort exists it
// is the record of what was chosen before searching, and re-running this
// script after inspections would silently replace it with a cohort chosen
// after the fact.
if (existsSync(COHORT_PATH)) {
  console.log(JSON.stringify({ refused: 'cohort already frozen', path: COHORT_PATH,
    reason: 'Delete it deliberately to re-freeze; it will not be overwritten by a re-run.' }, null, 2))
} else {
  writeFileSync(COHORT_PATH, `${JSON.stringify(frozen, null, 2)}\n`)
}
console.log(JSON.stringify({
  pool: frozen.pool, selected: frozen.selected, byCluster: frozen.byCluster,
  byState: frozen.byState, digest: frozen.cohortDigest,
}, null, 2))
