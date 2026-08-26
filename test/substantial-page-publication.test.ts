import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { FRONTIER_CANARY_RECORDS } from '../lib/frontier-canonicalization.ts'
import { alignmentFor, isAlignmentClear } from '../lib/frontier-source-alignment.ts'
import { buildLlmsManifest } from '../lib/llms-manifest.ts'
import {
  SUBSTANTIAL_INFORMATION_DIMENSIONS,
  SUBSTANTIAL_PUBLICATION_PAGES,
  SUBSTANTIAL_PUBLICATION_RECORD_IDS,
  SUBSTANTIAL_PUBLIC_PATHS,
  evaluateSubstantialPublicationQuality,
} from '../lib/substantial-page-publication.ts'

const canaryById = new Map(FRONTIER_CANARY_RECORDS.map((record) => [record.id, record]))

test('Batch 1 freezes exactly twenty alignment-clear canonical canaries outside the uninspected cohort', () => {
  assert.equal(SUBSTANTIAL_PUBLICATION_RECORD_IDS.length, 20)
  assert.equal(new Set(SUBSTANTIAL_PUBLICATION_RECORD_IDS).size, 20)
  for (const recordId of SUBSTANTIAL_PUBLICATION_RECORD_IDS) {
    assert.ok(canaryById.has(recordId), `${recordId} is not a canonical canary`)
    assert.equal(isAlignmentClear(recordId), true, `${recordId} is not alignment-clear`)
    assert.equal(alignmentFor(recordId)?.evidence.sourceContentInspected, true, `${recordId} remains available to an uninspected batch`)
  }
})

test('the quality gate requires evidence coverage and eight information dimensions', () => {
  assert.equal(SUBSTANTIAL_PUBLICATION_PAGES.length, 20)
  for (const page of SUBSTANTIAL_PUBLICATION_PAGES) {
    assert.equal(page.quality.eligible, true, page.quality.reasons.join(', '))
    assert.equal(page.quality.evidenceCoverage.claimsExplained, page.quality.evidenceCoverage.claimsTotal)
    assert.equal(page.quality.evidenceCoverage.sourcesBound, page.quality.evidenceCoverage.sourcesTotal)
    assert.equal(page.quality.evidenceCoverage.unsupportedExplanationParagraphs, 0)
    assert.deepEqual(page.quality.dimensions, SUBSTANTIAL_INFORMATION_DIMENSIONS)
    assert.equal(page.quality.informationValue.dimensionsCovered, 8)
    assert.ok(page.quality.informationValue.relatedRecords >= 3)
  }
})

test('arbitrarily long unsupported prose cannot satisfy the publication gate', () => {
  const page = SUBSTANTIAL_PUBLICATION_PAGES[0]
  const record = canaryById.get(page.contract.recordId)!
  const tampered = structuredClone(page)
  tampered.contract.explanations[0] = {
    ...tampered.contract.explanations[0],
    paragraphs: ['Unsupported filler. '.repeat(1000)],
    claimIds: [],
    sourceIds: [],
  }
  const decision = evaluateSubstantialPublicationQuality(record, tampered)
  assert.equal(decision.eligible, false)
  assert.ok(decision.reasons.includes('unsupported-explanatory-prose'))
  assert.ok(decision.reasons.includes('explanation-1-claims-missing'))
})

test('comparison and calculation remain explicit non-applicability decisions when evidence is absent', () => {
  for (const page of SUBSTANTIAL_PUBLICATION_PAGES) {
    assert.equal(page.contract.comparison.status, 'not-applicable')
    assert.match(page.contract.comparison.rationale, /second supported side|comparison axis/i)
    assert.equal(page.contract.calculation.status, 'not-applicable')
    assert.match(page.contract.calculation.rationale, /numerical inputs|unsupported quantitative result/i)
    assert.deepEqual(page.contract.comparison.axes, [])
    assert.deepEqual(page.contract.calculation.inputs, [])
  }
})

test('related links resolve within the already canonical canary graph and disclose their selection basis', () => {
  for (const page of SUBSTANTIAL_PUBLICATION_PAGES) {
    for (const related of page.contract.relatedRecords) assert.ok(canaryById.has(related.recordId))
    assert.equal(page.selectionTrace.length, page.contract.relatedRecords.length)
    assert.ok(page.selectionTrace.every((trace) => ['bridge-edge', 'shared-source', 'domain-adjacency'].includes(trace.tier)))
  }
})

test('depth measurement reports information expansion but is not itself a gate', () => {
  for (const page of SUBSTANTIAL_PUBLICATION_PAGES) {
    assert.ok(page.depth.after.informationCharacters > page.depth.before.informationCharacters)
    assert.equal(page.depth.characterDelta, page.depth.after.informationCharacters - page.depth.before.informationCharacters)
    assert.match(page.publicationDigest, /^sha256:[a-f0-9]{64}$/)
  }
})

test('llms substantial references include only eligible records from the supplied canonical set', () => {
  const eligible = SUBSTANTIAL_PUBLICATION_PAGES.map((page) => canaryById.get(page.contract.recordId)!)
  const ineligible = FRONTIER_CANARY_RECORDS.find((record) => !SUBSTANTIAL_PUBLICATION_RECORD_IDS.includes(record.id as never))!
  const manifest = buildLlmsManifest([], [...eligible, ineligible])
  const substantialSection = manifest.split('## Substantial source-bound references\n')[1].split('\n## Automation and MCP')[0]
  for (const path of SUBSTANTIAL_PUBLIC_PATHS) assert.match(substantialSection, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(substantialSection, new RegExp(ineligible.slug))
})

test('the public record route renders the substantial contract, safe JSON-LD, metadata, and typed internal links', () => {
  const route = readFileSync(new URL('../app/knowledge/[kind]/[slug]/[recordSlug]/page.tsx', import.meta.url), 'utf8')
  for (const marker of ['getPublishedSubstantialPage', 'articleSection', 'replace(/</g', 'Comparison and calculation boundary', 'Related records and mathematical bridges', 'selectionTrace']) assert.match(route, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('sitemap freshness is quality-aware without creating duplicate routes', () => {
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  assert.match(sitemap, /getPublishedSubstantialPage\(release\.recordId\)\?\.quality\.eligible/)
  assert.equal(new Set(SUBSTANTIAL_PUBLIC_PATHS).size, 20)
})

test('publication artifacts regenerate byte-identically', () => {
  const root = new URL('..', import.meta.url).pathname
  const paths = ['content/substantial-pages/publication-batch-1.json', 'docs/substantial-pages/publication-batch-1.md']
  const before = paths.map((path) => readFileSync(join(root, path), 'utf8'))
  execFileSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts/generate-substantial-publication-batch.ts')], { cwd: root })
  paths.forEach((path, index) => assert.equal(readFileSync(join(root, path), 'utf8'), before[index]))
})
