// Local development HTTP smoke check only; this neither starts nor builds a server.
import assert from 'node:assert/strict'
import { POLICY_DRAFTS } from '../lib/policy-expansion-drafts.ts'
import { POLICY_METHODS } from '../lib/policy-expansion-map.ts'
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:3124')
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Refuse non-local target')
const routes = ['/policy', ...POLICY_DRAFTS.map(d => `/policy/questions/${d.slug}`), ...POLICY_METHODS.map(m => `/policy/methodology/${m.slug}`)]
for (const route of routes) {
  const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(30000), redirect: 'error' })
  assert.equal(response.status, 200, route)
  const html = await response.text()
  assert.match(html, /name="robots" content="noindex, nofollow"/)
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, route)
  assert.ok(html.includes(`href="https://www.mahastrategies.com${route}"`), `canonical ${route}`)
  assert.match(html, /Local review draft/)
  assert.doesNotMatch(html, /STRIPE_SECRET_KEY|EPISTEMIC_RELEASE_AUTHORITY_TOKEN|operatorEmail/)
}
for (const route of ['/policy/questions/not-in-the-map', '/policy/methodology/toString']) {
  const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(30000), redirect: 'error' })
  assert.equal(response.status, 404, route)
}
console.log('PASS: 17 development HTTP routes, canonical/noindex and single H1; two unknown routes 404. Not production validation.')
