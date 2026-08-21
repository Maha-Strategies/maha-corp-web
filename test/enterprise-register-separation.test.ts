import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  ALL_GLOBAL_NAVIGATION,
  AUTHOR_BRAND_CANONICAL_SURFACE,
  ENTERPRISE_EXCEPTIONS,
  EXPLORE_NAVIGATION,
  FOOTER_COMPANY_NAVIGATION,
  FOOTER_DEVELOPER_NAVIGATION,
  PRIMARY_NAVIGATION,
  PRIMARY_NAVIGATION_CHARACTER_BUDGET,
  REGISTER_C_PREFIXES,
  isRegisterC,
} from '../lib/navigation/site-navigation.ts'

const ROOT = join(import.meta.dirname, '..')
const read = (relative: string) => readFileSync(join(ROOT, relative), 'utf8')

/** The destinations a buyer must not be handed by the global chrome. */
const PROHIBITED = [
  '/doctrine',
  '/protocols',
  '/operations/timing',
  '/reports/celestial',
  '/overclock',
  '/books',
  '/apps',
] as const

test('no prohibited destination appears in global navigation data', () => {
  for (const link of ALL_GLOBAL_NAVIGATION) {
    assert.ok(!isRegisterC(link.href), `${link.name} (${link.href}) is Register C and must not be in global navigation`)
    for (const prohibited of PROHIBITED) {
      assert.ok(
        link.href !== prohibited && !link.href.startsWith(`${prohibited}/`),
        `${link.name} links to prohibited destination ${link.href}`,
      )
    }
  }
})

test('desktop and mobile render the same vetted lists, so neither can drift', () => {
  const navbar = read('components/Navbar.tsx')
  // Both viewports map over the same two constants; there is no second list to
  // forget to clean.
  assert.match(navbar, /const primaryLinks = PRIMARY_NAVIGATION/)
  assert.match(navbar, /const exploreLinks = EXPLORE_NAVIGATION/)
  assert.equal(navbar.match(/primaryLinks\.map/g)?.length, 2, 'primary list should render in desktop and mobile')
  assert.equal(navbar.match(/exploreLinks\.map/g)?.length, 2, 'explore list should render in desktop and mobile')
})

test('the navigation components hardcode no route of their own', () => {
  // A literal href in the chrome is a link that bypasses the vetted lists.
  for (const file of ['components/Navbar.tsx', 'components/SiteFooter.tsx']) {
    const source = read(file)
    const internal = [...source.matchAll(/href="(\/[^"]*)"/g)].map((match) => match[1])
    for (const href of internal) {
      assert.ok(href === '/', `${file} hardcodes ${href}; it belongs in lib/navigation/site-navigation.ts`)
    }
  }
})

test('the footer renders only vetted links', () => {
  const footer = read('components/SiteFooter.tsx')
  assert.match(footer, /FOOTER_DEVELOPER_NAVIGATION/)
  assert.match(footer, /FOOTER_COMPANY_NAVIGATION/)
  for (const link of [...FOOTER_DEVELOPER_NAVIGATION, ...FOOTER_COMPANY_NAVIGATION]) {
    assert.ok(!isRegisterC(link.href))
  }
})

