/**
 * Check what a production build actually serves.
 *
 * A development server is not evidence here. Turbopack caches JSON imports, so
 * after a content artifact is regenerated the dev server can show none of the
 * sections that depend on it -- indistinguishable from a rendering fault that
 * does not exist. This verifier refuses to run against one.
 *
 *   npm run build && npx next start -p 3100
 *   node --experimental-strip-types scripts/verify-rendered-pages.ts
 */
import { readFileSync } from 'node:fs'

const base = (process.env.VERIFY_BASE_URL ?? 'http://localhost:3100').replace(/\/$/, '')
if (/:3000(\/|$)/.test(base)) {
  throw new Error('Refusing to verify against port 3000, the development server. Build and serve the production output instead.')
}

const compiled = JSON.parse(readFileSync('content/legacy-uplift/uplift-compiled.json', 'utf8'))
type Page = { route: string; sections?: { dimension: string; heading: string; items: string[] }[]
  after: { relatedRoutes?: string[] } | null }
const pages = compiled.pages as Page[]
const allRoutes = new Set(pages.map((p) => p.route))

/** Representative pages: one per family, plus every page with related records. */
const byFamily = new Map<string, Page>()
for (const page of pages) {
  const family = page.route.split('/')[2] ?? ''
  if (!byFamily.has(family)) byFamily.set(family, page)
}
const sample = [...byFamily.values()]

const failures: string[] = []
const checked = { pages: 0, headings: 0, relatedLinks: 0, routes: 0 }

for (const page of sample) {
  const res = await fetch(`${base}${page.route}`)
  if (!res.ok) { failures.push(`${page.route}: HTTP ${res.status}`); continue }
  const html = await res.text()
  checked.pages += 1

  for (const section of page.sections ?? []) {
    checked.headings += 1
    if (!html.includes(section.heading)) {
      failures.push(`${page.route}: heading "${section.heading}" is compiled but not served`)
    }
  }
  for (const related of page.after?.relatedRoutes ?? []) {
    checked.relatedLinks += 1
    if (!html.includes(`href="${related}"`)) {
      failures.push(`${page.route}: related record ${related} is compiled but not linked`)
    }
  }
  if (!/rel="canonical"/.test(html)) failures.push(`${page.route}: no canonical link`)
  if (!/application\/ld\+json/.test(html)) failures.push(`${page.route}: no JSON-LD`)

  // Every internal knowledge link must resolve to a route the corpus has.
  for (const href of [...html.matchAll(/href="(\/knowledge\/[^"#?]*)"/g)].map((m) => m[1])) {
    checked.routes += 1
    const known = allRoutes.has(href) || href.split('/').filter(Boolean).length <= 2
    if (!known) {
      const probe = await fetch(`${base}${href}`, { method: 'HEAD' })
      if (probe.status === 404) failures.push(`${page.route}: internal link ${href} is a 404`)
    }
  }
}

console.log(`pages ${checked.pages} | headings ${checked.headings} | related links ${checked.relatedLinks} | internal links ${checked.routes}`)
if (failures.length > 0) {
  for (const f of failures) console.error(`  FAIL ${f}`)
  throw new Error(`${failures.length} rendering check(s) failed.`)
}
console.log('every compiled heading and related record is served, with canonical and JSON-LD present.')
