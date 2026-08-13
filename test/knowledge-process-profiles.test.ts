import assert from 'node:assert/strict'
import test from 'node:test'

import { KNOWLEDGE_ARTICLES, KNOWLEDGE_SOURCES } from '../lib/knowledge-data.ts'
import {
  KNOWLEDGE_SUPPLIERS,
  PROCESS_EXPANSIONS,
  getKnowledgeSupplier,
  getProcessExpansion,
  knowledgeSupplierPath,
} from '../lib/knowledge-process-profiles.ts'

test('every published process has a complete control and supplier expansion', () => {
  const processes = KNOWLEDGE_ARTICLES.filter((article) => article.kind === 'process')
  assert.equal(processes.length, 18)
  assert.equal(PROCESS_EXPANSIONS.length, processes.length)

  for (const process of processes) {
    const profile = getProcessExpansion(process.id)
    assert.ok(profile, `${process.id} needs a process expansion`)
    assert.ok(profile.materialFocus.length > 0)
    assert.ok(profile.equipmentFocus.length > 0)
    assert.ok(profile.defectFocus.length > 0)
    assert.ok(profile.metrologyFocus.length > 0)
    assert.ok(profile.supplierIds.length >= 2)
    for (const supplierId of profile.supplierIds) assert.ok(getKnowledgeSupplier(supplierId))
  }
})

test('supplier profiles are evidence-bounded, sourced, and bidirectionally linked', () => {
  const processIds = new Set(KNOWLEDGE_ARTICLES.filter((article) => article.kind === 'process').map((article) => article.id))
  const sourceIds = new Set(KNOWLEDGE_SOURCES.map((source) => source.id))

  for (const supplier of KNOWLEDGE_SUPPLIERS) {
    assert.ok(supplier.capabilityEvidence.length >= 80, `${supplier.id} needs capability evidence`)
    assert.ok(supplier.boundary.length >= 80, `${supplier.id} needs an evidence boundary`)
    assert.ok(supplier.sourceIds.length > 0, `${supplier.id} needs a source`)
    for (const sourceId of supplier.sourceIds) assert.ok(sourceIds.has(sourceId), `${supplier.id} references missing source ${sourceId}`)
    for (const processId of supplier.processIds) {
      assert.ok(processIds.has(processId), `${supplier.id} references missing process ${processId}`)
      assert.ok(getProcessExpansion(processId)?.supplierIds.includes(supplier.id), `${supplier.id} lacks backlink from ${processId}`)
    }
  }
})

test('supplier routes are unique and stable', () => {
  const routes = KNOWLEDGE_SUPPLIERS.map(knowledgeSupplierPath)
  assert.equal(new Set(routes).size, routes.length)
  for (const route of routes) assert.match(route, /^\/knowledge\/suppliers\/[a-z0-9-]+$/)
})