test('the homepage does not lead into the experimental register', () => {
  const homepage = read('app/page.tsx')
  for (const href of [...homepage.matchAll(/href="(\/[^"?#]*)/g)].map((match) => match[1])) {
    assert.ok(!isRegisterC(href), `the homepage links to Register C route ${href}`)
  }
  assert.ok(!homepage.includes('OPEN EDITION'), 'homepage should not surface book cards')
  assert.ok(!homepage.includes('INTERACTIVE PROTOTYPE'), 'homepage should not surface the game card')
  assert.ok(!homepage.includes('themahaprinciple.com'), 'the author brand belongs in the single footer note')
})

test('enterprise entry pages expose no Register C route in their own markup', () => {
  for (const page of [
    'app/context-compiler/page.tsx',
    'app/integrations/wso2/page.tsx',
    'app/enterprise-mcp-gateway/page.tsx',
    'app/evidence-audit/page.tsx',
    'app/developers/page.tsx',
    'app/case-studies/page.tsx',
    'app/contact/page.tsx',
  ]) {
    if (!existsSync(join(ROOT, page))) continue
    for (const href of [...read(page).matchAll(/href="(\/[^"?#]*)/g)].map((match) => match[1])) {
      assert.ok(!isRegisterC(href), `${page} links to Register C route ${href}`)
    }
  }
})

test('this separation adds no new author-brand link to the global chrome', () => {
  // Task 1 allows exactly one. The About page already carries it with rel="me",
  // and the entity graph references that anchor, so the footer must not add a
  // second one while dressing it up as a fix.
  assert.equal(AUTHOR_BRAND_CANONICAL_SURFACE, 'app/about/page.tsx')
  assert.match(read(AUTHOR_BRAND_CANONICAL_SURFACE), /mayonemaharajan\.com/)
  for (const file of ['components/SiteFooter.tsx', 'components/Navbar.tsx', 'app/page.tsx']) {
    assert.ok(
      !read(file).includes('mayonemaharajan.com'),
      `${file} adds an author-brand link; Task 1 permits exactly one and About already holds it`,
    )
  }
  // Recorded as outstanding rather than silently resolved.
  const surfaces = execFileSync('git', ['grep', '-l', 'mayonemaharajan.com', '--', 'app', 'components'], { cwd: ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean)
  assert.ok(surfaces.includes('app/about/page.tsx'))
  assert.ok(!surfaces.includes('components/SiteFooter.tsx'))
})

/**
 * Separation is an information-architecture change, not a takedown. Every route
 * that left the menu must still exist, still render, and still be indexable.
 */
test('no experimental route was deleted', () => {
  for (const route of [
    'app/doctrine/page.tsx',
    'app/protocols/page.tsx',
    'app/operations/timing/page.tsx',
    'app/reports/celestial/page.tsx',
    'app/overclock/page.tsx',
    'app/books/page.tsx',
    'app/apps/page.tsx',
    'app/research/page.tsx',
    'app/start/page.tsx',
    'app/software/page.tsx',
    'app/knowledge/astrology/page.tsx',
  ]) {
    assert.ok(existsSync(join(ROOT, route)), `${route} was deleted; separation must not remove content`)
  }
})

test('no route was deindexed or redirected away by this change', () => {
  const config = read('next.config.ts')
  for (const prefix of REGISTER_C_PREFIXES) {
    // The one pre-existing redirect is a /research child to the research
    // subdomain and predates this work; nothing else may be added.
    const added = new RegExp(`source: '${prefix}'`)
    assert.ok(!added.test(config), `${prefix} gained a redirect; POSITIONING-FIX's destination does not exist yet`)
  }
  for (const route of ['app/doctrine/page.tsx', 'app/books/page.tsx', 'app/overclock/page.tsx', 'app/apps/page.tsx']) {
    const source = read(route)
    assert.ok(!/noindex/i.test(source), `${route} gained a noindex directive`)
    assert.ok(!/robots:\s*\{[^}]*index:\s*false/.test(source), `${route} gained index: false`)
  }
})

test('the sitemap still offers the experimental routes to crawlers', () => {
  const sitemap = read('app/sitemap.ts')
  // Removing them from the menu must not remove them from discovery.
  for (const fragment of ['doctrine', 'protocols', 'books']) {
    assert.ok(sitemap.includes(fragment), `sitemap no longer lists ${fragment}`)
  }
})

test('the enterprise menu is built around the commercial thesis', () => {
  const primary = PRIMARY_NAVIGATION.map((link) => link.href)
  for (const required of ['/context-compiler', '/integrations/wso2', '/evidence-audit', '/enterprise-mcp-gateway', '/contact']) {
    assert.ok(primary.includes(required), `primary navigation is missing ${required}`)
  }
  // A bar longer than this stops being navigation and becomes a list.
  assert.ok(PRIMARY_NAVIGATION.length <= 8, 'primary navigation should stay scannable')
  const hrefs = ALL_GLOBAL_NAVIGATION.map((link) => link.href)
  assert.equal(new Set(PRIMARY_NAVIGATION.map((l) => l.href)).size, PRIMARY_NAVIGATION.length, 'duplicate primary entries')
  assert.ok(hrefs.every((href) => href.startsWith('/')), 'global navigation should hold internal routes only')
})

test('the enterprise exception is exactly the Cognitive Gateway', () => {
  assert.deepEqual([...ENTERPRISE_EXCEPTIONS], ['/research/mcp'])
  assert.equal(isRegisterC('/research'), true)
  assert.equal(isRegisterC('/research/the-sovereign-edge'), true)
  assert.equal(isRegisterC('/research/mcp'), false)
  assert.ok(EXPLORE_NAVIGATION.some((link) => link.href === '/research/mcp'))
})

test('prefix matching does not catch unrelated routes that merely share a stem', () => {
  assert.equal(isRegisterC('/apps'), true)
  assert.equal(isRegisterC('/apps/maha-os'), true)
  assert.equal(isRegisterC('/context-compiler'), false)
  assert.equal(isRegisterC('/knowledge'), false)
  assert.equal(isRegisterC('/knowledge/astrology/calculations'), true)
  assert.equal(isRegisterC('/startup-guide'), false, '/start prefix must not swallow /startup-guide')
})

test('the mobile menu keeps its accessibility contract', () => {
  const navbar = read('components/Navbar.tsx')
  assert.match(navbar, /aria-expanded=\{isOpen\}/)
  assert.match(navbar, /aria-controls="mobile-navigation"/)
  assert.match(navbar, /id="mobile-navigation"/)
  assert.match(navbar, /role="dialog"/)
  assert.match(navbar, /aria-modal="true"/)
  assert.match(navbar, /aria-label=\{isOpen \? 'Close navigation menu' : 'Open navigation menu'\}/)
  assert.match(navbar, /event\.key === 'Escape'/)
  assert.match(navbar, /onClick=\{toggleMenu\}/)
  const footer = read('components/SiteFooter.tsx')
  assert.match(footer, /aria-label="Developer infrastructure footer links"/)
  assert.match(footer, /aria-label="Company footer links"/)
})

/**
 * The desktop bar shares one capped line with the wordmark and the Explore
 * control. Product names run longer than the section names they replaced, so a
 * set that reads fine as a list can still collide in the chrome. This is the
 * guard that keeps a future addition from silently wrapping the bar.
 */
test('the desktop primary bar stays inside its width budget', () => {
  const characters = PRIMARY_NAVIGATION.reduce((total, link) => total + link.name.length, 0)
  assert.ok(
    characters <= PRIMARY_NAVIGATION_CHARACTER_BUDGET,
    `primary navigation labels total ${characters} characters, over the ${PRIMARY_NAVIGATION_CHARACTER_BUDGET} budget; shorten a label or move one to Explore`,
  )
  for (const link of PRIMARY_NAVIGATION) {
    assert.ok(link.name.length <= 18, `"${link.name}" is too long for the bar`)
  }
})

test('links dropped from the primary bar remain reachable elsewhere', () => {
  const secondary = [...EXPLORE_NAVIGATION, ...FOOTER_DEVELOPER_NAVIGATION, ...FOOTER_COMPANY_NAVIGATION].map((l) => l.href)
  // Case Studies left the bar for width, not for relevance.
  assert.ok(secondary.includes('/case-studies'))
  for (const href of ['/knowledge', '/intelligence', '/method', '/mps', '/tools', '/about', '/docs']) {
    assert.ok(secondary.includes(href), `${href} fell out of navigation entirely`)
  }
})
