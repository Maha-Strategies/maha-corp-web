import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { KNOWLEDGE_ARTICLES } from '../lib/knowledge-data.ts'
import attestations from '../content/legacy-uplift/inspection-attestations.json' with { type: 'json' }
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }

/**
 * Every page that inherited independent status from a vendor's own document.
 *
 * The fix is at the source, not the route, so no exclusion list has to be
 * maintained: a source's evidence class travels to whatever cites it, and a
 * page added tomorrow inherits it without anyone remembering to add it here.
 * This ledger records what changed, it does not drive the change.
 */

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
const VENDOR = new Set((attestations.attestations as { sourceId: string }[]).map((a) => a.sourceId))
const KIND: Record<string, string> = {
  equipment: 'equipment', process: 'processes', material: 'materials',
  supplier: 'suppliers', concept: 'concepts', domain: 'domains',
}
type Page = { route: string; eligible: boolean; after: { explanatorySources: number } | null }
const byRoute = new Map((compiled.pages as unknown as Page[]).map((p) => [p.route, p]))

const citing = (KNOWLEDGE_ARTICLES as unknown as { kind: string; slug: string; sourceIds?: string[] }[])
  .filter((a) => (a.sourceIds ?? []).some((id) => VENDOR.has(id)))
  .map((a) => {
    const route = `/knowledge/${KIND[a.kind] ?? a.kind}/${a.slug}`
    const vendorSources = (a.sourceIds ?? []).filter((id) => VENDOR.has(id))
    const otherSources = (a.sourceIds ?? []).filter((id) => !VENDOR.has(id))
    const page = byRoute.get(route)
    const stillIndependent = (page?.after?.explanatorySources ?? 0) > 0
    return {
      route,
      vendorSourcesCited: vendorSources,
      otherSourcesCited: otherSources.length,
      before: 'independently-source-supported',
      after: stillIndependent ? 'independently-source-supported' : 'structurally-uplifted',
      changed: !stillIndependent,
      reason: stillIndependent
        ? 'Mixed-source page. It keeps independent status through a separate inspected source, and the vendor document contributes nothing to that status.'
        : 'Its only inspected source was the vendor’s own documentation, which is first-party evidence wherever it is cited.',
    }
  })
  .sort((a, b) => a.route.localeCompare(b.route))

const ledger = {
  schemaVersion: 'maha-vendor-correction-ledger/1.0',
  correctedAt: '2026-09-03',
  vendorAuthoredSources: [...VENDOR].sort(),
  mechanism: {
    scope: 'source-level',
    hardcodedRouteExclusions: 0,
    propagation: 'A source carries its evidence class to every page citing it, so a page added later inherits the class without being listed anywhere.',
    mixedSourceRule: 'A page citing both a vendor document and an independent source keeps independent status through the independent source only.',
  },
  pagesCitingVendorSources: citing.length,
  correctedToStructural: citing.filter((c) => c.changed).length,
  retainedIndependentViaOtherSource: citing.filter((c) => !c.changed).length,
  pages: citing,
  boundary: 'A public-safe ledger of status changes. It carries no inspection rationale and no passage.',
  ledgerDigest: '',
}
ledger.ledgerDigest = sha({ ...ledger, ledgerDigest: '' })
mkdirSync('content/evidence-batch-10', { recursive: true })
writeFileSync('content/evidence-batch-10/vendor-correction-ledger.json', `${JSON.stringify(ledger, null, 2)}\n`)
console.log(JSON.stringify({
  pagesCiting: ledger.pagesCitingVendorSources,
  corrected: ledger.correctedToStructural,
  retainedViaOtherSource: ledger.retainedIndependentViaOtherSource,
  hardcodedExclusions: ledger.mechanism.hardcodedRouteExclusions,
}, null, 2))
