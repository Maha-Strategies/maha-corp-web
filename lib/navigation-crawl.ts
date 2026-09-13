export type CrawledPage = { status: number; links: string[]; canonical: string | null; soft404: boolean }
export function inspectNavigationHtml(html: string, origin: string): Omit<CrawledPage, 'status'> {
  const decode = (s: string) => s.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"')
  const attributes = (tag: string) => Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1].toLowerCase(), decode(m[2])]))
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  const links = [...markup.matchAll(/<a\b[^>]*>/gi)].flatMap(m => {
    const href = attributes(m[0]).href
    if (!href) return []
    try { const u = new URL(href, origin); return u.origin === origin && !u.search ? [u.pathname] : [] } catch { return [] }
  })
  const canonical = [...markup.matchAll(/<link\b[^>]*>/gi)].map(m => attributes(m[0])).find(a => a.rel === 'canonical')?.href ?? null
  return { links: [...new Set(links)], canonical, soft404: /<title>[^<]*(?:404|not found)/i.test(markup) }
}

// Sitemap membership defines scope, never an assumed link or successful response.
export async function crawlNavigation(expected: readonly string[], fetchPage: (path: string) => Promise<CrawledPage>, canonicalOrigin: string, concurrency = 6) {
  const scope = new Set(['/', ...expected]), queue = ['/'], scheduled = new Set(queue)
  const visited = new Set<string>(), failures: { path: string; reason: string }[] = []
  const edges: Record<string, string[]> = {}, outsideScope = new Set<string>()
  while (queue.length) {
    const batch = queue.splice(0, concurrency)
    await Promise.all(batch.map(async path => {
      visited.add(path)
      try {
        const page = await fetchPage(path)
        if (page.status !== 200 || page.soft404) { failures.push({ path, reason: `http-${page.status}${page.soft404 ? '-soft404' : ''}` }); return }
        // URL serialization equates the origin and its root slash, but does
        // not excuse a leaf page inheriting the homepage canonical.
        let canonicalMatches = false
        try { canonicalMatches = page.canonical !== null && new URL(page.canonical).href === new URL(canonicalOrigin + path).href } catch { /* malformed canonical refuses */ }
        if (!canonicalMatches) failures.push({ path, reason: 'canonical-mismatch' })
        edges[path] = page.links
        for (const link of page.links) {
          if (!scope.has(link)) { outsideScope.add(link); continue }
          if (!scheduled.has(link)) { scheduled.add(link); queue.push(link) }
        }
      } catch (error) { failures.push({ path, reason: error instanceof Error ? error.message : String(error) }) }
    }))
  }
  const unreachable = [...scope].filter(path => !visited.has(path)).sort()
  return { scope: 'same-host sitemap URLs reached through HTML anchors', expected: scope.size, fetched: visited.size, failures, unreachable, linksOutsideSitemap: [...outsideScope].sort(), edges, verdict: failures.length || unreachable.length ? 'fail' : 'pass' }
}
