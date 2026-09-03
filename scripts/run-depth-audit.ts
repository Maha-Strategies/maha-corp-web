import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { auditDepth, type DepthMeasures } from '../lib/page-depth-audit.ts'
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }
import supplier from '../content/evidence-batch-5/supplier-first-party.json' with { type: 'json' }
import reuse from '../content/evidence-batch-7/reuse-audit.json' with { type: 'json' }
import batch8 from '../content/evidence-batch-8/inspections.json' with { type: 'json' }
import batch1 from '../content/semiconductor-evidence/batch-1.json' with { type: 'json' }
import batch2 from '../content/evidence-batch-2/inspections.json' with { type: 'json' }
import batch3 from '../content/evidence-batch-3/inspections.json' with { type: 'json' }
import batch4 from '../content/evidence-batch-4/inspections.json' with { type: 'json' }

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`

/** Routes whose claims are tied to a named inspected passage, and how many. */
const passagesByRoute = new Map<string, number>()
const locatorsByRoute = new Map<string, number>()
const add = (route: string, locators: number) => {
  passagesByRoute.set(route, (passagesByRoute.get(route) ?? 0) + 1)
  locatorsByRoute.set(route, (locatorsByRoute.get(route) ?? 0) + locators)
}
for (const s of [...(batch1.inspected as Record<string, unknown>[]), ...(batch2.inspected as Record<string, unknown>[]), ...(batch3.inspected as Record<string, unknown>[])]) {
  for (const r of (s.supportsRoutes as string[] | undefined) ?? []) add(r, ((s.exactLocators as string[] | undefined) ?? []).length)
}
for (const s of [...(batch4.inspected as Record<string, unknown>[]), ...(batch8.inspected as Record<string, unknown>[])]) {
  for (const c of (s.claimByClaimSupport as { route: string }[] | undefined) ?? []) add(c.route, 1)
}
for (const e of reuse.accepted as { route: string }[]) add(e.route, 1)

const firstPartyRoutes = new Set((supplier.inspected as { route: string; eligible: boolean }[])
  .filter((e) => e.eligible).map((e) => e.route))
const VENDOR_BACKED = new Set(['/knowledge/suppliers/asml', '/knowledge/suppliers/tokyo-electron', '/knowledge/suppliers/amkor-technology'])

type Page = {
  route: string; eligible: boolean; sections?: { dimension: string; heading: string; items: string[] }[]
  after: { dimensionCount: number; relatedRouteCount: number; bridgeCount: number; explanatorySources: number } | null
  before: { dimensionCount: number; relatedRouteCount: number; bridgeCount: number }
}
const pages = compiled.pages as unknown as Page[]

const measure = (page: Page): DepthMeasures => {
  const shape = page.after ?? page.before
  const sections = page.sections ?? []
  const items = sections.flatMap((s) => s.items)
  const direct = sections.find((s) => s.dimension === 'direct-answer')?.items[0] ?? ''
  return {
    directAnswerChars: direct.length,
    hasMechanismOrDerivation: sections.some((s) => s.dimension === 'mechanism-or-method'),
    hasTechnicalContext: sections.filter((s) => s.dimension === 'mechanism-or-method').length > 1,
    // Each rendered item under an explanatory dimension is one claim.
    explanatoryClaims: sections.filter((s) => ['mechanism-or-method', 'bounded-comparison', 'deterministic-calculation'].includes(s.dimension))
      .reduce((n, s) => n + s.items.length, 0),
    claimsWithPassage: passagesByRoute.get(page.route) ?? 0,
    exactLocators: locatorsByRoute.get(page.route) ?? 0,
    limitations: sections.filter((s) => s.dimension === 'limitations').reduce((n, s) => n + s.items.length, 0),
    unresolvedQuestions: sections.filter((s) => s.dimension === 'not-established').reduce((n, s) => n + s.items.length, 0),
    supportedComparisons: sections.filter((s) => s.dimension === 'bounded-comparison').length,
    reproducibleCalculations: sections.filter((s) => s.dimension === 'deterministic-calculation').length,
    typedRelatedRecords: shape.relatedRouteCount,
    typedBridges: shape.bridgeCount,
    structuredDataFields: 9,
    renderedDimensions: shape.dimensionCount,
    wordCountDiagnostic: items.join(' ').split(/\s+/).filter(Boolean).length,
  }
}

const classify = (page: Page): 'independent' | 'first-party' | 'structural' | 'blocked' => {
  if (firstPartyRoutes.has(page.route) || VENDOR_BACKED.has(page.route)) return 'first-party'
  if (!page.eligible) return 'blocked'
  return (page.after?.explanatorySources ?? 0) > 0 ? 'independent' : 'structural'
}

const independent = pages.filter((p) => classify(p) === 'independent')
const firstParty = pages.filter((p) => classify(p) === 'first-party')
const structuralAll = pages.filter((p) => classify(p) === 'structural')
// A deterministic sample: every fourth structural page by sorted route.
const sample = [...structuralAll].sort((a, b) => a.route.localeCompare(b.route))
  .filter((_, i) => i % Math.ceil(structuralAll.length / 20) === 0).slice(0, 20)

const audited = [...independent, ...firstParty, ...sample]
  .map((page) => auditDepth(page.route, measure(page), classify(page)))

const tally = (group: typeof audited) => group.reduce((m: Record<string, number>, v) => {
  m[v.state] = (m[v.state] ?? 0) + 1; return m
}, {})

const byGroup = {
  independentlySupported: { audited: independent.length, states: tally(audited.filter((a) => independent.some((p) => p.route === a.route))) },
  firstPartyDocumented: { audited: firstParty.length, states: tally(audited.filter((a) => firstParty.some((p) => p.route === a.route))) },
  structuralSample: { sampledFrom: structuralAll.length, audited: sample.length, states: tally(audited.filter((a) => sample.some((p) => p.route === a.route))) },
}

const report = {
  schemaVersion: 'maha-page-depth-audit/1.0',
  auditedAt: '2026-09-03',
  finding: 'Classification and substance are different measurements. A page can carry an inspected source and explain almost nothing, and a structural page can be richly written and cite nothing checkable.',
  wordCountUsedAsGate: false,
  totalAudited: audited.length,
  byGroup,
  substantialAndEvidenceBacked: audited.filter((a) => a.state === 'substantial-and-evidence-backed').length,
  thinnestSupported: audited.filter((a) => a.state === 'evidence-backed-but-thin')
    .sort((a, b) => a.substantialityScore - b.substantialityScore).slice(0, 12)
    .map((a) => ({ route: a.route, score: a.substantialityScore, reasons: a.reasons })),
  verdicts: audited,
  boundary: 'A private audit. It changes no page.',
  auditDigest: '',
}
report.auditDigest = sha({ ...report, auditDigest: '' })
mkdirSync('content/evidence-batch-9', { recursive: true })
writeFileSync('content/evidence-batch-9/depth-audit.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ totalAudited: report.totalAudited, byGroup, substantialAndEvidenceBacked: report.substantialAndEvidenceBacked }, null, 2))
