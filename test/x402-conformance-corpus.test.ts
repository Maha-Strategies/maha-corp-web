import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  runConformanceCorpus,
  validateConformanceCorpus,
  type ConformanceCorpus,
} from '../lib/x402/conformance.ts'
import { parseConformanceArgs } from '../scripts/run-x402-conformance-corpus.ts'

const corpusPath = new URL('../public/conformance/x402-v2/corpus.json', import.meta.url)
const schemaPath = new URL('../public/conformance/x402-v2/corpus.schema.json', import.meta.url)

async function loadCorpus(): Promise<ConformanceCorpus> {
  const corpus = JSON.parse(await readFile(corpusPath, 'utf8')) as unknown
  validateConformanceCorpus(corpus)
  return corpus
}

test('the public corpus has unique, fully attributed fixtures', async () => {
  const corpus = await loadCorpus()
  const ids = corpus.fixtures.map((fixture) => fixture.id)

  assert.equal(corpus.protocolVersion, 2)
  assert.equal(corpus.license, 'Apache-2.0')
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(corpus.fixtures.every((fixture) => fixture.specReferences.every((reference) => reference.startsWith('https://'))), true)
})

test('the reference runner agrees with every expected result', async () => {
  const results = await runConformanceCorpus(await loadCorpus())
  assert.deepEqual(results.filter((result) => !result.passed), [])
})

test('the valid EIP-3009 vector is cryptographically recoverable without a private key', async () => {
  const corpus = await loadCorpus()
  const result = (await runConformanceCorpus({
    ...corpus,
    fixtures: corpus.fixtures.filter((fixture) => fixture.id === 'payment.valid.eip3009'),
  }))[0]

  assert.equal(result.passed, true)
  assert.equal(result.actual.code, 'valid_eip3009_payment')
})

test('the challenge wire value decodes to the structured fixture', async () => {
  const corpus = await loadCorpus()
  const fixture = corpus.fixtures.find((candidate) => candidate.id === 'http.challenge.valid-v2')!
  const decoded = JSON.parse(Buffer.from(String(fixture.input.headerValue), 'base64').toString('utf8'))
  assert.deepEqual(decoded, fixture.input.message)
})

test('the corpus schema is self-identifying and permits the published envelope', async () => {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
  assert.equal(schema.$id, 'https://www.mahastrategies.com/conformance/x402-v2/corpus.schema.json')
  assert.equal(schema.properties.$schema.type, 'string')
  assert.equal(schema.properties.protocolVersion.const, 2)
})

test('the CLI supports selection, machine output, and alternate corpora', () => {
  const options = parseConformanceArgs(['--fixture', 'receipt.missing', '--json', '--corpus', './fixture.json'])
  assert.equal(options.fixture, 'receipt.missing')
  assert.equal(options.json, true)
  assert.equal(options.corpusPath.endsWith('/fixture.json'), true)
})
