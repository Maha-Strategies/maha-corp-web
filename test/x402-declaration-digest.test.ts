import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  createDeclarationDigestExtension,
  declarationDigest,
  digestableDeclaration,
  readDeclarationDigestExtension,
  type DiscoveryDeclaration,
} from '../lib/x402/declaration-digest.ts'

type Vector = {
  id: string
  declaration: DiscoveryDeclaration
  expected: { declarationDigest: string; metadataVersion?: string; canonicalResource?: string }
}

const vectorPath = new URL('../public/conformance/x402-v2/declaration-integrity-vectors.json', import.meta.url)

test('published declaration-integrity vectors are deterministic', async () => {
  const vectors = JSON.parse(await readFile(vectorPath, 'utf8')).vectors as Vector[]
  for (const vector of vectors) {
    assert.equal(await declarationDigest(vector.declaration), vector.expected.declarationDigest, vector.id)
  }
})

test('the digest excludes itself but retains every other advertised extension', async () => {
  const vectors = JSON.parse(await readFile(vectorPath, 'utf8')).vectors as Vector[]
  const base = vectors[0]!.declaration
  const digest = await declarationDigest(base)
  const withIntegrity: DiscoveryDeclaration = {
    ...base,
    extensions: {
      ...base.extensions,
      'declaration-integrity': {
        declarationDigest: digest,
        metadataVersion: '2026-08-09',
        canonicalResource: 'https://example.com/api/resource',
      },
    },
  }
  assert.equal(await declarationDigest(withIntegrity), digest)
  const withChangedBazaar = {
    ...withIntegrity,
    extensions: { ...withIntegrity.extensions, bazaar: { changed: true } },
  }
  assert.notEqual(await declarationDigest(withChangedBazaar), digest)
  assert.equal('declaration-integrity' in (digestableDeclaration(withIntegrity).extensions ?? {}), false)
})

test('the helper creates and validates the proposed three-field extension', async () => {
  const vectors = JSON.parse(await readFile(vectorPath, 'utf8')).vectors as Vector[]
  const extension = await createDeclarationDigestExtension(vectors[0]!.declaration, '2026-08-09.2')
  assert.equal(extension.canonicalResource, 'https://example.com/api/resource')
  assert.deepEqual(readDeclarationDigestExtension(extension), extension)
  assert.equal(readDeclarationDigestExtension({ ...extension, declarationDigest: 'sha256:nope' }), null)
})

test('canonicalResource is HTTPS-only and metadata versions can distinguish same-day deployments', async () => {
  const vectors = JSON.parse(await readFile(vectorPath, 'utf8')).vectors as Vector[]
  await assert.rejects(
    createDeclarationDigestExtension({ ...vectors[0]!.declaration, resource: { url: 'http://example.com/api/resource' } }, '2026-08-09'),
    /HTTPS/,
  )
  await assert.rejects(createDeclarationDigestExtension(vectors[0]!.declaration, 'latest'), /YYYY-MM-DD/)
})
