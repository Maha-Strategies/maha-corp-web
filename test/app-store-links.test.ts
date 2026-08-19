import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { APP_STORE_LINKS } from '../lib/app-store-links.ts'

const root = new URL('../', import.meta.url)

test('the shared registry contains every live app destination', () => {
  assert.deepEqual(APP_STORE_LINKS.mayon, {
    web: 'https://mayonrajan.com',
    ios: 'https://apps.apple.com/pt/app/mayon/id6794775508',
    android: 'https://play.google.com/store/apps/details?id=com.mayon.app',
  })
  assert.equal(APP_STORE_LINKS.dreamEngine.ios, 'https://apps.apple.com/us/app/the-engine-imagined-life/id6793837872')
  for (const product of Object.values(APP_STORE_LINKS)) for (const url of Object.values(product)) assert.match(url, /^https:\/\//)
})

test('the apps hub and product pages consume shared links without stale release copy', async () => {
  const [hub, mayon, engine, mahaOs, software, cases] = await Promise.all([
    'app/apps/page.tsx', 'app/apps/mayon/page.tsx', 'app/apps/the-engine/page.tsx', 'app/apps/maha-os/page.tsx', 'app/software/page.tsx', 'app/case-studies/page.tsx',
  ].map((path) => readFile(new URL(path, root), 'utf8')))
  for (const page of [hub, mayon, engine, mahaOs, software]) assert.match(page, /APP_STORE_LINKS/)
  assert.doesNotMatch(`${hub}\n${engine}\n${cases}`, /release is in preparation|mobile releases in preparation/i)
  assert.match(hub, /Available now on iOS and Android/)
  assert.match(engine, /App Store and Google Play/)
  assert.match(cases, /available on iOS and Android/)
})
