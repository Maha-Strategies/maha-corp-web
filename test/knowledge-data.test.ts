import assert from 'node:assert/strict'
import test from 'node:test'

import {
  KNOWLEDGE_ARTICLES,
  KNOWLEDGE_SOURCES,
  SEMICONDUCTOR_STAGES,
  knowledgeArticlePath,
} from '../lib/knowledge-data.ts'

test('knowledge library publishes 25 foundational lifecycle explainers', () => {
  assert.equal(KNOWLEDGE_ARTICLES.length, 25)

  for (const stage of SEMICONDUCTOR_STAGES) {
    assert.ok(
      KNOWLEDGE_ARTICLES.some((article) => article.stageIds.includes(stage)),
      `${stage} needs at least one explainer`,
    )
  }
})

test('every explainer has useful process detail and claim-level evidence', () => {
  const sourceIds = new Set(KNOWLEDGE_SOURCES.map((source) => source.id))

  for (const article of KNOWLEDGE_ARTICLES) {
    assert.ok(article.definition.length >= 80, `${article.id} needs a substantive definition`)
    assert.ok(article.processSteps.length >= 5, `${article.id} needs a process sequence`)
    assert.ok(article.criticalParameters.length >= 5, `${article.id} needs critical parameters`)
    assert.ok(article.failureModes.length >= 5, `${article.id} needs failure modes`)
    assert.ok(article.sections.length >= 2, `${article.id} needs explanatory sections`)
    assert.ok(article.claims.length >= 2, `${article.id} needs evidenced claims`)

    for (const claim of article.claims) {
      assert.ok(claim.sourceIds.length > 0, `${claim.id} needs a source`)
      for (const sourceId of claim.sourceIds) {
        assert.ok(sourceIds.has(sourceId), `${claim.id} references missing source ${sourceId}`)
      }
    }
  }
})

test('knowledge routes and identifiers are unique', () => {
  const ids = KNOWLEDGE_ARTICLES.map((article) => article.id)
  const paths = KNOWLEDGE_ARTICLES.map(knowledgeArticlePath)

  assert.equal(new Set(ids).size, ids.length)
  assert.equal(new Set(paths).size, paths.length)
})
