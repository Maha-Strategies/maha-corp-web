import { federationDirectoryProperties } from '@/lib/federation-publication'
import { MYTHOLOGY_PATH, mythologyTraditions } from '@/lib/mythology-navigation'

export const SITE_DIRECTORY_PATH = '/directory'

export function siteDirectoryProperties() {
  const properties = federationDirectoryProperties()
  const routeCount = properties.reduce((sum, property) => sum + property.urls.length, 0)
  if (routeCount !== 4_000) throw new Error(`site-directory-cardinality-invalid:${routeCount}`)
  return properties
}

export function siteDirectoryNavigationRoutes() {
  return [SITE_DIRECTORY_PATH, MYTHOLOGY_PATH, ...mythologyTraditions().map((tradition) => tradition.path)] as const
}

export function directoryLabel(url: string) {
  const parsed = new URL(url)
  if (parsed.pathname === '/') return parsed.hostname
  return decodeURIComponent(parsed.pathname.slice(1)).replaceAll('/', ' · ').replaceAll('-', ' ')
}
