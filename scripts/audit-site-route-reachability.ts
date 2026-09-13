import { writeFileSync } from 'node:fs'
import { COLLECTION_HUB_PATHS } from '../lib/collection-hub-paths.ts'
import { crawlNavigation, inspectNavigationHtml } from '../lib/navigation-crawl.ts'

const arg = (name: string) => process.argv.find(v => v.startsWith(name + '='))?.slice(name.length + 1)
const base = new URL(arg('--base') ?? 'http://127.0.0.1:3412').origin
const canonicalOrigin = 'https://www.mahastrategies.com'
const sitemap = await fetch(base + '/sitemap.xml', { signal: AbortSignal.timeout(60000) })
if (!sitemap.ok) throw new Error(`sitemap-http-${sitemap.status}`)
const expected = [...(await sitemap.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map(m => new URL(m[1])).filter(u => u.origin === canonicalOrigin).map(u => u.pathname)
if (expected.length < 2600) throw new Error('sitemap-scope-incomplete')
for (const path of COLLECTION_HUB_PATHS) if (!expected.includes(path)) throw new Error(`hub-missing-from-sitemap:${path}`)
const report = await crawlNavigation(expected, async path => {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(45000), redirect: 'manual' })
  return { status: response.status, ...inspectNavigationHtml(await response.text(), canonicalOrigin) }
}, canonicalOrigin)
const output = arg('--output') ?? '/private/tmp/maha-navigation-crawl.json'
writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
const { edges, ...summary } = report
const hubFailures = report.failures.filter(f => COLLECTION_HUB_PATHS.includes(f.path))
const unreachableHubs = report.unreachable.filter(p => COLLECTION_HUB_PATHS.includes(p))
console.log(JSON.stringify({ ...summary, parentHubs: { expected: COLLECTION_HUB_PATHS.length, failures: hubFailures, unreachable: unreachableHubs, passed: COLLECTION_HUB_PATHS.length - new Set([...hubFailures.map(f => f.path), ...unreachableHubs]).size }, recordedPages: Object.keys(edges).length, output }, null, 2))
if (report.verdict !== 'pass') process.exitCode = 1
