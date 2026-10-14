import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('lockfile root dependencies match the unchanged project manifest', () => {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
  assert.equal(lock.lockfileVersion, 3)
  assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies)
  assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies)
})
test('npm 10 nested peer resolution has all six previously missing lock entries', () => {
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
  const missing = [
    ['@reown/appkit-controllers', 'zod', '3.25.76'], ['@reown/appkit-utils', 'zod', '3.25.76'], ['@reown/appkit', 'zod', '3.25.76'],
    ['@walletconnect/utils', 'zod', '3.25.76'], ['@walletconnect/jsonrpc-ws-connection', 'utf-8-validate', '5.0.10'], ['jayson', 'utf-8-validate', '5.0.10'],
  ]
  for (const [parent, dependency, version] of missing) {
    const key = `node_modules/${parent}/node_modules/${dependency}`, entry = lock.packages[key]
    assert.ok(entry, key); assert.equal(entry.version, version)
    assert.match(entry.resolved, /^https:\/\/registry\.npmjs\.org\//)
    assert.match(entry.integrity, /^sha512-/)
  }
  // Preserve npm 11's cross-platform metadata while repairing npm 10's graph.
  assert.deepEqual(lock.packages['node_modules/@next/swc-linux-x64-gnu'].libc, ['glibc'])
  assert.deepEqual(lock.packages['node_modules/@next/swc-linux-x64-musl'].libc, ['musl'])
})
