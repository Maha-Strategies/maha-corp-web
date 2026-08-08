import assert from 'node:assert/strict'
import test from 'node:test'

import { validateDiscoveryExtension, validateDiscoveryExtensionSpec } from '@x402/extensions/bazaar'

import { CONTEXT_COMPILER_DESCRIPTION, discoveryExtensionsFor, resourceInfoFor } from '../lib/x402/discovery.ts'

const compression = {
  pathPrefix: '/api/v1/compress',
  amount: '1000',
  description: 'Evidence-aware context compression for LLM and agent workflows',
  concurrencyCap: 8,
}

test('the Context Compiler publishes valid, callable Bazaar metadata', () => {
  const extensions = discoveryExtensionsFor(compression)
  assert.ok(extensions?.bazaar)
  assert.deepEqual(validateDiscoveryExtensionSpec(extensions!.bazaar as never), { valid: true })
  assert.deepEqual(validateDiscoveryExtension(extensions!.bazaar as never), { valid: true })

  const bazaar = extensions!.bazaar as { info: { input: { method: string; body: { tokenBudget: number; documents: unknown[] } }; output: { example: { includedPassages: unknown[]; sources: unknown[]; warningCodes: string[] } } } }
  assert.equal(bazaar.info.input.method, 'POST')
  assert.equal(bazaar.info.input.body.tokenBudget, 128)
  assert.equal(bazaar.info.input.body.documents.length, 2)
  assert.equal(bazaar.info.output.example.includedPassages.length, 2)
  assert.equal(bazaar.info.output.example.sources.length, 2)
  assert.ok(bazaar.info.output.example.warningCodes.includes('extractive_selection_not_verification'))
})

test('the catalog metadata identifies the service for semantic search', () => {
  const resource = resourceInfoFor(compression, 'https://www.mahastrategies.com/api/v1/compress')
  assert.equal(resource.serviceName, 'Maha Context Compiler')
  assert.equal(resource.description, CONTEXT_COMPILER_DESCRIPTION)
  assert.ok(resource.tags?.includes('context-compression'))
  assert.equal(resource.iconUrl, 'https://www.mahastrategies.com/icon.png')
})

test('an unknown priced route is not advertised with an invented schema', () => {
  assert.equal(discoveryExtensionsFor({ ...compression, pathPrefix: '/api/v1/unknown' }), undefined)
})
