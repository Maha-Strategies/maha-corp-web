import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import assert from 'node:assert/strict'
import { localWorkflow } from '../context-growth/workflow.ts'
import { hash, quote, requestBody } from './purchase.ts'
const mode = process.argv[2] ?? 'local'
if (mode === 'local') console.log(JSON.stringify({ normal: localWorkflow().summary, negative: localWorkflow(64).summary }, null, 2))
else if (mode === 'request') console.log(JSON.stringify(requestBody(), null, 2))
else if (mode === 'quote') console.log(JSON.stringify(await quote(), null, 2))
else if (mode === 'verify') {
  const manifest = JSON.parse(await readFile('MANIFEST.json', 'utf8'))
  for (const [file, digest] of Object.entries(manifest.files)) {
    assert.ok(resolve(file).startsWith(resolve('.') + sep), 'Unsafe manifest path')
    assert.equal(hash(await readFile(file, 'utf8')), digest, file)
  }
  console.log(JSON.stringify({ integrity: 'pass', files: Object.keys(manifest.files).length, authenticity: 'requires_external_archive_pin' }))
} else throw new Error('Use local, request, quote or verify. No paid CLI is supplied.')
