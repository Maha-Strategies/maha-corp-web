import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { writeGeneratedFile } from '../scripts/lib/write-generated-file.ts'

test('concurrent readers never observe a truncated generated artifact', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'maha-atomic-artifact-')), target = join(dir, 'record.json')
  const payload = 'x'.repeat(131072), versions = new Set([0])
  try {
    writeGeneratedFile(target, JSON.stringify({ version: 0, payload }))
    const program = `import {writeGeneratedFile} from ${JSON.stringify(new URL('../scripts/lib/write-generated-file.ts', import.meta.url).href)}; for(let version=1;version<=100;version++) writeGeneratedFile(process.argv[1], JSON.stringify({version,payload:'x'.repeat(131072)}))`
    let finished = false
    const writer = promisify(execFile)(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', program, target])
      .finally(() => { finished = true })
    while (!finished) {
      const value = JSON.parse(readFileSync(target, 'utf8'))
      assert.equal(value.payload, payload)
      assert.ok(Number.isInteger(value.version) && value.version >= 0 && value.version <= 100)
      versions.add(value.version)
      await new Promise(resolve => setTimeout(resolve, 1))
    }
    await writer
    assert.equal(JSON.parse(readFileSync(target, 'utf8')).version, 100)
    assert.deepEqual(readdirSync(dir), ['record.json'])
    assert.ok(versions.size >= 1)
  } finally { rmSync(dir, { recursive: true }) }
})
