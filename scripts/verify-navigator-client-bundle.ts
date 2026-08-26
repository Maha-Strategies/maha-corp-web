import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const buildRoot = resolve(process.cwd(), '.next')
const manifestPath = resolve(buildRoot, 'server/app/admin/navigator/research/page_client-reference-manifest.js')

assert.ok(existsSync(manifestPath), `Navigator client-reference manifest is missing: ${manifestPath}`)

const manifest = readFileSync(manifestPath, 'utf8')
const chunkPaths = [...new Set(manifest.match(/static\/chunks\/[A-Za-z0-9_.-]+\.js/g) ?? [])]

assert.ok(chunkPaths.length > 0, 'Navigator client-reference manifest did not declare any JavaScript chunks.')

const contaminated = chunkPaths.filter((chunkPath) => {
  const absolutePath = resolve(buildRoot, chunkPath)
  assert.ok(existsSync(absolutePath), `Navigator client chunk is missing: ${absolutePath}`)
  return readFileSync(absolutePath, 'utf8').includes('crypto-browserify')
})

assert.deepEqual(
  contaminated,
  [],
  `Navigator client bundle must not include the Node crypto polyfill: ${contaminated.join(', ')}`,
)

console.log(`Navigator client bundle verified: ${chunkPaths.length} chunks, no crypto-browserify.`)
