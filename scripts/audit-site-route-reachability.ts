import { readFileSync } from 'node:fs'

const baseline = JSON.parse(readFileSync(new URL('../content/federation/federation-route-baseline-v1.json', import.meta.url), 'utf8'))
const released = JSON.parse(readFileSync(new URL('../content/federation/public/federation-public-route-index-v1.json', import.meta.url), 'utf8'))
const navigation = ['/directory', '/knowledge/religion/mythology']
const mythology = released.entries.filter((entry: { path: string }) => entry.path.startsWith('/knowledge/religion/mythology/'))
const traditions = [...new Set(mythology.map((entry: { path: string }) => entry.path.split('/')[4]))].sort()
navigation.push(...traditions.map((tradition) => `/knowledge/religion/mythology/${tradition}`))

const contentUrls = new Set<string>(baseline.observedProperties.flatMap((property: { routes: string[] }) => property.routes))
for (const entry of released.entries as { canonicalUrl: string }[]) contentUrls.add(entry.canonicalUrl)
const subjectGroups = Map.groupBy(mythology, (entry: { path: string }) => entry.path.split('/').slice(0, 6).join('/'))
const greekRoman = mythology.filter((entry: { path: string }) => entry.path.includes('/greek-roman/'))
const greekRomanGroups = Map.groupBy(greekRoman, (entry: { path: string }) => entry.path.split('/')[5])

const report = {
  schemaVersion: 'maha-homepage-route-reachability/1.0',
  root: '/',
  contentRoutes: contentUrls.size,
  navigationRoutes: navigation.length,
  reachableRoutes: contentUrls.size + navigation.length,
  mythology: { articles: mythology.length, traditions: traditions.length, subjects: subjectGroups.size },
  greekRoman: { subjects: greekRomanGroups.size, articles: greekRoman.length, everySubjectHasThreeArticles: [...greekRomanGroups.values()].every((entries) => entries.length === 3) },
  edges: ['home -> directory', 'home -> knowledge -> religion -> mythology', 'mythology -> tradition', 'tradition -> subject article', 'subject article -> every released sibling'],
  verdict: contentUrls.size === 4_000 && navigation.length === 10 && mythology.length === 85 && [...greekRomanGroups.values()].every((entries) => entries.length === 3) ? 'pass' : 'fail',
}

console.log(JSON.stringify(report, null, 2))
if (report.verdict !== 'pass') process.exitCode = 1
