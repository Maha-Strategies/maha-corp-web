import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { test } from 'node:test'

import {
  MAYON_AVAILABILITY,
  MAYON_EVENTS,
  MAYON_HUB_PATH,
  MAYON_HUB_URL,
  MAYON_LINKS,
  MAYON_QUESTIONS,
  MAYON_ROADMAP,
  MAYON_SCREENSHOTS,
  MAYON_SOURCES,
  MAYON_TRAILER,
} from '../lib/mayon-hub.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const page = read('app/mayon/page.tsx')
const media = read('components/MayonMedia.tsx')
const config = read('next.config.ts')
const sitemap = read('app/sitemap.ts')

test('/apps/mayon redirects to the hub exactly, and the privacy notice keeps its own URL', () => {
  // Exact source, never a pattern: a wildcard here would swallow the privacy
  // notice, which has to stay reachable at its published address.
  assert.match(config, /source: '\/apps\/mayon',\s*\n\s*destination: '\/mayon',\s*\n\s*permanent: true,/)
  assert.doesNotMatch(config, /source: '\/apps\/mayon[/:]/)
  assert.equal(existsSync(new URL('../app/apps/mayon/page.tsx', import.meta.url)), false, 'the consolidated page is gone, so the redirect cannot loop back into it')
  assert.equal(existsSync(new URL('../app/apps/mayon/privacy/page.tsx', import.meta.url)), true)
  assert.equal(existsSync(new URL('../app/projects/mayon/page.tsx', import.meta.url)), true)
  assert.match(read('app/projects/mayon/page.tsx'), /href="\/mayon"/)
})

test('the sitemap lists the hub and drops the redirected documentation URL', () => {
  assert.match(sitemap, /\$\{baseUrl\}\/mayon`, lastModified: new Date\('2026-09-16'\)/)
  assert.doesNotMatch(sitemap, /\$\{baseUrl\}\/apps\/mayon`/)
  // The federation route baseline still observes the old URL, so the sitemap
  // filters it rather than editing that record.
  assert.match(sitemap, /CONSOLIDATED_ROUTES = new Set\(\[`\$\{MAHA_SITE_URL\}\/apps\/mayon`\]\)/)
  assert.match(sitemap, /\.filter\(\(row\) => !CONSOLIDATED_ROUTES\.has\(String\(row\.url\)\)\)/)
  // The privacy notice is a distinct canonical page and stays listed.
  assert.match(sitemap, /\$\{baseUrl\}\/apps\/mayon\/privacy`/)
  assert.match(sitemap, /\$\{baseUrl\}\/projects\/mayon`/)
})

test('every destination is an https URL on the domain it claims to be', () => {
  const expectedHost: Record<string, string> = {
    browser: 'mayonrajan.com', teachers: 'mayonrajan.com', methods: 'mayonrajan.com', sources: 'mayonrajan.com',
    updates: 'mayonrajan.com', companion: 'mayonrajan.com', journeyStorage: 'mayonrajan.com', journeyDeep: 'mayonrajan.com',
    crystal: 'mayonrajan.com', android: 'play.google.com', ios: 'apps.apple.com', trailer: 'www.youtube.com',
    phivolcs: 'volcano.phivolcs.dost.gov.ph', smithsonian: 'volcano.si.edu', petrology: 'doi.org',
    unescoTentative: 'whc.unesco.org', thesis: 'research.mahastrategies.com',
  }
  for (const [name, href] of Object.entries(MAYON_LINKS)) {
    if (name === 'contact') { assert.match(href, /^mailto:mayone@mahastrategies\.com\?subject=/); continue }
    const url = new URL(href)
    assert.equal(url.protocol, 'https:', name)
    assert.equal(url.host, expectedHost[name], name)
  }
  // The user's storefront for this project, not the module's previous one.
  assert.equal(MAYON_LINKS.ios, 'https://apps.apple.com/au/app/mayon/id6794775508')
  // Deep links use the parameters the app actually reads (js/main.js).
  assert.equal(new URL(MAYON_LINKS.journeyStorage).searchParams.get('journey'), 'storage')
  assert.equal(new URL(MAYON_LINKS.crystal).searchParams.get('crystal'), '1')
})

test('availability names the web release and claims no store version', () => {
  assert.match(MAYON_AVAILABILITY.web.status, /1\.5/)
  for (const entry of [MAYON_AVAILABILITY.android, MAYON_AVAILABILITY.ios]) {
    assert.doesNotMatch(`${entry.status} ${entry.detail}`, /1\.5 (?:is )?(?:available|live|out) on|version 1\.5 on/i)
  }
  // Store approval is never inferred from a local version number.
  assert.doesNotMatch(page, /1\.5 is (?:available|live) on (?:the App Store|Google Play|both stores)/i)
  assert.doesNotMatch(page, /being prepared for store release|releases are being prepared/i)
})

test('the page is self-canonical, keeps the company hostname, and links its neighbours', () => {
  assert.equal(MAYON_HUB_URL, `https://www.mahastrategies.com${MAYON_HUB_PATH}`)
  assert.match(page, /alternates: \{ canonical: MAYON_HUB_PATH \}/)
  assert.match(page, /url: MAYON_HUB_URL/)
  assert.doesNotMatch(page, /https:\/\/mahastrategies\.com[^.]/, 'no non-www canonical variant')
  for (const href of ['/projects/mayon', '/apps/mayon/privacy', '/knowledge/religion/mayon']) {
    assert.ok(page.includes(`href="${href}"`), href)
  }
})

test('structured data describes only what the page shows, with verified video facts', () => {
  for (const type of ['WebPage', 'SoftwareApplication', 'VideoObject', 'BreadcrumbList']) assert.ok(page.includes(`'${type}'`), type)
  assert.match(page, /uploadDate: MAYON_TRAILER\.uploadDate/)
  assert.equal(MAYON_TRAILER.uploadDate, '2026-09-15')
  assert.equal(MAYON_TRAILER.durationSeconds, 60)
  assert.match(page, /duration: 'PT1M'/)
  assert.equal(new URL(MAYON_TRAILER.embedUrl).host, 'www.youtube-nocookie.com')
  // Nothing invented: no ratings, prices, awards or install counts.
  assert.doesNotMatch(page, /aggregateRating|ratingValue|reviewCount|offers:|price:|award/i)
  assert.match(page, /'@id': MAHA_ORGANIZATION_ID/, 'reuses the existing organization node')
})

test('the concept film loads nothing until it is asked to', () => {
  // The poster is a local file and the iframe only exists in the playing
  // branch, so a first render pulls no YouTube script, cookie or frame.
  assert.doesNotMatch(page, /<iframe/)
  assert.match(media, /const \[playing, setPlaying\] = useState\(false\)/)
  assert.ok(media.indexOf('if (playing)') < media.indexOf('<iframe'))
  assert.match(media, /poster/i)
  // The concept label lives in the page, above the player, not inside it.
  assert.match(page, /This is a concept film/)
  assert.match(page, /Watch on YouTube instead/)
})

test('screenshots are real exported app frames with alt text, captions and fixed dimensions', () => {
  assert.equal(MAYON_SCREENSHOTS.length, 4)
  for (const shot of MAYON_SCREENSHOTS) {
    const file = new URL(`../public${shot.src}`, import.meta.url)
    assert.ok(existsSync(file), shot.src)
    assert.ok(statSync(file).size > 10_000, `${shot.src} is a real image`)
    assert.ok(shot.alt.length > 40, `${shot.src} describes itself for a screen reader`)
    assert.ok(shot.caption.length > 0 && shot.action.length > 40, shot.src)
    assert.equal(shot.width / shot.height, 810 / 1440, `${shot.src} keeps the captured aspect ratio`)
  }
  for (const asset of ['/mayon/living-mountain-poster.webp', '/mayon/og-mayon.jpg']) {
    assert.ok(existsSync(new URL(`../public${asset}`, import.meta.url)), asset)
  }
  // Every <Image> on the page carries explicit dimensions, so nothing shifts.
  for (const match of page.matchAll(/<Image\b[\s\S]*?\/>/g)) {
    assert.ok(/width=|fill/.test(match[0]) && /height=|fill/.test(match[0]), 'image reserves its space')
    assert.match(match[0], /alt=/)
  }
})

test('measurement uses the existing conversion helper and never blocks navigation', () => {
  for (const event of Object.values(MAYON_EVENTS)) {
    // `cta_` prefix is what the existing endpoint classifies as a CTA click.
    assert.match(event, /^cta_[a-z][a-z0-9_]{2,60}$/)
  }
  assert.match(media, /import \{ trackConversion \} from '@\/components\/ConversionTracker'/)
  assert.doesNotMatch(media, /preventDefault/)
  assert.match(media, /href=\{href\}/)
  const events = [...page.matchAll(/event=\{MAYON_EVENTS\.([a-z]+)\}|event=\{entry\.event\}/g)]
  assert.ok(events.length >= 6, 'the six aggregate actions are instrumented')
})

test('the answers, roadmap and sources are complete and honestly labelled', () => {
  assert.equal(MAYON_QUESTIONS.length, 6)
  assert.equal(new Set(MAYON_QUESTIONS.map((q) => q.id)).size, 6)
  for (const question of MAYON_QUESTIONS) assert.ok(question.answer.length > 200, question.id)
  const statuses = new Set(MAYON_ROADMAP.map((item) => item.status))
  assert.ok([...statuses].every((status) => ['Available', 'In development', 'Exploring'].includes(status)))
  assert.equal(MAYON_ROADMAP.filter((item) => item.status === 'Available').length, 1, 'only shipped work is Available')
  assert.ok(MAYON_SOURCES.some((source) => source.href === MAYON_LINKS.phivolcs))
  // A tentative list is a proposal, not an inscription.
  const unesco = MAYON_SOURCES.find((source) => source.href === MAYON_LINKS.unescoTentative)!
  assert.match(unesco.use, /tentative/i)
  assert.doesNotMatch(`${unesco.title} ${unesco.use}`, /World Heritage Site|inscribed/i)
  // No live alert level anywhere on the page.
  assert.doesNotMatch(page, /Alert Level \d|current alert level is/i)
})
