import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(entry => entry.isDirectory() ? sourceFiles(resolve(directory, entry.name))
    : /\.(?:[cm]?js|tsx?|json)$/.test(entry.name) ? [resolve(directory, entry.name)] : []))
  return files.flat()
}
test('x402 routes and their application libraries do not integrate ZizkaDB', async () => {
  const sources = [...await sourceFiles('app/api'), ...await sourceFiles('lib')]
  assert.ok(sources.length > 100)
  for (const file of sources) assert.doesNotMatch(await readFile(file, 'utf8'), /zizka(?:db)?/i, 'Keep Mir integration outside x402: ' + file)
})
test('no ZizkaDB package is installed as an endpoint dependency', async () => {
  for (const file of ['package.json', 'package-lock.json']) assert.doesNotMatch(await readFile(file, 'utf8'), /zizka(?:db)?/i)
})
