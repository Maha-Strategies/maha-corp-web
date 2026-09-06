import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { buildProductFederation } from '../lib/product-federation.ts'

const ROOT = new URL('../', import.meta.url)
const SELLER = {
  did: 'did:web:mahastrategies.com:cabezon:seller',
  sadSha256: `sha256:${'1'.repeat(64)}`,
  endpoint: 'https://preview.mahastrategies.com/api/integrations/cabezon/preview',
}

test('product federation is deterministic, unique and preserves five acquisition states', () => {
  const first = buildProductFederation(SELLER)
  const second = buildProductFederation(SELLER)
  assert.deepEqual(first, second)
  assert.equal(first.projectionSha256, second.projectionSha256)
  assert.equal(new Set(first.products.map((product) => product.productId)).size, first.products.length)
  for (const state of ['informational', 'inquiry_available', 'licensed', 'payable', 'withheld'] as const) assert.ok(first.counts[state] > 0, `${state} is absent`)
  assert.equal(Object.values(first.counts).reduce((sum, count) => sum + count, 0), first.products.length)
  assert.ok(first.products.every((product) => product.access.purchaseEnabledThroughCabezonPreview === false))
  assert.equal(first.authority.paymentEnabled, false)
  assert.equal(first.authority.entitlementMutationEnabled, false)
  assert.equal(first.authority.canonicalReleaseEnabled, false)
})

test('federation states are derived from authoritative product contracts rather than widened by CABEZON', () => {
  const products = new Map(buildProductFederation(SELLER).products.map((product) => [product.productId, product]))
  assert.equal(products.get('context-compression')?.state, 'payable')
  assert.equal(products.get('mps-autonomous-audit')?.state, 'payable')
  assert.equal(products.get('rapid-intelligence-brief')?.state, 'inquiry_available')
  assert.equal(products.get('book-the-imagined-life')?.state, 'informational')
  assert.equal(products.get('licensed-evidence-mcp')?.state, 'licensed')
  assert.equal(products.get('licensed-evidence-mcp')?.access.purchaseEnabledInSource, false)
  assert.match(products.get('licensed-evidence-mcp')?.capability ?? '', /evidence\.retrieve_released_record/)
  assert.equal(products.get('machine-evidence-dossier')?.state, 'withheld')
  assert.equal(products.get('maha:samley-cinnamon-tea:rfq-v1')?.access.deliveryMode, 'physical-rfq')
  assert.equal(products.get('maha:samley-cinnamon-tea:rfq-v1')?.access.purchaseEnabledInSource, false)
})

test('Maha Celestial remains a separate informational namespace', () => {
  const products = buildProductFederation(SELLER).products
  const celestial = products.filter((product) => product.namespace === 'maha-celestial')
  assert.deepEqual(celestial.map((product) => product.productId), ['maha-celestial-reports'])
  assert.equal(celestial[0]?.family, 'celestial')
  assert.equal(celestial[0]?.state, 'informational')
  assert.match(celestial[0]?.boundaries.join(' ') ?? '', /not scientifically validated prediction/i)
})

test('federation and canary remain private and credential-free by construction', async () => {
  const crawlFiles = await Promise.all(['app/sitemap.ts', 'app/llms.txt/route.ts', 'lib/llms-manifest.ts', 'lib/openapi.ts'].map((path) => readFile(new URL(path, ROOT), 'utf8')))
  for (const source of crawlFiles) assert.doesNotMatch(source, /cabezon\/preview\/federation|licensed-evidence-mcp/)
  const implementationFiles = [
    'lib/product-federation.ts',
    'app/api/integrations/cabezon/preview/federation/route.ts',
    'scripts/run-cabezon-mcp-federation-canary.ts',
  ]
  const implementation = await Promise.all(implementationFiles.map((path) => readFile(new URL(path, ROOT), 'utf8')))
  for (const source of implementation) {
    assert.doesNotMatch(source, /EPISTEMIC_RELEASE_AUTHORITY_TOKEN|OPERATIONS_TOKEN|SUPABASE_SERVICE_ROLE_KEY/)
    assert.doesNotMatch(source, /frontier-source-alignment|pilot-source-alignment|evidence-dossier-rehearsal/)
  }
  const workflow = await readFile(new URL('.github/workflows/preview-cabezon-mcp-federation-canary.yml', ROOT), 'utf8')
  assert.match(workflow, /environment: Preview-CABEZON-Federation/)
  assert.match(workflow, /codex\/cabezon-product-federation/)
  assert.match(workflow, /EPISTEMIC_OPERATIONS_TOKEN:.*secrets\.EPISTEMIC_OPERATIONS_TOKEN/)
  assert.match(workflow, /EPISTEMIC_RELEASE_AUTHORITY_TOKEN:.*secrets\.EPISTEMIC_RELEASE_AUTHORITY_TOKEN/)
  assert.match(workflow, /Operations and release-authority tokens must be distinct/)
  assert.match(workflow, /\+%Y-%m-%dT%H:%M:%S\.000Z/)
  assert.match(workflow, /stage:"credential-provisioning"/)
  assert.match(workflow, /stage:"zero-dollar-internal-grant"/)
  assert.doesNotMatch(workflow, /credential_response="\$\(curl --fail/)
  assert.doesNotMatch(workflow, /grant_response="\$\(curl --fail/)
  assert.doesNotMatch(workflow, /environment: Production|PRODUCTION/i)
})

test('Preview migration workflow verifies the private MCP license ledger', async () => {
  const workflow = await readFile(new URL('../.github/workflows/preview-mcp-evidence-migration.yml', import.meta.url), 'utf8')
  assert.match(workflow, /20260829000100_mcp_evidence_tool_licensing\.sql/)
  for (const object of ['mcp_evidence_license_plans', 'mcp_evidence_license_grants', 'mcp_evidence_license_events', 'mcp_evidence_executions', 'mcp_evidence_execution_events', 'reserve_mcp_evidence_execution']) assert.match(workflow, new RegExp(object))
  assert.match(workflow, /Production ref refused/)
  assert.match(workflow, /codex\/cabezon-product-federation/)
})

test('private canary migration admits its adapter and converges when reapplied', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260829000100_mcp_evidence_tool_licensing.sql', import.meta.url), 'utf8')
  const workflow = await readFile(new URL('../.github/workflows/preview-cabezon-mcp-federation-canary.yml', import.meta.url), 'utf8')
  assert.match(workflow, /20260828110000_cabezon_preview_seller_adapter\.sql/)
  assert.match(workflow, /Apply and verify exactly the two private integration migrations/)
  for (const object of ['cabezon_preview_lifecycles', 'cabezon_preview_lifecycle_events', 'cabezon_preview_action_idempotency', 'record_cabezon_preview_enquiry', 'record_cabezon_preview_delivery', 'record_cabezon_preview_acknowledgement']) assert.match(workflow, new RegExp(object))
  assert.doesNotMatch(workflow, /supabase\/migrations\/\*\.sql/)
  assert.match(migration, /epistemic_ingestion_batches_adapter_id_check[\s\S]*'mcp-private-canary'/)
  assert.match(migration, /epistemic_ingestion_records_adapter_id_check[\s\S]*'mcp-private-canary'/)
  assert.match(migration, /drop trigger if exists mcp_evidence_license_plans_immutable/)
  assert.match(workflow, /object presence alone cannot prove that ledger constraints/)
  assert.doesNotMatch(workflow, /if \[ "\$existing_count" -ne 11 \]/)
})
