#!/usr/bin/env node
/**
 * Served-output check for the nanotechnology and physical-AI sections.
 *
 * Fetches every new route from a locally running server and verifies the
 * things a unit test cannot see: that the HTML actually contains the article
 * body, the sources with their locators, and the boundary statement; that
 * every internal link on the page resolves to a 200; and that the whole
 * corpus is reachable from the homepage by following ordinary <a href> links
 * with no JavaScript.
 *
 * Usage: node scripts/verify-nano-physical-ai-render.cjs [baseUrl]
 * It reads a server; it writes nothing and calls nothing paid.
 */

const BASE = process.argv[2] || 'http://localhost:3117'

const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')

const hrefs = (html) => {
  const out = new Set()
  for (const match of html.matchAll(/<a\b[^>]*\bhref="(\/[^"#?]*)"/g)) out.add(match[1].replace(/\/$/, '') || '/')
  return [...out]
}

async function get(path) {
  const response = await fetch(`${BASE}${path}`, { redirect: 'manual' })
  const html = response.status === 200 ? await response.text() : ''
  return { status: response.status, html, text: strip(html) }
}

const failures = []
const check = (ok, message) => { if (!ok) failures.push(message) }

async function main() {
  const { NANO_ARTICLES, NANO_PATH, NANO_SOURCES } = await import('../lib/nanotechnology-knowledge.ts')
  const { PHYSICAL_AI_ARTICLES, PHYSICAL_AI_PATH, PHYSICAL_AI_SOURCES } = await import('../lib/physical-ai-knowledge.ts')

  const sections = [
    // Each section's boundary sentence, as a reader meets it in the served HTML.
    { name: 'nanotechnology', path: NANO_PATH, articles: NANO_ARTICLES, sources: NANO_SOURCES, boundary: /makes no materials[^.]*certifies nothing/i },
    { name: 'physical-ai', path: PHYSICAL_AI_PATH, articles: PHYSICAL_AI_ARTICLES, sources: PHYSICAL_AI_SOURCES, boundary: /operates no robot[^.]*endorses no system/i },
  ]

  // 1. Homepage reachability by following real links, no JavaScript.
  const home = await get('/')
  check(home.status === 200, `homepage returned ${home.status}`)
  const knowledgeLinked = hrefs(home.html).includes('/knowledge')
  check(knowledgeLinked, 'the homepage does not link /knowledge')
  const knowledge = await get('/knowledge')
  check(knowledge.status === 200, `/knowledge returned ${knowledge.status}`)
  const fromKnowledge = hrefs(knowledge.html)
  for (const section of sections) {
    check(fromKnowledge.includes(section.path), `/knowledge does not link ${section.path}`)
  }

  // 2. Each hub lists every one of its articles, as links.
  for (const section of sections) {
    const hub = await get(section.path)
    check(hub.status === 200, `${section.path} returned ${hub.status}`)
    const linked = hrefs(hub.html)
    for (const article of section.articles) {
      check(linked.includes(`${section.path}/${article.slug}`), `${section.path} does not link ${article.slug}`)
    }
    check(section.boundary.test(hub.text), `${section.path}: no boundary statement in the served HTML`)
  }

  // 3. Every article renders its full body, sources and locators.
  let articleCount = 0
  for (const section of sections) {
    for (const article of section.articles) {
      const path = `${section.path}/${article.slug}`
      const page = await get(path)
      check(page.status === 200, `${path} returned ${page.status}`)
      if (page.status !== 200) continue
      articleCount += 1
      const head = (value) => value.slice(0, 60).replace(/\s+/g, ' ')
      for (const [field, value] of Object.entries({ answer: article.answer, explanation: article.explanation, example: article.example, boundary: article.boundary })) {
        check(page.text.includes(head(value)), `${path}: ${field} is missing from the served HTML`)
      }
      for (const check1 of article.checks) check(page.text.includes(head(check1)), `${path}: a check is missing`)
      for (const id of article.sources) {
        const source = section.sources[id]
        check(page.html.includes(source.url), `${path}: source ${id} not linked`)
        check(page.text.includes(head(source.locator)), `${path}: locator for ${id} not rendered`)
      }
      // The section boundary must travel with every page, not just the hub.
      check(/Maha (Strategies )?(publishes|does not)/i.test(page.text), `${path}: no section boundary footer`)
      // Every internal link on the page must resolve.
      for (const href of hrefs(page.html)) {
        if (href.startsWith('/knowledge/nanotechnology') || href.startsWith('/knowledge/physical-ai')) {
          const linked = await get(href)
          check(linked.status === 200, `${path}: internal link ${href} returned ${linked.status}`)
        }
      }
    }
  }

  // 4. A slug outside the published set must not be served.
  const bogus = await get(`${NANO_PATH}/not-a-real-article`)
  check(bogus.status === 404, `an unpublished slug returned ${bogus.status} instead of 404`)

  // 5. The sitemap lists every new route.
  const sitemap = await get('/sitemap.xml')
  check(sitemap.status === 200, `sitemap returned ${sitemap.status}`)
  for (const section of sections) {
    check(sitemap.html.includes(section.path), `sitemap omits ${section.path}`)
    for (const article of section.articles) {
      check(sitemap.html.includes(`${section.path}/${article.slug}`), `sitemap omits ${article.slug}`)
    }
  }

  console.log(`Checked ${articleCount} articles, 2 hubs, the knowledge index, the homepage and the sitemap against ${BASE}.`)
  if (failures.length > 0) {
    console.error(`\n${failures.length} problem(s):`)
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
  }
  console.log('All served-output checks passed.')
}

main().catch((error) => { console.error(error); process.exit(1) })
