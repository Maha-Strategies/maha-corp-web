import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { buildLlmsManifest } from '../lib/llms-manifest.ts'

const PUBLIC = join(import.meta.dirname, '..', 'public')
const DISCOVERY = join(import.meta.dirname, '..', 'content', 'discovery')
const REGISTRY_URL = 'https://www.mahastrategies.com/maha-machine-readable-registry.json'
const SCHEMA_URL = 'https://www.mahastrategies.com/maha-machine-readable-registry.schema.json'

type Registry = {
  $schema: string
  registryVersion: string
  assertionBoundary: { publicOnly: boolean; noCredentialOrCustomerData: boolean; doesNotGuarantee: string[] }
  resources: Array<{ id: string; url: string; machineReadable: boolean; evidenceBoundary: string; evidence?: string[]; schemas?: string[] }>
}

test('machine-readable registry is public-only, bounded, and self-described', () => {
  const registry = JSON.parse(readFileSync(join(PUBLIC, 'maha-machine-readable-registry.json'), 'utf8')) as Registry
  assert.equal(registry.$schema, SCHEMA_URL)
  assert.match(registry.registryVersion, /^\d+\.\d+\.\d+$/)
  assert.equal(registry.assertionBoundary.publicOnly, true)
  assert.equal(registry.assertionBoundary.noCredentialOrCustomerData, true)
  assert.ok(registry.assertionBoundary.doesNotGuarantee.some((item) => item.includes('crawled')))

  const ids = new Set<string>()
  for (const resource of registry.resources) {
    assert.equal(ids.has(resource.id), false, `duplicate resource id ${resource.id}`)
    ids.add(resource.id)
    assert.ok(resource.url.startsWith('https://www.mahastrategies.com/'), `${resource.id} must use Maha's public origin`)
    assert.ok(resource.evidenceBoundary.length > 30, `${resource.id} needs an explicit evidence boundary`)
    for (const url of [...(resource.evidence ?? []), ...(resource.schemas ?? [])]) {
      assert.ok(url.startsWith('https://www.mahastrategies.com/'), `${resource.id} must not catalog a private or third-party URL`)
    }
  }
})

test('registry is linked from both principal discovery surfaces', () => {
  const card = JSON.parse(readFileSync(join(DISCOVERY, 'agent-card.json'), 'utf8')) as { machineReadableRegistry?: string }
  assert.equal(card.machineReadableRegistry, REGISTRY_URL)
  assert.ok(buildLlmsManifest([]).includes(REGISTRY_URL))
})

/**
 * Every advertised URL must actually be served.
 *
 * The structural checks above passed while the registry's own first entry
 * pointed at `/.well-known/agent-card.json`, which returns a hard 404 in
 * production: `next.config.ts` declares a compatibility redirect for it, and
 * the redirect does not fire. A dead link in a document written for automated
 * agents is worse than an omission, because nothing is there to notice it.
 *
 * This resolves each path against the repo's own routing — static files, route
 * handlers, rewrites and redirects — so it runs offline in CI and fails on the
 * next dead link rather than on the next production check.
 */
test('every URL the registry advertises is served by this repository', async () => {
  const { default: config } = await import('../next.config.ts')
  const rewrites = (await config.rewrites?.()) ?? []
  const redirects = (await config.redirects?.()) ?? []
  const rewriteSources = new Set((Array.isArray(rewrites) ? rewrites : []).map((entry) => entry.source))
  const redirectMap = new Map((redirects as { source: string; destination: string }[]).map((entry) => [entry.source, entry.destination]))

  const publicDir = new URL('../public/', import.meta.url).pathname
  const appDir = new URL('../app/', import.meta.url).pathname

  const routeExists = (pathname: string): boolean => {
    const clean = pathname.replace(/^\//, '')
    if (existsSync(join(publicDir, clean))) return true
    if (existsSync(join(appDir, clean, 'route.ts'))) return true
    if (existsSync(join(appDir, clean, 'page.tsx'))) return true
    return false
  }

  const reachable = (pathname: string, depth = 0): boolean => {
    if (depth > 3) return false
    if (routeExists(pathname)) return true
    if (rewriteSources.has(pathname)) {
      const target = (Array.isArray(rewrites) ? rewrites : []).find((entry) => entry.source === pathname)?.destination
      return typeof target === 'string' ? reachable(target, depth + 1) : false
    }
    const redirectTarget = redirectMap.get(pathname)
    if (redirectTarget) return reachable(redirectTarget, depth + 1)
    return false
  }

  const registry = JSON.parse(readFileSync(new URL('../public/maha-machine-readable-registry.json', import.meta.url), 'utf8'))
  const urls = new Set<string>()
  for (const resource of registry.resources) {
    urls.add(resource.url)
    for (const item of resource.evidence ?? []) urls.add(item)
    for (const item of resource.schemas ?? []) urls.add(item)
  }

  const dead: string[] = []
  for (const url of urls) {
    const pathname = new URL(url).pathname
    if (!reachable(pathname)) dead.push(pathname)
  }
  assert.deepEqual(dead, [], `the registry advertises paths this repository does not serve: ${dead.join(', ')}`)
})

test('the registry does not advertise the agent-card path whose redirect does not fire', () => {
  // Affirmative guard on a specific known-dead path. If the redirect is ever
  // fixed this can be relaxed, but until then the registry must not point
  // automated agents at a 404.
  const raw = readFileSync(new URL('../public/maha-machine-readable-registry.json', import.meta.url), 'utf8')
  assert.ok(!raw.includes('/.well-known/agent-card.json'), 'this path 404s in production; use /.well-known/agent.json')
  assert.ok(raw.includes('/.well-known/agent.json'), 'the canonical agent card URL must still be advertised')
})
