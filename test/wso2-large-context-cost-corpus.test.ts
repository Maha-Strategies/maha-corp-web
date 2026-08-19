import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { estimateTokens } from '../lib/context-compiler.ts'
import { calculateWso2LabelFreezeDigest, parseWso2EvaluationCorpus, validateWso2CompilerCorpus } from '../lib/integrations/wso2-evaluation-corpus.ts'

const source = JSON.parse(
  readFileSync(new URL('../content/integrations/wso2-large-context-cost-corpus.json', import.meta.url), 'utf8'),
)

test('large-context cost corpus is frozen, sanitized, and spans 20K-100K estimated tokens', () => {
  const corpus = parseWso2EvaluationCorpus(source)
  const sizes = corpus.workloads.map((workload) => estimateTokens(workload.request.documents.map((document) => document.text).join('\n\n')))

  assert.equal(corpus.workloads.length, 20)
  assert.equal(corpus.labelFreeze.digest, calculateWso2LabelFreezeDigest(corpus))
  assert.equal(corpus.sanitization.synthetic, true)
  assert.equal(corpus.sanitization.containsCustomerData, false)
  assert.ok(Math.min(...sizes) >= 20_000)
  assert.ok(Math.max(...sizes) <= 100_000)
  assert.ok(new Set(corpus.workloads.map((workload) => workload.documentStructure)).size >= 8)
})

test('Maha retains every frozen large-context fact before any provider call', () => {
  const validation = validateWso2CompilerCorpus(source)
  assert.deepEqual(validation.failures, [])
  assert.ok(validation.results.every((result) => result.compiledEstimatedTokens <= 1_024))
  assert.ok(validation.results.every((result) => result.compiledEstimatedTokens < result.originalEstimatedTokens))
})
