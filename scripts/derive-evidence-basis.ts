import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { BASIS_CONTRACT, EVIDENCE_BASES, publicStateFor, type EvidenceBasis } from '../lib/evidence-basis.ts'

type Src = { id: string; url: string; title: string }

const collected = new Map<string, Src>()
for (const b of [2, 3, 4, 6, 8, 9]) {
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) { x.forEach(walk); return }
    if (x && typeof x === 'object') {
      const o = x as Record<string, string>
      if (o.sourceId && !collected.has(o.sourceId)) {
        collected.set(o.sourceId, { id: o.sourceId, url: o.retrievedFrom ?? '', title: o.title ?? '' })
      }
      Object.values(x).forEach(walk)
    }
  }
  walk(JSON.parse(readFileSync(`content/evidence-batch-${b}/inspections.json`, 'utf8')).inspected)
}
for (const a of JSON.parse(readFileSync('content/legacy-uplift/inspection-attestations.json', 'utf8')).attestations as Record<string, string>[]) {
  if (!collected.has(a.sourceId)) collected.set(a.sourceId, { id: a.sourceId, url: a.retrievedFrom, title: a.sourceId })
}

/**
 * Basis is derived from what the publisher is, not from what we want the page
 * to count as. A host alone is not enough: nvlpubs.nist.gov and dlmf.nist.gov
 * are the same institution publishing two different kinds of thing, so the
 * mathematical library is separated from the measurement guideline.
 */
function deriveBasis(src: Src): { basis: EvidenceBasis; because: string } {
  const host = (() => { try { return new URL(src.url).hostname.replace(/^www\./, '') } catch { return '' } })()
  if (host === 'dlmf.nist.gov') {
    return { basis: 'formal-mathematical', because: 'A reference library of proved identities; each entry holds at its stated scope by derivation, not by measurement.' }
  }
  if (host === 'nvlpubs.nist.gov' || host.endsWith('osti.gov')) {
    return { basis: 'government-or-standards-authority', because: 'Published by a government body defining method or reporting programme capability, not an independently reviewed experimental finding.' }
  }
  if (['arxiv.org', 'frontiersin.org', 'pmc.ncbi.nlm.nih.gov'].includes(host)) {
    return { basis: 'independent-scientific-or-technical', because: 'A research report by authors other than the subject, who could have reported otherwise.' }
  }
  if (['asml.com', 'tel.com', 'amkor.com'].includes(host)) {
    return { basis: 'first-party-documentation', because: 'The vendor describing its own equipment; corrected out of independent support in Batch 10.' }
  }
  return { basis: 'inaccessible-or-unsupported', because: 'No basis could be derived from the publisher.' }
}

const assignments = [...collected.values()].sort((a, b) => a.id.localeCompare(b.id)).map((src) => {
  const { basis, because } = deriveBasis(src)
  return {
    sourceId: src.id, title: src.title, retrievedFrom: src.url, basis, because,
    publicState: publicStateFor(basis),
    countsAsIndependentSupport: BASIS_CONTRACT[basis].countsAsIndependentSupport,
    cannotEstablish: BASIS_CONTRACT[basis].cannotEstablish,
  }
})

const byBasis = Object.fromEntries(EVIDENCE_BASES.map((b) => [b, assignments.filter((a) => a.basis === b).length]))

const ledger = {
  schemaVersion: 'maha-evidence-basis-ledger/1.0',
  batch: 'substantial-evidence-conversion-batch-11',
  derivedOn: '2026-09-03',
  appendOnly: true,
  writtenToProduction: false,
  method: 'Derived from the publisher of each already-inspected source. No source was reopened and no page changed state as a result.',
  migrationSafety: {
    priorLabel: 'independently-source-supported',
    priorCount: assignments.filter((a) => a.countsAsIndependentSupport).length,
    newCountUnderSameLabel: assignments.filter((a) => a.publicState === 'independently-source-supported').length,
    pagesChangingState: 0,
    note: 'The five public page states are preserved. One new state, textually-source-supported, exists for primary-textual and secondary-historical evidence; no source carries it yet, so no page moves.',
  },
  finding: 'The single label "independently supported" was covering three distinct bases: independent scientific reports, government and standards publications, and formal mathematical references. They are now named separately.',
  distributionByBasis: byBasis,
  assignments,
  boundary: 'This ledger records what kind of authority each source carries. It does not assert that any page is deeper, and it does not add or remove support from any page.',
}

writeFileSync('content/evidence-batch-11/basis-ledger.json', `${JSON.stringify(ledger, null, 2)}\n`)
console.log('sources classified:', assignments.length)
for (const [b, n] of Object.entries(byBasis)) if (n > 0) console.log(`  ${String(n).padStart(2)}  ${b}`)
console.log('digest:', createHash('sha256').update(canonicalJson(ledger), 'utf8').digest('hex').slice(0, 16))
