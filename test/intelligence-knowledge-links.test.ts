import assert from 'node:assert/strict'
import test from 'node:test'

import { getArchivedBriefBySlug } from '../lib/briefs-data.ts'
import {
  INTELLIGENCE_KNOWLEDGE_LINKS,
  getIntelligenceBriefSlugsForKnowledgeObject,
  getSupportingKnowledgeObjects,
} from '../lib/intelligence-knowledge-links.ts'

test('semiconductor Intelligence briefs have explicit supporting Knowledge objects', () => {
  assert.ok(INTELLIGENCE_KNOWLEDGE_LINKS.length >= 25)

  for (const link of INTELLIGENCE_KNOWLEDGE_LINKS) {
    assert.ok(getArchivedBriefBySlug(link.briefSlug), `${link.briefSlug} must resolve to an archived brief`)
    assert.ok(link.articleIds.length > 0, `${link.briefSlug} needs a technical foundation`)
    assert.ok(link.rationale.length >= 80, `${link.briefSlug} needs a relationship rationale`)
    assert.equal(
      getSupportingKnowledgeObjects(link.briefSlug).length,
      link.articleIds.length + link.supplierIds.length,
      `${link.briefSlug} must resolve every graph edge`,
    )
  }
})

test('Knowledge and supplier backlinks use the same graph edges', () => {
  for (const link of INTELLIGENCE_KNOWLEDGE_LINKS) {
    for (const objectId of [...link.articleIds, ...link.supplierIds]) {
      assert.ok(
        getIntelligenceBriefSlugsForKnowledgeObject(objectId).includes(link.briefSlug),
        `${objectId} must link back to ${link.briefSlug}`,
      )
    }
  }
})

test('representative briefs connect to specific processes and suppliers', () => {
  const packaging = getSupportingKnowledgeObjects('smartphone-ap-fan-out-substrate-thickness')
  assert.ok(packaging.some((item) => item.id === 'process-package-substrates-rdl'))
  assert.ok(packaging.some((item) => item.id === 'supplier-amkor'))

  const design = getSupportingKnowledgeObjects('angstrom-era-soc-architecture')
  assert.ok(design.some((item) => item.id === 'process-rtl-to-physical-design'))
  assert.ok(design.some((item) => item.id === 'supplier-asml'))

  const cleanroom = getSupportingKnowledgeObjects('us-semiconductor-cleanroom-construction')
  assert.ok(cleanroom.some((item) => item.id === 'concept-cleanrooms-fab-utilities'))
  assert.ok(cleanroom.some((item) => item.id === 'supplier-kla'))
})
