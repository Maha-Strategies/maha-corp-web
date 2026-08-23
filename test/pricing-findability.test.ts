import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const ROOT = join(import.meta.dirname, '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

test('pricing is a canonical, indexable first-class route', () => {
  const page = read('app/pricing/page.tsx')
  const sitemap = read('app/sitemap.ts')

  assert.match(page, /alternates: \{ canonical: '\/pricing' \}/)
  assert.match(page, /Context Control Assessment Pricing/)
  assert.match(sitemap, /\$\{baseUrl\}\/pricing/)
})

test('pricing is a primary navigation item before Explore on desktop and mobile', () => {
  const navigation = read('components/Navbar.tsx')

  const pricing = navigation.indexOf("{ name: 'Pricing', href: '/pricing' }")
  const explore = navigation.indexOf('<details className="relative">')
  assert.ok(pricing >= 0, 'pricing must be a primary navigation item')
  assert.ok(explore >= 0, 'desktop Explore submenu is missing')
  assert.ok(pricing < explore, 'pricing must appear before the Explore submenu')
  assert.match(navigation, /\{primaryLinks\.map\(\(link\) => \(/)
})

test('the general assessment offer is not tied to a gateway vendor', () => {
  const page = read('app/pricing/page.tsx')
  assert.doesNotMatch(page, /WSO2/)
  assert.match(page, /context control or governed agent actions/i)
  assert.match(page, /Request a bounded assessment/)
})
