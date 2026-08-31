import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { availableOffers } from '../lib/agentic-commerce.ts'
import { postPublicForm } from '../lib/public-form-client.ts'

const ROOT = join(import.meta.dirname, '..')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'admin' ? [] : sourceFiles(path)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

test('public human intake surfaces use the neutral contact endpoint', () => {
  const surfaces = [
    'app/contact/page.tsx',
    'app/inbound/page.tsx',
    'components/EvidenceAuditScopeForm.tsx',
    'components/PlannerInquiryForm.tsx',
  ]
  for (const surface of surfaces) {
    const source = readFileSync(join(ROOT, surface), 'utf8')
    assert.match(source, /postPublicForm(?:<[^>]+>)?\('\/forms\/contact'/, `${surface} must use the shared contact client`)
    assert.doesNotMatch(source, /fetch\('\/api\/inbound-submissions'/, `${surface} must not expose the blocker-prone operational route name`)
  }
  assert.ok(existsSync(join(ROOT, 'app/forms/contact/route.ts')), 'the neutral human contact route must exist')
})

test('human intake retains Turnstile while agent intake remains separately authenticated', () => {
  const humanRoute = readFileSync(join(ROOT, 'app/api/inbound-submissions/route.ts'), 'utf8')
  const agentRoute = readFileSync(join(ROOT, 'app/api/agent-inquiries/route.ts'), 'utf8')
  assert.match(humanRoute, /verifyContactTurnstile/)
  assert.match(agentRoute, /bearerToken\(request\)/)
  assert.match(agentRoute, /authorizeClientCredential/)
  assert.match(agentRoute, /clientRequestId/)
  assert.match(agentRoute, /autonomousPaymentSupported: false/)
})

test('every statically addressed public form API has a route handler', () => {
  const files = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'components'))]
  const endpoints = new Set<string>()
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/fetch\(\s*['"](\/api\/[^'"?]+)(?:\?[^'"]*)?['"]/g)) endpoints.add(match[1])
    for (const match of source.matchAll(/postPublicForm(?:<[^>]+>)?\(\s*['"](\/[^'"]+)['"]/g)) endpoints.add(match[1])
  }
  assert.ok(endpoints.size >= 15, `expected a meaningful public endpoint audit, found ${endpoints.size}`)
  for (const endpoint of endpoints) {
    assert.ok(existsSync(join(ROOT, 'app', ...endpoint.split('/').filter(Boolean), 'route.ts')), `${endpoint} is called by a public client but has no route handler`)
  }
})

test('machine offer catalog exposes the authenticated agent inquiry contract', () => {
  const inquiryOffers = availableOffers.filter((offer): offer is Extract<typeof availableOffers[number], { request: unknown }> => 'request' in offer)
    .filter((offer) => offer.request.mode === 'authenticated_json')
  assert.equal(inquiryOffers.length, 2)
  for (const offer of inquiryOffers) {
    assert.equal(offer.request.url, 'https://www.mahastrategies.com/api/agent-inquiries')
    assert.equal(offer.request.method, 'POST')
    assert.equal(offer.request.inputSchema, 'https://www.mahastrategies.com/agent-inquiry-schema.json')
  }

  const schema = JSON.parse(readFileSync(join(ROOT, 'public/agent-inquiry-schema.json'), 'utf8')) as { additionalProperties?: boolean; required?: string[] }
  assert.equal(schema.additionalProperties, false)
  assert.deepEqual(schema.required, ['clientRequestId', 'offerId', 'requester', 'decision', 'question', 'requesterAuthorized'])
})

test('shared form client submits JSON and returns a parsed success response', async () => {
  const originalFetch = globalThis.fetch
  let calledUrl = ''
  let calledBody = ''
  globalThis.fetch = (async (input, init) => {
    calledUrl = String(input)
    calledBody = String(init?.body)
    return Response.json({ accepted: true }, { status: 202 })
  }) as typeof fetch
  try {
    const result = await postPublicForm<{ accepted: boolean }>('/forms/contact', { question: 'A sufficiently specific question.' })
    assert.deepEqual(result, { accepted: true })
    assert.equal(calledUrl, '/forms/contact')
    assert.deepEqual(JSON.parse(calledBody), { question: 'A sufficiently specific question.' })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('shared form client replaces Safari Load failed with an actionable message', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => { throw new TypeError('Load failed') }) as typeof fetch
  try {
    await assert.rejects(
      () => postPublicForm('/forms/contact', {}),
      /could not reach Maha Strategies.*email mayone@mahastrategies\.com/i,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('shared form client preserves structured server validation errors', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => Response.json({ error: { message: 'Verification expired or failed. Please retry.' } }, { status: 400 })) as typeof fetch
  try {
    await assert.rejects(() => postPublicForm('/forms/contact', {}), /Verification expired or failed/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
