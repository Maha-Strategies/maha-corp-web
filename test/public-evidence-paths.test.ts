import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { PUBLIC_EVIDENCE, nonWebPaths } from '../lib/evidence/public-evidence-index.ts'
import { PUBLIC_EVIDENCE_COPIES } from '../scripts/sync-public-evidence.ts'

const ROOT = join(import.meta.dirname, '..')
const digest = (path: string) => createHash('sha256').update(readFileSync(join(ROOT, path))).digest('hex')

test('every published copy is byte-identical to its canonical document', () => {
  for (const entry of PUBLIC_EVIDENCE_COPIES) {
    assert.ok(existsSync(join(ROOT, entry.canonical)), `canonical missing: ${entry.canonical}`)
    assert.ok(existsSync(join(ROOT, entry.published)), `published copy missing: ${entry.published}`)
    assert.equal(
      digest(entry.published), digest(entry.canonical),
      `${entry.published} has drifted from ${entry.canonical}; run npm run sync:public-evidence`,
    )
  }
})

test('the canonical documents stay under content/, where their validators live', () => {
  for (const entry of PUBLIC_EVIDENCE_COPIES) {
    assert.match(entry.canonical, /^content\//)
    assert.match(entry.published, /^public\//)
  }
})

/**
 * A `content/...` href is a 404 for a buyer and a broken promise for whoever
 * sent the link. Web paths only, everywhere.
 */
test('every index href is a served web path, never a repository or local path', () => {
  assert.deepEqual(nonWebPaths(), [])
  for (const item of PUBLIC_EVIDENCE) {
    assert.match(item.href, /^\//, `${item.id} href is not absolute`)
    for (const forbidden of ['content/', 'docs/', 'lib/', 'scripts/', '/Users/', '/private/tmp', 'file://', '.codex']) {
      assert.ok(!item.href.includes(forbidden), `${item.id} href contains ${forbidden}`)
    }
  }
})

test('each published web path resolves to a file that exists under public/', () => {
  for (const item of PUBLIC_EVIDENCE) {
    const candidate = join(ROOT, 'public', item.href.replace(/^\//, ''))
    assert.ok(existsSync(candidate), `${item.href} has no file at public${item.href}`)
  }
})

test('the sync guard and the index agree on every published path', () => {
  const indexed = new Set(PUBLIC_EVIDENCE.map((item) => item.href))
  for (const entry of PUBLIC_EVIDENCE_COPIES) {
    assert.ok(indexed.has(entry.webPath), `${entry.webPath} is synced but not indexed`)
  }
})

test('the index describes documents without characterising a result', () => {
  const text = PUBLIC_EVIDENCE.map((item) => `${item.title} ${item.description}`).join(' ').toLowerCase()
  // Affirmative characterisations only. "Not a customer result" is a denial and
  // must pass; a keyword ban would flag it and the fix would be to delete the
  // disclaimer, which is backwards.
  for (const banned of [
    'outperform', 'superior', 'best-in-class', 'state of the art', 'leads on',
    'guarantees', 'is certified', 'is compliant', 'endorsed by', 'wso2 partner',
    'proven savings',
  ]) {
    assert.ok(!text.includes(banned), `the evidence index claims "${banned}"`)
  }
  // And the denial that must survive.
  assert.ok(text.includes('not a customer result'))
})

test('the sample assessment is labelled as synthetic, not a customer result', () => {
  const sample = PUBLIC_EVIDENCE.find((item) => item.id === 'context-control-evidence-assessment-sample')
  assert.ok(sample)
  assert.match(sample.description, /synthetic/i)
  assert.match(sample.description, /not a customer result/i)
})

test('the dense baseline is published beside the v1 results it is compared with', () => {
  const ids = PUBLIC_EVIDENCE.map((item) => item.id)
  assert.ok(ids.includes('mcrb1-dense-baseline'))
  assert.ok(ids.includes('mcrb1-v1'), 'publishing the dense result without v1 beside it would strip its comparison')
})

test('the WSO2 offer page links the evidence package by web path', () => {
  const page = readFileSync(join(ROOT, 'app/integrations/wso2/page.tsx'), 'utf8')
  // The page renders hrefs from the index rather than repeating them, so a
  // document added to the package appears on the page without a second edit.
  // Asserting literals here would force exactly the duplication being avoided.
  assert.match(page, /import \{ PUBLIC_EVIDENCE \} from '@\/lib\/evidence\/public-evidence-index'/)
  assert.match(page, /PUBLIC_EVIDENCE\.filter\(/)
  assert.match(page, /href=\{item\.href\}/)
  // No repository path may be presented to a visitor as a link target.
  for (const match of page.matchAll(/href="([^"]+)"/g)) {
    const href = match[1]
    assert.ok(!href.startsWith('content/') && !href.startsWith('/content/'), `offer page links repository path ${href}`)
    assert.ok(!href.includes('/Users/') && !href.includes('/private/tmp'), `offer page links a local path ${href}`)
  }
})

test('published copies are not tracked as generated build output', () => {
  const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf8')
  for (const entry of PUBLIC_EVIDENCE_COPIES) {
    assert.ok(!gitignore.includes(entry.published), `${entry.published} is gitignored and would not deploy`)
  }
})
