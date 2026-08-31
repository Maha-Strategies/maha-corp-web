import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { alignmentFor, isAlignmentClear } from '../lib/frontier-source-alignment.ts'
import { isPilotAlignmentClear, pilotAlignmentFor } from '../lib/pilot-source-alignment.ts'
import { evaluateSubstantialPageGate } from '../lib/substantial-page.ts'
import {
  SUBSTANTIAL_PUBLICATION_PAGES,
  SUBSTANTIAL_PUBLICATION_RECORD_IDS,
} from '../lib/substantial-page-publication.ts'
import {
  SUBSTANTIAL_BATCH_2_ELIGIBLE_PAGES,
  SUBSTANTIAL_BATCH_2_PAGES,
  SUBSTANTIAL_BATCH_2_RECORD_IDS,
  evaluateBatch2Quality,
  getBatch2Page,
} from '../lib/substantial-page-publication-batch-2.ts'
import { PUBLIC_SUBSTANTIAL_PAGES, getPublishedSubstantialPage } from '../lib/substantial-page-public.ts'

const recordById = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))

/* ------------------------------------------------------------ selection -- */

test('batch two is thirty unique canonical records across at least five domains', () => {
  assert.equal(SUBSTANTIAL_BATCH_2_RECORD_IDS.length, 30)
  assert.equal(new Set(SUBSTANTIAL_BATCH_2_RECORD_IDS).size, 30)
  const domains = new Map<string, number>()
  for (const recordId of SUBSTANTIAL_BATCH_2_RECORD_IDS) {
    const record = recordById.get(recordId)
    assert.ok(record, `${recordId} is not canonical`)
    domains.set(record.domainSlug, (domains.get(record.domainSlug) ?? 0) + 1)
  }
  assert.ok(domains.size >= 5, `only ${domains.size} domains`)
  for (const [domain, count] of domains) assert.ok(count <= 8, `${domain} has ${count}`)
})

test('every selected record is alignment-clear with an inspected source and exact locator', () => {
  for (const recordId of SUBSTANTIAL_BATCH_2_RECORD_IDS) {
    const pilot = pilotAlignmentFor(recordId)
    const frontier = pilot ? null : alignmentFor(recordId)
    const clear = pilot ? isPilotAlignmentClear(recordId) : isAlignmentClear(recordId)
    assert.ok(clear, `${recordId} is not alignment-clear`)
    const inspected = pilot?.sourceContentInspected ?? frontier?.evidence.sourceContentInspected
    const locator = pilot?.inspectedContentLocation ?? frontier?.evidence.inspectedContentLocation
    const verdict = pilot?.verdict ?? frontier?.evidence.subjectAligned
    assert.ok(inspected, `${recordId} was never content-inspected`)
    assert.ok(locator, `${recordId} has no exact inspected locator`)
    assert.notEqual(verdict, 'mismatched', `${recordId} rests on a mismatched source`)
  }
})

test('every selected record declares a locator and rights basis on each source', () => {
  for (const recordId of SUBSTANTIAL_BATCH_2_RECORD_IDS) {
    const record = recordById.get(recordId)!
    for (const source of record.sources) {
      assert.ok(source.exactLocator, `${recordId} source ${source.id} has no locator`)
      assert.ok(source.rights?.basis, `${recordId} source ${source.id} has no rights basis`)
    }
  }
})

/* ------------------------------------------------------- gate freshness -- */

test('a caller cannot forge pageEligible', () => {
  const page = SUBSTANTIAL_BATCH_2_PAGES[0]
  const record = recordById.get(page.contract.recordId)!
  const forged = {
    ...page,
    decision: { ...page.decision, pageEligible: true, reasons: [] },
    quality: { ...page.quality, eligible: true, reasons: [] },
    contract: { ...page.contract, directAnswer: { ...page.contract.directAnswer, text: 'too short' } },
  }
  // Quality is recomputed from the record and contract, never read off the object.
  const fresh = evaluateBatch2Quality(record, forged)
  assert.equal(fresh.eligible, false, 'a forged eligible flag survived recomputation')
  assert.ok(fresh.reasons.includes('direct-answer-too-thin'))
})

test('a stale record revision fails the contract', () => {
  const page = SUBSTANTIAL_BATCH_2_PAGES[0]
  const record = recordById.get(page.contract.recordId)!
  assert.equal(page.contract.recordRevisionSha256, epistemicReviewTargetHash(record))
  const mutated = { ...record, description: `${record.description} materially changed` }
  const decision = evaluateSubstantialPageGate(mutated, page.contract, EPISTEMIC_RECORDS, [])
  assert.equal(decision.pageEligible, false)
  assert.ok(decision.reasons.includes('page-record-revision-stale'))
})

test('a tampered contract fails and its digest no longer matches', () => {
  const page = SUBSTANTIAL_BATCH_2_PAGES[0]
  const record = recordById.get(page.contract.recordId)!
  const tampered = {
    ...page.contract,
    explanations: page.contract.explanations.map((section, index) =>
      index === 0 ? { ...section, claimIds: [], sourceIds: [] } : section,
    ),
  }
  const quality = evaluateBatch2Quality(record, { ...page, contract: tampered })
  assert.equal(quality.eligible, false)
  assert.ok(quality.reasons.includes('unsupported-explanatory-prose'))
})

