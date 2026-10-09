import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('deployment excludes private buyer material but retains the public client required by type checks', () => {
  const ignored = readFileSync('.vercelignore', 'utf8').split(/\r?\n/).map(line => line.trim())
  assert.equal(ignored.includes('examples/buyer-brief'), false)
  assert.equal(ignored.includes('examples/buyer-brief/buy-pack.ts'), false)
  for (const path of ['content/paid-ebooks', 'content/buyer-brief', 'examples/buyer-brief/BUYER-BRIEF.md', 'examples/buyer-brief/RUNBOOK.md', '.env*', '.signing']) {
    assert.ok(ignored.includes(path), path)
  }
  assert.match(readFileSync('examples/buyer-brief/buy-pack.ts', 'utf8'), /export async function purchasePack/)
})

test('quality and paid canaries use the same pinned npm resolver as the verified clean local installation', () => {
  for (const name of ['quality', 'book-evidence-five-indexing-canaries', 'planning-ten-indexing-canaries']) {
    const workflow = readFileSync(`.github/workflows/${name}.yml`, 'utf8')
    assert.match(workflow, /node-version: 24/)
    assert.match(workflow, /npm install --global npm@11\.17\.0/)
    assert.ok(workflow.indexOf('npm@11.17.0') < workflow.indexOf('run: npm ci'))
  }
})
