import assert from 'node:assert/strict'
import test from 'node:test'

import corpusJson from '../content/integrations/wso2-context-compiler-corpus.json' with { type: 'json' }
import { calculateWso2LabelFreezeDigest, parseWso2EvaluationCorpus, validateWso2CompilerCorpus } from '../lib/integrations/wso2-evaluation-corpus.ts'

test('WSO2 evaluation corpus contains twenty sanitized, balanced, uniquely labelled workloads', () => {
  const corpus = parseWso2EvaluationCorpus(corpusJson)
  assert.equal(corpus.workloads.length, 20)
  assert.equal(corpus.sanitization.synthetic, true)
  assert.equal(corpus.sanitization.containsCustomerData, false)
  assert.equal(corpus.sanitization.containsPersonalData, false)
  assert.equal(corpus.sanitization.containsSecrets, false)
  for (const difficulty of ['easy', 'medium', 'hard']) assert.ok(corpus.workloads.filter((workload) => workload.difficulty === difficulty).length >= 5)
  assert.ok(new Set(corpus.workloads.map((workload) => workload.documentStructure)).size >= 8)
  assert.equal(corpus.labelFreeze.status, 'frozen')
  assert.equal(corpus.labelFreeze.digest, calculateWso2LabelFreezeDigest(corpus))
})

test('every labelled fact and required source survives deterministic Maha compilation', () => {
  const { results, failures } = validateWso2CompilerCorpus(corpusJson)
  assert.deepEqual(failures, [])
  for (const result of results) {
    assert.equal(result.requiredFactsRetained, result.requiredFactsTotal, result.workloadId)
    assert.equal(result.requiredSourcesRetained, result.requiredSourcesTotal, result.workloadId)
  }
})

test('corpus validator rejects incomplete or falsely sanitized corpora', () => {
  assert.throws(() => parseWso2EvaluationCorpus({ ...corpusJson, workloads: corpusJson.workloads.slice(0, 19) }), /exactly 20/)
  assert.throws(() => parseWso2EvaluationCorpus({ ...corpusJson, sanitization: { ...corpusJson.sanitization, containsCustomerData: true } }), /containsCustomerData must be false/)
})

test('corpus validator rejects any post-freeze change to a fact, citation, or source document', () => {
  const changedFact = structuredClone(corpusJson)
  changedFact.workloads[0].labels.requiredFacts[0].statement += ' Changed after review.'
  assert.throws(() => parseWso2EvaluationCorpus(changedFact), /does not match the frozen requests/)

  const changedCitation = structuredClone(corpusJson)
  changedCitation.workloads[0].labels.requiredFacts[0].sourceIds = ['rollback-runbook']
  assert.throws(() => parseWso2EvaluationCorpus(changedCitation), /no exact evidence span|does not match the frozen requests/)

  const changedSource = structuredClone(corpusJson)
  changedSource.workloads[0].request.documents[0].text += ' Post-freeze text.'
  assert.throws(() => parseWso2EvaluationCorpus(changedSource), /does not match the frozen requests/)
})
