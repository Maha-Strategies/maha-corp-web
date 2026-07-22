import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { openApiDocument } from '../lib/openapi.ts'

const APP_DIR = join(import.meta.dirname, '..', 'app')

// Routes intentionally absent from the public spec. Reviewer and operator
// surfaces are private; nested preflight routes are covered by their product
// page; the docs route documents itself by serving the spec.
const PRIVATE_ROUTES = new Set([
  '/api/admin/mps-operations/actions',
  '/api/admin/mps-operations/lookup',
  '/api/admin/revenue-control-plane',
  '/api/admin/revenue-metrics',
  '/api/admin/experiments',
  '/api/admin/content-candidates',
  '/api/admin/content-drafts',
  '/api/admin/content-draft-assistant',
  '/api/admin/content-candidate-assistant',
  '/api/admin/content-handoffs',
  '/api/admin/content-publications',
  '/api/admin/content-publication-amendments',
  '/api/admin/inbound-operations',
  '/api/admin/market-opportunities',
  '/api/admin/outbound',
  '/api/admin/sales-pipeline',
  '/api/admin/market-scout',
  '/api/admin/search-console-import',
  '/api/admin/search-performance',
  '/api/agent-credentials',
  '/api/agent-credentials/[credentialId]',
  '/api/agent-inquiries',
  '/api/agent-inquiries/[inquiryId]',
  '/api/audit/events',
  '/api/docs/openapi',
  '/api/inbound-submissions',
  '/api/integrations/base44/openapi',
  '/api/cron/inbound-digest',
  '/api/cron/market-scout',
  '/api/cron/utility-upload-cleanup',
  '/api/conversion-events',
  '/api/cron/utility-upload-cleanup',
  '/api/mps-audits/[auditId]',
  '/api/mps-preflight/[orderId]',
  '/api/mps-preflight/checkout',
  '/api/mps-preflight/submit',
  '/api/mps-preflight/webhook',
  '/api/utilities/receipts/demo',
  '/api/utilities/receipts/checkout',
  '/api/utilities/receipts/run',
  '/api/utilities/receipts/uploads',
  '/api/utilities/webhook',
])

function routePathsOnDisk(dir: string, prefix: string): string[] {
  const paths: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) paths.push(...routePathsOnDisk(join(dir, entry.name), `${prefix}/${entry.name}`))
    else if (entry.name === 'route.ts') paths.push(prefix)
  }
  return paths
}

// OpenAPI writes path params as `{id}`; Next.js names the directory `[id]`.
function specPathToDisk(specPath: string): string {
  return specPath.replace(/\{([^}]+)\}/g, '[$1]')
}

test('every documented path has a route handler on disk', () => {
  for (const specPath of Object.keys(openApiDocument.paths)) {
    const routeFile = join(APP_DIR, ...specPathToDisk(specPath).split('/').filter(Boolean), 'route.ts')
    assert.ok(existsSync(routeFile), `${specPath} is documented but ${routeFile} does not exist`)
  }
})

test('every API route on disk is documented or explicitly private', () => {
  const documented = new Set(Object.keys(openApiDocument.paths).map(specPathToDisk))
  for (const routePath of routePathsOnDisk(join(APP_DIR, 'api'), '/api')) {
    assert.ok(
      documented.has(routePath) || PRIVATE_ROUTES.has(routePath),
      `${routePath} exists but is neither documented in lib/openapi.ts nor listed as private in this test`,
    )
  }
})

test('spec is structurally sound and self-consistent', () => {
  assert.equal(openApiDocument.openapi, '3.1.0')
  assert.ok(openApiDocument.info.description.includes('402'), 'credit-system context missing')
  assert.ok(openApiDocument.info.description.toLowerCase().includes('idempoten'), 'idempotency context missing')
  assert.ok(openApiDocument.info.description.includes('Authorization: Bearer'), 'authentication context missing')

  const serialized = JSON.stringify(openApiDocument)
  const componentRefs = [...serialized.matchAll(/#\/components\/(schemas|responses)\/([A-Za-z]+)/g)]
  for (const [, kind, name] of componentRefs) {
    const registry = openApiDocument.components[kind as 'schemas' | 'responses'] as Record<string, unknown>
    assert.ok(name in registry, `dangling $ref to #/components/${kind}/${name}`)
  }

  const documentedTags = new Set(openApiDocument.tags.map((tag) => tag.name))
  for (const operations of Object.values(openApiDocument.paths)) {
    for (const operation of Object.values(operations)) {
      for (const tag of operation.tags) {
        assert.ok(documentedTags.has(tag), `operation tag "${tag}" is not declared in the tags list`)
      }
    }
  }
})
