import assert from 'node:assert/strict'
import test from 'node:test'

import { KNOWLEDGE_ARTICLES, KNOWLEDGE_SOURCES } from '../lib/knowledge-data.ts'
import {
  SEMICONDUCTOR_CROSS_CUTTING_CONTROLS,
  SEMICONDUCTOR_PROCESS_PHASES,
  getProcessMapStepCount,
} from '../lib/semiconductor-process-map.ts'

test('semiconductor process map covers the complete lifecycle in order', () => {
  assert.deepEqual(SEMICONDUCTOR_PROCESS_PHASES.map((phase) => phase.order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.equal(SEMICONDUCTOR_PROCESS_PHASES[0]?.id, 'product-definition')
  assert.equal(SEMICONDUCTOR_PROCESS_PHASES.at(-1)?.id, 'final-test-reliability')
  assert.ok(getProcessMapStepCount() >= 80)
  assert.ok(SEMICONDUCTOR_CROSS_CUTTING_CONTROLS.length >= 8)
})

test('every process-map source and technical-article link resolves', () => {
  const sourceIds = new Set(KNOWLEDGE_SOURCES.map((source) => source.id))
  const articleIds = new Set(KNOWLEDGE_ARTICLES.map((article) => article.id))

  for (const phase of SEMICONDUCTOR_PROCESS_PHASES) {
    for (const sourceId of phase.sourceIds) assert.ok(sourceIds.has(sourceId), `${phase.id} references missing source ${sourceId}`)
    for (const step of phase.steps) {
      if (step.articleId) assert.ok(articleIds.has(step.articleId), `${step.id} references missing article ${step.articleId}`)
    }
  }
})

test('the map records explicit release gates and feedback loops', () => {
  for (const phase of SEMICONDUCTOR_PROCESS_PHASES) {
    assert.ok(phase.releaseGate.length > 30, `${phase.id} needs a meaningful release gate`)
  }
  assert.ok(SEMICONDUCTOR_PROCESS_PHASES.some((phase) => phase.feedbackTo?.includes('product-definition')))
  assert.ok(SEMICONDUCTOR_PROCESS_PHASES.some((phase) => phase.steps.some((step) => step.repeat)))
})
