const EXACT_HOSTS = {
  publish: 'publish.mahastrategies.com',
  research: 'research.mahastrategies.com',
  os: 'www.maha-os.com',
  policy: 'policy.mahastrategies.com',
  strategies: 'www.mahastrategies.com',
  mayon: 'mayonrajan.com',
  mayonAuthor: 'www.mayonrajan.com',
  mayone: 'www.mayonemaharajan.com',
  mayoneSources: 'mayonemaharajan.com',
} as const

export const FEDERATION_CANONICAL_HOSTS = Object.freeze(Object.values(EXACT_HOSTS))

const POLICY_ROUTE_ROLES = new Set([
  'comparison',
  'current-law',
  'definition',
  'evidence',
  'implementation',
  'machine-rule',
  'mechanisms',
  'sources',
  'tradeoffs',
  'uncertainty',
])

function isFederatedPolicyPath(pathname: string): boolean {
  const match = /^\/policy\/[^/]+\/([^/]+)\/?$/.exec(pathname)
  return match !== null && POLICY_ROUTE_ROLES.has(match[1])
}

export function federationCanonicalHostForPath(pathname: string): string | null {
  if (pathname === '/directory' || pathname === '/knowledge/religion/mythology') return EXACT_HOSTS.strategies
  if (/^\/discover\/(definitions|current-law|mechanisms|implementation|machine-rules|evidence|tradeoffs-and-uncertainty)\/?$/.test(pathname)) return EXACT_HOSTS.policy
  if (pathname.startsWith('/agentic-publishing/')) return EXACT_HOSTS.publish
  if (pathname.startsWith('/federation/research/')) return EXACT_HOSTS.research
  if (pathname.startsWith('/knowledge/private-machine-systems/')) return EXACT_HOSTS.os
  if (isFederatedPolicyPath(pathname)) return EXACT_HOSTS.policy
  if (pathname.startsWith('/clearing/')) return EXACT_HOSTS.strategies
  if (pathname.startsWith('/knowledge/religion/mythology/')) return EXACT_HOSTS.strategies
  if (pathname.startsWith('/knowledge/religion/source-guides/')) return EXACT_HOSTS.strategies
  if (pathname.startsWith('/mayon-volcano/')) return EXACT_HOSTS.mayon
  if (pathname === '/sources/the-maha-principle/authorial-provenance') return EXACT_HOSTS.mayonAuthor
  if (pathname.startsWith('/concepts/')) return EXACT_HOSTS.mayone
  if (pathname.startsWith('/sources/')) return EXACT_HOSTS.mayoneSources
  if (/^\/source-guides\/[^/]+\/machine-use\/?$/.test(pathname)) return EXACT_HOSTS.publish
  if (/^\/source-guides\/[^/]+\/authority-scope\/?$/.test(pathname)) return EXACT_HOSTS.policy
  return null
}

export function normalizedRequestHost(host: string | null): string {
  return (host ?? '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '')
}

export function federationHostAllowsPath(host: string | null, pathname: string): boolean {
  const expected = federationCanonicalHostForPath(pathname)
  return expected === null || normalizedRequestHost(host) === expected
}
