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
  '/api/geocoding/places',
  // Compatibility prototype. Promote only after the controlled A2A + MCP E2E
  // passes against Preview and the contract is reviewed for public support.
  '/api/v1/a2a/agents',
  '/api/v1/a2a/gateway/[agentId]',
  '/api/v1/a2a/register',
  // Confirmatory-research control plane. These routes expose participant
  // pseudonyms, locked plans, and outcome state and require the dedicated
  // registry operations token. A privacy-reviewed public projection does not
  // exist yet, so none belongs in the customer OpenAPI contract.
  '/api/v1/celestial-hypotheses/drafts',
  '/api/v1/celestial-hypotheses/[experimentId]',
  '/api/v1/celestial-hypotheses/[experimentId]/register',
  '/api/v1/celestial-hypotheses/[experimentId]/outcomes',
  '/api/v1/celestial-hypotheses/[experimentId]/provenance',
  // Exploratory historical corpus control plane. It carries pseudonymous
  // timelines and remains behind the same private operations token; only a
  // future privacy-reviewed aggregate projection may enter public OpenAPI.
  '/api/v1/celestial-corpus/corpora',
  '/api/v1/celestial-corpus/corpora/[corpusId]/lock',
  '/api/v1/celestial-corpus/corpora/[corpusId]/schedule',
  '/api/v1/celestial-corpus/corpora/[corpusId]/observations',
  '/api/admin/mps-operations/actions',
  '/api/admin/commercial-api-metering',
  '/api/admin/chargeback-export',
  '/api/admin/mps-operations/lookup',
  '/api/admin/mcp-gateway',
  '/api/mcp-gateway/[serverId]',
  '/api/admin/revenue-control-plane',
  // Operator readiness for the x402 payment surface. Behind the readiness
  // bearer token and deliberately undocumented publicly: it reports which
  // offers are enabled where, which is operational state rather than product.
  '/api/admin/x402-readiness',
  '/api/admin/revenue-metrics',
  '/api/admin/billing-readiness',
  '/api/admin/experiments',
  '/api/admin/demand-validation',
  '/api/admin/som-evaluations',
  '/api/admin/micro-utility-validations',
  '/api/admin/observability-readiness',
  '/api/admin/revenue-readiness',
  // Beta and deliberately undiscoverable rather than private: the route answers
  // for callers holding the URL, but the standalone QUBO reference engine has no
  // passing A10G evidence for its vectorized candidate, so nothing advertises it.
  // Restore it to the contract only with the evidence. See
  // docs/qubo-reference-promotion.md.
  '/api/v1/jobs/qubo-ising',
  // Rewrite targets. The documented public URLs are /.well-known/agent.json and
  // /agent-offers.json; these internal paths are not part of the API surface.
  '/api/discovery/agent-card',
  '/api/discovery/agent-offers',
  '/api/discovery/agent-context',
  '/api/discovery/mcp-contract',
  '/api/discovery/carp/seller-profile',
  '/api/discovery/carp/seller-role',
  // CARP publishes its own DID, SAD, ADILOS and encrypted JSON-RPC contracts.
  // The stable public paths are /.well-known/carp/* and /cgi-bin/* rather than
  // REST OpenAPI operations.
  '/api/discovery/carp/did',
  '/api/discovery/carp/sad',
  '/api/carp/challenge',
  '/api/carp/response',
  '/api/carp/encrequest',
  '/api/carp/encresult',
  '/api/admin/content-candidates',
  '/api/admin/content-drafts',
  '/api/admin/content-draft-assistant',
  '/api/admin/content-candidate-assistant',
  '/api/admin/content-handoffs',
  '/api/admin/content-publications',
  '/api/admin/content-publication-amendments',
  // Dedicated-token, append-only expert review surface. It exposes reviewer
  // identities and internal frozen artifacts, not a customer API contract.
  '/api/admin/practitioner-reviews',
  '/api/admin/editorial-coverage',
  '/api/admin/inbound-operations',
  '/api/admin/navigator',
  '/api/admin/navigator/research',
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
  // Fixed-workload UI backend. It is not the customer integration contract;
  // /api/v1/compress remains the documented machine API.
  '/api/context-compiler/playground',
  '/api/webhooks/stripe',
  '/api/stripe/checkout',
  '/api/v1/jobs/webhook',
  // Optimization engines remain private until real solver implementations,
  // hardware benchmarks, and SLA evidence have passed the promotion gate.
  '/api/inbound-submissions',
  // Consent-based browser assessment backend. It is not a customer API
  // integration contract and exposes no autonomous outreach capability.
  '/api/navigator/assessments',
  '/api/internal/ops-alerts',
  '/api/integrations/base44/openapi',
  // WSO2 request-phase compatibility prototype. It implements WSO2's own
  // interceptor contract, is protected by a dedicated integration credential,
  // and is not a general Maha REST operation. Promote only after the bounded
  // WSO2 deployment test and production authentication review pass.
  '/api/integrations/wso2/context-compiler/handle-request',
  '/api/integrations/wso2/context-compiler/handle-response',
  '/api/cron/inbound-digest',
  '/api/cron/job-reclaim',
  '/api/cron/market-scout',
  '/api/cron/x402-observatory',
  '/api/cron/utility-upload-cleanup',
  '/api/cron/celestial-webhooks',
  '/api/cron/celestial-retention',
  '/api/conversion-events',
  '/api/cron/utility-upload-cleanup',
  '/api/mps-audits/[auditId]',
  '/api/mps-preflight/[orderId]',
  '/api/mps-preflight/checkout',
  '/api/mps-preflight/submit',
  '/api/mps-preflight/webhook',
  // MCP endpoints expose their own JSON-RPC tool schemas and are linked from
  // llms.txt and public MCP metadata rather than the REST OpenAPI document.
  '/api/mcp/mps-preflight',
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

test('unfinished optimization engines are absent from the public contract', () => {
  const publicContract = JSON.stringify(openApiDocument).toLowerCase()
  for (const marker of ['tensor-opt', 'geometric-ai', 'holographic-qec', 'qec-compiler', 'landscape-opt']) {
    assert.equal(publicContract.includes(marker), false, `${marker} must stay private until its promotion gate passes`)
  }
})
