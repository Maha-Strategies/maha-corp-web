import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { summariseFamily } from '../lib/legacy-index-summary.ts'
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }
import registry from '../content/evidence-batch-6/retrieval-registry.json' with { type: 'json' }
import reuse from '../content/evidence-batch-7/reuse-audit.json' with { type: 'json' }
import supplier from '../content/evidence-batch-5/supplier-first-party.json' with { type: 'json' }

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
type Page = { route: string; eligible: boolean; after: { explanatorySources: number } | null }
const pages = compiled.pages as unknown as Page[]
const firstParty = new Set((supplier.inspected as { route: string; eligible: boolean }[]).filter((e) => e.eligible).map((e) => e.route))
const blocked = pages.filter((p) => !p.eligible && !firstParty.has(p.route))

/* ----------------------------- Part 2: barriers and acquisition packets ---- */

type Barrier = 'institutional-access-required' | 'first-party-access-blocked' | 'dead-citation-requiring-replacement'
  | 'lawful-copy-not-located' | 'source-mismatch' | 'claim-too-specific-for-available-evidence'

const priorAttempts = (route: string) => (registry.attempts as { sourceIdentity: string; url: string; responseClass: string }[])
  .filter((a) => route.includes(a.sourceIdentity.split('-')[0])).length

const classify = (route: string): { barrier: Barrier; replacementAllowed: boolean; sufficient: string } => {
  if (route.startsWith('/knowledge/suppliers/')) {
    return {
      barrier: 'first-party-access-blocked',
      replacementAllowed: true,
      sufficient: 'Any official public document from this company that names product families or process functions rather than adjectives. A brochure PDF, datasheet or regulatory filing would suffice.',
    }
  }
  if (/planariz|cmp|copper-interconnect|backgrinder/.test(route)) {
    return {
      barrier: 'lawful-copy-not-located',
      replacementAllowed: true,
      sufficient: 'A section of a CMP mechanism study covering material removal on copper, from a journal, thesis or repository copy. Four route families across four batches returned only patents, which are excluded.',
    }
  }
  if (/packag|dicing|thinning|underfill|molding|substrate|redistribution|singulation|bonding/.test(route)) {
    return {
      barrier: 'institutional-access-required',
      replacementAllowed: false,
      sufficient: 'A section of an ECTC or equivalent packaging proceedings paper describing the named process. The known replacement for the dead Amkor citation is IEEE Xplore document 9159536.',
    }
  }
  if (/burn-in|system-level-test|automatic-test|wafer-sort|acceptance-test|final-test|qualification|reliability|failure-analysis/.test(route)) {
    return {
      barrier: 'institutional-access-required',
      replacementAllowed: true,
      sufficient: 'A section of a reliability or test-engineering reference describing burn-in acceleration or wafer sort. Open repositories returned only patents.',
    }
  }
  if (/eda-compute|rtl-verification|ic-design-to-tapeout|signoff/.test(route)) {
    return {
      barrier: 'claim-too-specific-for-available-evidence',
      replacementAllowed: true,
      sufficient: 'Either an inspected source describing the named design-flow stage, or a narrowed claim confined to what an open source can support.',
    }
  }
  return {
    barrier: 'lawful-copy-not-located',
    replacementAllowed: true,
    sufficient: 'A section-level inspected source describing this page’s named process or equipment.',
  }
}

const packets = blocked.map((page) => {
  const c = classify(page.route)
  const body = {
    packetVersion: 'maha-acquisition-packet/1.0',
    route: page.route,
    claim: 'the page’s explanatory claims, which currently rest on no inspected source',
    currentSourceIdentity: 'none inspected',
    authoritativeIdentifier: null,
    requiredVersion: 'any version whose inspected section covers the named process or equipment',
    preferredLawfulCopyTypes: ['publisher version of record', 'accepted manuscript', 'institutional repository copy', 'author-hosted copy'],
    sectionNeeded: 'the section, figure or table describing the page’s named mechanism or specification',
    priorRetrievalAttempts: priorAttempts(page.route),
    accessBarrier: c.barrier,
    replacementSourceAllowed: c.replacementAllowed,
    evidenceSufficientToUnblock: c.sufficient,
    containsCredentials: false,
    containsFullText: false,
  }
  return { ...body, packetDigest: sha(body) }
})

const barrierCounts = packets.reduce((m: Record<string, number>, p) => { m[p.accessBarrier] = (m[p.accessBarrier] ?? 0) + 1; return m }, {})

/* ------------------------------- Part 5: proposed revisions for reuse ------ */

const revisions = (reuse.accepted as Record<string, string>[]).map((entry) => {
  const body = {
    route: entry.route,
    change: 'a source binding is added and the claim is stated against an exact inspected passage',
    predecessorPreserved: true,
    predecessorState: 'structurally uplifted with no inspected source',
    proposedSource: entry.sourceId,
    exactLocator: entry.exactLocator,
    limitationsCarried: entry.limitationsCarried,
    reviewInheritedFromPredecessor: false,
    reviewInheritanceRefusedBecause: 'the predecessor was reviewed without this source bound to it, so its review says nothing about this binding',
    proposalActive: false,
  }
  const revisionDigest = sha({ ...body, kind: 'revision' })
  return { ...body, revisionDigest, provenanceDigest: sha({ ...body, revisionDigest }) }
})

/* ------------------------------------ Part 7: family index verification ---- */

const FAMILIES = ['astronomy', 'mathematics', 'religion', 'neuromorphic-biocomputing', 'equipment', 'processes', 'suppliers', 'concepts']
const indexes = FAMILIES.map((family) => {
  const children = pages.filter((p) => p.route.startsWith(`/knowledge/${family}/`))
  const summary = summariseFamily(`/knowledge/${family}`, children.map((c) => c.route))
  const independent = children.filter((c) => c.eligible && (c.after?.explanatorySources ?? 0) > 0).length
  const structural = children.filter((c) => c.eligible && (c.after?.explanatorySources ?? 0) === 0).length
  const fp = children.filter((c) => firstParty.has(c.route)).length
  return {
    family,
    children: children.length,
    independentlySupported: independent,
    firstPartyDocumented: fp,
    structuralOnly: structural,
    blocked: children.length - independent - structural - fp,
    disclosure: summary.disclosure,
    impliesIndependentVerification: false,
    countedAsDetailPageCoverage: false,
  }
})

const report = {
  schemaVersion: 'maha-batch-7-artifacts/1.0',
  generatedAt: '2026-09-03',
  acquisitionPackets: { count: packets.length, byBarrier: barrierCounts, packets },
  proposedRevisions: { count: revisions.length, allInactive: revisions.every((r) => !r.proposalActive), revisions },
  familyIndexes: indexes,
  boundary: 'Private acquisition and governance artifacts. No credential and no copyrighted passage appears here.',
  artifactsDigest: '',
}
report.artifactsDigest = sha({ ...report, artifactsDigest: '' })
mkdirSync('content/evidence-batch-7', { recursive: true })
writeFileSync('content/evidence-batch-7/acquisition-and-governance.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ packets: packets.length, byBarrier: barrierCounts,
  proposedRevisions: revisions.length, familyIndexes: indexes.length,
  indexTotals: indexes.map((i) => `${i.family}: ${i.independentlySupported}i/${i.firstPartyDocumented}fp/${i.structuralOnly}s/${i.blocked}b`) }, null, 2))