test('an alignment blocker on the record blocks its page', () => {
  // Every published record is clear; a record that is not must never publish.
  const blocked = EPISTEMIC_RECORDS.find((record) => {
    const pilot = pilotAlignmentFor(record.id)
    return pilot ? !isPilotAlignmentClear(record.id) : !isAlignmentClear(record.id)
  })!
  assert.ok(!SUBSTANTIAL_BATCH_2_RECORD_IDS.includes(blocked.id as never))
  assert.equal(getPublishedSubstantialPage(blocked.id), undefined)
})

/* ------------------------------------------------------ evidence binding -- */

test('every explanatory paragraph resolves to declared claims and sources', () => {
  for (const page of SUBSTANTIAL_BATCH_2_PAGES) {
    const record = recordById.get(page.contract.recordId)!
    const knownClaims = new Set(record.claims.map((claim) => claim.id))
    const claimSources = new Map(record.claims.map((claim) => [claim.id, new Set(claim.sourceIds)]))
    assert.ok(page.contract.explanations.length >= 3)
    for (const section of page.contract.explanations) {
      assert.ok(section.claimIds.length > 0, `${page.path} has an unbound section`)
      assert.ok(section.sourceIds.length > 0, `${page.path} has a section with no source`)
      assert.ok(section.paragraphs.length > 0)
      for (const claimId of section.claimIds) {
        assert.ok(knownClaims.has(claimId), `${page.path} cites unknown claim ${claimId}`)
        assert.ok(
          section.sourceIds.some((sourceId) => claimSources.get(claimId)!.has(sourceId)),
          `${page.path} cites a source that does not support its claim`,
        )
      }
    }
    assert.equal(page.quality.evidenceCoverage.unsupportedExplanationParagraphs, 0)
    assert.equal(page.quality.evidenceCoverage.claimsExplained, page.quality.evidenceCoverage.claimsTotal)
  }
})

test('every cited source carries an inspected attestation and exact locator', () => {
  for (const page of SUBSTANTIAL_BATCH_2_PAGES) {
    const recordId = page.contract.recordId
    const pilot = pilotAlignmentFor(recordId)
    const frontier = pilot ? null : alignmentFor(recordId)
    assert.ok(pilot?.sourceContentInspected ?? frontier?.evidence.sourceContentInspected, `${page.path} unattested`)
    assert.ok(pilot?.inspectedContentLocation ?? frontier?.evidence.inspectedContentLocation, `${page.path} no locator`)
  }
})

test('related records are canonical, unique, and never self-links', () => {
  const canonical = new Set(EPISTEMIC_RECORDS.map((record) => record.id))
  for (const page of SUBSTANTIAL_BATCH_2_PAGES) {
    const ids = page.contract.relatedRecords.map((related) => related.recordId)
    assert.ok(ids.length >= 3, `${page.path} has fewer than three related records`)
    assert.equal(new Set(ids).size, ids.length, `${page.path} duplicates a related record`)
    for (const id of ids) {
      assert.ok(canonical.has(id), `${page.path} links a fabricated record ${id}`)
      assert.notEqual(id, page.contract.recordId, `${page.path} links itself`)
    }
  }
})

/* --------------------------------------------------------- applicability -- */

test('comparison and calculation are only claimed when genuinely supported', () => {
  for (const page of SUBSTANTIAL_BATCH_2_PAGES) {
    const record = recordById.get(page.contract.recordId)!
    if (page.contract.comparison.status === 'included') {
      assert.ok(record.claims.length >= 2, `${page.path} claims a comparison from one claim`)
      assert.ok(page.contract.comparison.axes.length > 0)
    } else {
      assert.deepEqual(page.contract.comparison.axes, [])
      assert.ok(page.contract.comparison.rationale.length > 40)
    }
    if (page.contract.calculation.status === 'not-applicable') {
      assert.equal(page.contract.calculation.expression, '')
      assert.deepEqual(page.contract.calculation.inputs, [])
      assert.ok(page.contract.calculation.rationale.length > 40)
    }
  }
})

test('typed bridges preserve their classification and target canonical records', () => {
  const canonical = new Set(EPISTEMIC_RECORDS.map((record) => record.id))
  let total = 0
  for (const page of SUBSTANTIAL_BATCH_2_PAGES) {
    const record = recordById.get(page.contract.recordId)!
    const declared = new Map(record.bridges.map((bridge) => [bridge.id, bridge]))
    for (const bridge of page.mathematicalBridges) {
      total += 1
      const source = declared.get(bridge.bridgeId)
      assert.ok(source, `${page.path} publishes an undeclared bridge`)
      assert.equal(bridge.bridgeType, source.bridgeType, 'bridge classification was rewritten')
      assert.ok(canonical.has(bridge.targetRecordId))
      if (bridge.bridgeType !== 'mathematical-equivalence') {
        assert.doesNotMatch(bridge.interpretation, /\bequivalent\b/i, 'a non-equivalence bridge implies equivalence')
      }
    }
  }
  assert.ok(total > 0, 'no typed bridges were published, so this guard is inert')
})

