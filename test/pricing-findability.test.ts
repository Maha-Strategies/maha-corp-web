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
  assert.match(page, /Pricing and Purchase Options/)
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

test('pricing distinguishes every supported acquisition boundary', () => {
  const page = read('app/pricing/page.tsx')

  for (const marker of [
    'MPS Preflight',
    'MPS Prepaid Audit API Access',
    'Receipt → CSV batch',
    'Book MCP access',
    'Builder',
    'Scale',
    'Machine-payable APIs',
    'Rapid Intelligence Brief',
    'Verified Research Brief',
    'Custom implementation',
  ]) assert.match(page, new RegExp(marker), `pricing is missing ${marker}`)

  assert.match(page, /Price shown at checkout/)
  assert.match(page, /purchasable: false/)
  assert.match(page, /Enquiry only · not purchasable/)
  assert.match(page, /live HTTP 402 challenge remains authoritative/i)
})

test('pricing links to each commercial surface without inventing checkout prices', () => {
  const page = read('app/pricing/page.tsx')

  for (const href of [
    '/mps/preflight',
    '/mps/audit-access',
    '/utilities/receipts',
    '/books/mcp-access',
    '/software',
    '/dashboard',
    '/rapid-intelligence-brief',
    '/consulting',
    '/agent-offers.json',
  ]) assert.ok(page.includes(href), `pricing must link to ${href}`)

  assert.doesNotMatch(page, /MPS Prepaid Audit API Access[\s\S]{0,200}\$\d/)
  assert.doesNotMatch(page, /Book MCP access[\s\S]{0,200}\$\d/)
  assert.doesNotMatch(page, /Receipt → CSV batch[\s\S]{0,200}\$\d/)
})
