import assert from 'node:assert/strict'
import test from 'node:test'

import {
  KNOWLEDGE_ARTICLES,
  KNOWLEDGE_SOURCES,
  SEMICONDUCTOR_STAGES,
  knowledgeArticlePath,
} from '../lib/knowledge-data.ts'

test('knowledge library publishes 25 foundational explainers and 25 equipment classes', () => {
  assert.equal(KNOWLEDGE_ARTICLES.length, 50)
  assert.equal(KNOWLEDGE_ARTICLES.filter((article) => article.kind === 'equipment').length, 25)

  for (const stage of SEMICONDUCTOR_STAGES) {
    assert.ok(
      KNOWLEDGE_ARTICLES.some((article) => article.stageIds.includes(stage)),
      `${stage} needs at least one explainer`,
    )
  }
})

test('equipment records cover the lifecycle and expose qualification boundaries', () => {
  const equipment = KNOWLEDGE_ARTICLES.filter((article) => article.kind === 'equipment')

  for (const stage of SEMICONDUCTOR_STAGES) {
    assert.ok(
      equipment.some((article) => article.stageIds.includes(stage)),
      `${stage} needs at least one equipment class`,
    )
  }

  for (const article of equipment) {
    assert.ok(article.inputs.length >= 4, `${article.id} needs declared inputs`)
    assert.ok(article.outputs.length >= 2, `${article.id} needs declared outputs`)
    assert.ok(article.metrology.length >= 5, `${article.id} needs control and qualification measurements`)
    assert.ok(article.equipment.length >= 5, `${article.id} needs named subassemblies`)
    assert.ok(article.claims.every((claim) => claim.boundary), `${article.id} needs claim boundaries`)
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