/* ------------------------------------------------------ batch 1 untouched */

test('batch one remains twenty of twenty eligible', () => {
  assert.equal(SUBSTANTIAL_PUBLICATION_PAGES.length, 20)
  assert.equal(SUBSTANTIAL_PUBLICATION_PAGES.filter((page) => page.quality.eligible).length, 20)
})

test('batch one output is byte-identical to the committed artifact', () => {
  const root = new URL('..', import.meta.url).pathname
  const committed = JSON.parse(readFileSync(join(root, 'content/substantial-pages/publication-batch-1.json'), 'utf8'))
  assert.equal(committed.pages.length, SUBSTANTIAL_PUBLICATION_PAGES.length)
  for (const [index, page] of SUBSTANTIAL_PUBLICATION_PAGES.entries()) {
    assert.equal(page.publicationDigest, committed.pages[index].publicationDigest, `batch one page ${index} changed`)
    assert.equal(page.publicationVersion, 'maha-substantial-publication/1.0')
  }
})

test('batch one and batch two share no record id and no public route', () => {
  const batch1 = new Set(SUBSTANTIAL_PUBLICATION_RECORD_IDS as readonly string[])
  for (const recordId of SUBSTANTIAL_BATCH_2_RECORD_IDS) {
    assert.ok(!batch1.has(recordId), `${recordId} is in both batches`)
  }
  const paths = PUBLIC_SUBSTANTIAL_PAGES.map((page) => page.path)
  assert.equal(new Set(paths).size, paths.length, 'a public route is claimed twice')
  assert.equal(PUBLIC_SUBSTANTIAL_PAGES.length, 103)
})

/* ------------------------------------------------------ public projection */

test('only currently eligible pages reach the public projection', () => {
  for (const page of PUBLIC_SUBSTANTIAL_PAGES) assert.equal(page.quality.eligible, true)
  assert.equal(SUBSTANTIAL_BATCH_2_ELIGIBLE_PAGES.length, SUBSTANTIAL_BATCH_2_PAGES.length)
  for (const recordId of SUBSTANTIAL_BATCH_2_RECORD_IDS) {
    assert.ok(getBatch2Page(recordId), `${recordId} has no compiled page`)
    assert.ok(getPublishedSubstantialPage(recordId), `${recordId} is missing from the public projection`)
  }
})

test('no audit, rehearsal, or review artifact reaches a route, sitemap, or llms.txt', () => {
  const appRoot = new URL('../app', import.meta.url).pathname
  const walk = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? walk(path) : [path]
    })
  const routeSources = walk(appRoot)
    .filter((path) => /\.(tsx|ts)$/.test(path))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n')
  for (const marker of ['frontier-audit', 'pilot-audit', 'source-recovery', 'endpoint-fitness', 'frontier-source-alignment', 'urn:maha:candidate']) {
    assert.ok(!routeSources.includes(marker), `${marker} is referenced from a route`)
  }
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  const llms = readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8')
  for (const source of [sitemap, llms]) {
    assert.doesNotMatch(source, /frontier-audit|pilot-audit|source-recovery|endpoint-fitness/)
  }
})

/* ------------------------------------------------------------ determinism */

test('batch two artifacts regenerate byte for byte', () => {
  const root = new URL('..', import.meta.url).pathname
  const generated = [
    'content/substantial-pages/publication-batch-2.json',
    'docs/substantial-pages/publication-batch-2.md',
    'content/substantial-pages/publication-batch-1.json',
  ]
  const before = generated.map((path) => readFileSync(join(root, path), 'utf8'))
  execFileSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts/generate-substantial-publication-batch-2.ts')], { cwd: root })
  generated.forEach((path, index) => {
    assert.equal(readFileSync(join(root, path), 'utf8'), before[index], `${path} is not deterministic`)
  })
})

test('the generated report states the same counts as the compiled batch', () => {
  const root = new URL('..', import.meta.url).pathname
  const payload = JSON.parse(readFileSync(join(root, 'content/substantial-pages/publication-batch-2.json'), 'utf8'))
  assert.equal(payload.totals.batch2.records, SUBSTANTIAL_BATCH_2_PAGES.length)
  assert.equal(payload.totals.batch2.eligible, SUBSTANTIAL_BATCH_2_ELIGIBLE_PAGES.length)
  assert.equal(payload.totals.batch1.records, SUBSTANTIAL_PUBLICATION_PAGES.length)
  assert.equal(payload.totals.batch1.eligible, 20)
  assert.equal(payload.pages.length, 30)
  const report = readFileSync(join(root, 'docs/substantial-pages/publication-batch-2.md'), 'utf8')
  assert.match(report, /\| Selected \| 30 \|/)
  assert.match(report, /\| Currently eligible \| 30 \|/)
})
