import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { encode } from 'gpt-tokenizer'

import published from '../content/recipes/context-compiler-large-document-result.json' with { type: 'json' }
import { compileContextPack, parseContextPackRequest } from '../lib/context-compiler.ts'

const root = join(import.meta.dirname, '..')
const sources = [
  ['borrowed-light-ch1', 'The Borrowed Light — Chapter 1', 'content/books/the-borrowed-light/chapter-1.md'],
  ['unfinished-species-ch1', 'The Unfinished Species — Chapter 1', 'content/books/the-unfinished-species/chapter-1.md'],
  ['orbital-mind-ch1', 'The Orbital Mind — Chapter 1', 'content/books/the-orbital-mind/chapter-1.md'],
  ['imagined-life-ch1', 'The Imagined Life — Chapter 1', 'content/books/the-imagined-life/chapter-1.md'],
] as const

test('the published large-document recipe is reproduced by the committed sources and compiler', () => {
  const request = parseContextPackRequest({
    clientRequestId: 'recipe_reproducibility_test',
    task: 'Compare how these works describe cognition, adaptation, imagination, agency, and the construction of a self.',
    tokenBudget: 8_000,
    documents: sources.map(([id, title, path]) => ({ id, title, text: readFileSync(join(root, path), 'utf8') })),
    provenance: 'compact',
    scoring: 'bm25',
    budgetMode: 'guaranteed',
  })
  const pack = compileContextPack(request)
  const inputText = request.documents.map((document) => document.text).join('\n\n')
  const inputTokens = encode(inputText).length
  const outputTokens = encode(pack.context).length
  const savedTokens = inputTokens - outputTokens

  assert.equal(Buffer.byteLength(inputText, 'utf8'), published.workload.inputBytes)
  assert.equal(inputTokens, published.workload.inputTokensBpe)
  assert.equal(outputTokens, published.result.compiledTokensBpe)
  assert.equal(savedTokens, published.result.savedTokensBpe)
  assert.equal(Number(((savedTokens / inputTokens) * 100).toFixed(2)), published.result.reductionPercent)
  assert.equal(pack.metrics.sourceCoveragePercent, published.result.sourceCoveragePercent)
  assert.equal(pack.sources.filter((source) => source.includedPassageIds.length > 0).length, published.result.includedSourceCount)
  assert.equal(pack.inputHash, published.result.inputHash)
  assert.equal(pack.outputHash, published.result.outputHash)

  const gross = (savedTokens / 1_000_000) * published.economics.referenceInputPriceUsdPerMillion
  assert.equal(Number(gross.toFixed(6)), published.economics.grossInputCostAvoidedUsd)
  assert.equal(Number((gross - published.economics.x402FeeUsd).toFixed(6)), published.economics.netInputCostAvoidedUsd)
})
