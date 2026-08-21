import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { GWSG_CONFLICTING_CHAIN, GWSG_DEFAULT_CHAIN, GWSG_ROOT_POLICY } from '../lib/governed-workflow/fixtures.ts'
import { resolveGwsgPolicy } from '../lib/governed-workflow/policy.ts'
import { runAllScenarios } from '../lib/governed-workflow/scenarios.ts'
import { runDemoProgram, parseDemoRequest } from '../lib/governed-workflow/demo-api.ts'

/**
 * First-release boundary: synthetic, and not connected to payment.
 *
 * This is the release constraint written as a guard rather than a promise. It
 * is a source-level check on purpose — a runtime assertion only proves the
 * paths that ran, whereas an import that would connect this library to money
 * or to a live provider fails here whether or not anyone calls it.
 */

const LIB_DIR = new URL('../lib/governed-workflow/', import.meta.url).pathname
const ROUTE = new URL('../app/api/governed-workflow/demo/route.ts', import.meta.url).pathname
const VIEW = new URL('../app/governed-workflow/page.tsx', import.meta.url).pathname

function libraryFiles(): { name: string; source: string }[] {
  return readdirSync(LIB_DIR)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, source: readFileSync(join(LIB_DIR, name), 'utf8') }))
}

test('payment is forbidden at the root and no policy chain can widen it', () => {
  assert.equal(GWSG_ROOT_POLICY.payment.mode, 'forbid')
  assert.deepEqual(GWSG_ROOT_POLICY.payment.allowedBuyerPolicyIds, [])
  for (const [label, chain] of [['default', GWSG_DEFAULT_CHAIN], ['conflicting', GWSG_CONFLICTING_CHAIN]] as const) {
    const resolved = resolveGwsgPolicy(chain)
    assert.equal(resolved.policy.payment.mode, 'forbid', `${label} chain must forbid payment`)
    assert.deepEqual(resolved.policy.payment.allowedBuyerPolicyIds, [], `${label} chain must allow no buyer policy`)
  }
})

test('no operation in the corpus is a payment operation', () => {
  const resolved = resolveGwsgPolicy(GWSG_DEFAULT_CHAIN)
  for (const operation of resolved.policy.allowedOperations) {
    assert.ok(
      !/pay|payment|charge|settle|transfer|invoice|refund|purchase/i.test(operation),
      `${operation} looks like a payment operation and must not be permitted in the first release`,
    )
  }
})

test('the library imports no payment, provider, or durable-store module', () => {
  // Affirmative allow-list rather than a banned-substring scan: an unexpected
  // dependency fails even if nobody predicted its name.
  const PERMITTED_IMPORTS = [
    'node:crypto', 'node:fs', 'node:path',
    '../governance/envelope.ts', '../governance/policy-inheritance.ts',
    './types.ts', './state-graph.ts', './evidence.ts', './policy.ts',
    './engine.ts', './audit.ts', './fixtures.ts', './scenarios.ts', './demo-api.ts',
  ]
  for (const { name, source } of libraryFiles()) {
    for (const match of source.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
      const specifier = match[1]
      assert.ok(
        PERMITTED_IMPORTS.includes(specifier),
        `lib/governed-workflow/${name} imports ${specifier}, which is outside the first-release boundary`,
      )
    }
  }
})

test('the library performs no network or filesystem I/O', () => {
  for (const { name, source } of libraryFiles()) {
    // Strip comments so prose about network calls does not trip the scan.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'child_process', 'writeFileSync', 'createConnection']) {
      assert.ok(!code.includes(forbidden), `lib/governed-workflow/${name} uses ${forbidden}`)
    }
  }
})

test('the demo route is credential-free and store-free by construction', () => {
  const route = readFileSync(ROUTE, 'utf8')
  for (const forbidden of ['redis', 'supabase', 'stripe', 'x402', 'bearerToken', 'authorizeClientCapability', 'process.env']) {
    assert.ok(!route.toLowerCase().includes(forbidden.toLowerCase()), `the demo route references ${forbidden}`)
  }
})

test('every side effect in every scenario is an unexecuted simulation', () => {
  let intents = 0
  for (const scenario of runAllScenarios()) {
    for (const event of scenario.timeline) {
      if (event.sideEffect.intent) {
        intents += 1
        assert.equal(event.sideEffect.intent.simulated, true)
        assert.ok(
          !/pay|charge|transfer/i.test(event.sideEffect.intent.operation),
          `${scenario.scenarioId} intends a payment-like operation`,
        )
      }
      if (event.sideEffect.receipt) assert.equal(event.sideEffect.receipt.simulated, true)
    }
  }
  // A corpus with no intents at all would pass the above vacuously.
  assert.ok(intents > 0, 'the corpus must exercise at least one simulated side effect')
})

test('the corpus and every public surface declare themselves synthetic', () => {
  const response = runDemoProgram(parseDemoRequest({ program: [{ operation: 'create_workflow' }] }))
  assert.equal(response.synthetic, true)
  assert.match(response.notice, /[Ss]ynthetic/)
  const view = readFileSync(VIEW, 'utf8')
  assert.ok(view.includes('Synthetic evaluation corpus'), 'the operator view must carry the synthetic caption')
  assert.ok(view.includes('not a customer result'), 'the operator view must disclaim customer results')
  // The disclaimer must be present, not merely un-contradicted: a page that
  // deleted it would still pass a scan that only looked for false claims.
  assert.ok(/evaluation-grade prototype, not a compliance certification/i.test(view))
})
