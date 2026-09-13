import { COLLECTION_HUB_PATHS, isCollectionHub } from './collection-hub-paths.ts'

export const COLLECTION_ORIGIN = 'https://www.mahastrategies.com'
const names: Record<string, string> = {
  clearing: 'Evidence and application guides', 'epistemic-clearing': 'Evidence clearing guides',
  'epistemic-system': 'Evidence system', 'agent-governance': 'Agent governance',
  'greek-roman': 'Greek and Roman mythology', 'source-guides': 'Source guides',
  tiruvaymoli: 'Tiruvāymoḻi', paripatal: 'Paripāṭal', tolkappiyam: 'Tolkāppiyam',
  'tamil-religion': 'Tamil religion', 'divine-names': 'Divine names',
}
export function collectionLabel(path: string): string {
  const parts = path.split('/').filter(Boolean)
  const words = (part: string) => names[part] ?? part.replaceAll('-', ' ').replace(/^./, c => c.toUpperCase())
  const last = parts.at(-1) ?? 'Home'
  return ['clearing', 'epistemic-clearing', 'source-guides', 'workflows', 'concepts', 'methods', 'mechanisms', 'comparisons', 'measurements'].includes(last) && parts.length > 2
    ? `${words(parts.at(-2)!)}: ${words(last).toLowerCase()}` : words(last)
}

export function publicPaths(rows: readonly { url: string }[]): Set<string> {
  return new Set(rows.flatMap(row => {
    const url = new URL(row.url)
    return url.origin === COLLECTION_ORIGIN && !url.search && !url.hash ? [url.pathname] : []
  }))
}

// Only currently public descendants can populate a hub. Removed publications
// disappear from the listings; the stable hub remains a useful navigation page.
export function collectionModel(path: string, rows: readonly { url: string }[]) {
  if (!isCollectionHub(path)) return null
  const published = publicPaths(rows)
  const known = new Set([...published, ...COLLECTION_HUB_PATHS, '/', '/directory'])
  const descendants = [...published].filter(p => p.startsWith(path + '/') && !isCollectionHub(p)).sort()
  const subcollections = COLLECTION_HUB_PATHS.filter(p => p.startsWith(path + '/') && !COLLECTION_HUB_PATHS.some(q => q !== path && q !== p && q.startsWith(path + '/') && p.startsWith(q + '/')))
  const articles = descendants.filter(p => !subcollections.some(child => p.startsWith(child + '/')))
  const segments = path.split('/').filter(Boolean)
  const ancestors = ['/', ...segments.slice(0, -1).map((_, i) => '/' + segments.slice(0, i + 1).join('/'))].filter(p => known.has(p))
  return { path, title: collectionLabel(path), ancestors, articles, subcollections, articleCount: descendants.length }
}

export function directCollectionChildren(parent: string): string[] {
  return COLLECTION_HUB_PATHS.filter(path => path.slice(0, path.lastIndexOf('/')) === parent)
}
