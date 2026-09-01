import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const ROOT = join(import.meta.dirname, '..')
const page = readFileSync(join(ROOT, 'app/demo/page.tsx'), 'utf8')
const embed = readFileSync(join(ROOT, 'components/YouTubeLiteEmbed.tsx'), 'utf8')
const homepage = readFileSync(join(ROOT, 'app/page.tsx'), 'utf8')
const llms = readFileSync(join(ROOT, 'lib/llms-manifest.ts'), 'utf8')

test('demo page publishes the correct video and privacy-enhanced player', () => {
  assert.match(page, /zDNs0Ndwx3Y/)
  assert.match(page, /PT5M58S/)
  assert.match(page, /VideoObject/)
  assert.match(page, /uploadDate: '2026-08-31T07:25:46-07:00'/)
  assert.match(embed, /youtube-nocookie\.com\/embed/)
  assert.match(embed, /onClick=\{\(\) => setPlaying\(true\)\}/)
})

test('demo page links only to existing evidence artifacts', () => {
  for (const artifact of [
    'public/artifacts/integrations/fulcra-flow-state-pr-33.json',
    'public/artifacts/carp/thrivbe-tea-enquiry-success-2026-08-28.json',
  ]) {
    assert.ok(existsSync(join(ROOT, artifact)), `${artifact} must exist`)
    assert.match(page, new RegExp(artifact.replace('public', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('demo is discoverable from the homepage and machine index', () => {
  assert.match(homepage, /href="\/demo"/)
  assert.match(llms, /https:\/\/www\.mahastrategies\.com\/demo/)
})

test('commercial claims preserve the published assessment boundaries', () => {
  assert.match(page, /\$12,500/)
  assert.match(page, /FOUNDING_PARTNER\.price/)
  assert.match(page, /reference-participation conditions/)
  assert.match(page, /implementation beyond the assessment is separate/i)
})
