import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, stat, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ChatGptSession, readCompletedResponse, verifyIdentity } from '../packages/context-review-workbench/chatgpt-session.ts'
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose'

function stream(text: string, bytewise = false) {
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream<Uint8Array>({ start(controller) { if (bytewise) for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); else controller.enqueue(bytes); controller.close() } })
}
test('real JWT validation checks signature, issuer, audience, expiry and nonce', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const keys = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256' }] })
  const issue = async (overrides: Record<string, unknown> = {}) => new SignJWT({ sub: 'test-subject', nonce: 'expected-nonce', iss: 'https://auth.openai.com', aud: 'oaiapp_test', exp: Math.floor(Date.now() / 1000) + 60, ...overrides }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(privateKey)
  assert.equal((await verifyIdentity(await issue(), 'oaiapp_test', 'expected-nonce', keys)).sub, 'test-subject')
  await assert.rejects(() => issue({ nonce: 'bad' }).then(token => verifyIdentity(token, 'oaiapp_test', 'expected-nonce', keys)), /nonce/)
  await assert.rejects(() => issue({ aud: 'oaiapp_other' }).then(token => verifyIdentity(token, 'oaiapp_test', 'expected-nonce', keys)))
  await assert.rejects(() => issue({ iss: 'https://evil.example' }).then(token => verifyIdentity(token, 'oaiapp_test', 'expected-nonce', keys)))
  await assert.rejects(() => issue({ exp: 1 }).then(token => verifyIdentity(token, 'oaiapp_test', 'expected-nonce', keys)))
  const altered = (await issue()).split('.'); altered[2] = 'invalid-signature'
  await assert.rejects(() => verifyIdentity(altered.join('.'), 'oaiapp_test', 'expected-nonce', keys))
})
test('SSE requires completed inference, handles byte boundaries, failures and interruption', async () => {
  const text = 'data: {"type":"response.output_text.delta","delta":"héllo"}\r\n\r\ndata: {"type":"response.completed"}\r\n\r\n'
  assert.deepEqual(await readCompletedResponse(stream(text, true)), { text: 'héllo', status: 'completed' })
  await assert.rejects(() => readCompletedResponse(stream('data: {"type":"response.output_text.delta","delta":"partial"}\n\n')), /before completion/)
  await assert.rejects(() => readCompletedResponse(stream('data: {"type":"response.failed"}\n\n')), /did not complete/)
  await assert.rejects(() => readCompletedResponse(stream('data: {"type":"response.incomplete"}\n\n')), /did not complete/)
})
async function fixture(run: (session: ChatGptSession, directory: string, calls: { url: string; body: URLSearchParams }[]) => Promise<void>, options: { permission?: boolean; expiry?: number; subject?: string } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'maha-review-test-'))
  const calls: { url: string; body: URLSearchParams }[] = []
  const session = new ChatGptSession(directory, {
    fetcher: (async (url, init) => {
      calls.push({ url: String(url), body: init?.body instanceof URLSearchParams ? init.body : new URLSearchParams() })
      if (String(url).endsWith('openid-configuration')) return Response.json({ issuer: 'https://auth.openai.com', revocation_endpoint: 'https://auth.openai.com/revoke' })
      if (String(url).endsWith('/revoke')) return new Response(null, { status: 200 })
      return Response.json({ access_token: 'test-access', refresh_token: 'test-refresh', id_token: 'test-id', token_type: 'Bearer', expires_in: options.expiry ?? 3600, scope: options.permission === false ? 'openid email' : 'openid email chatgpt.tokens.use.direct' })
    }) as typeof fetch,
    verify: async (_token, clientId, nonce) => { assert.match(clientId, /^oaiapp_/); if (nonce !== undefined) assert.ok(nonce.length >= 32); return { sub: options.subject ?? 'account-1', email: 'test@example.com' } },
  })
  try { await session.load(); await run(session, directory, calls) }
  finally { await rm(directory, { recursive: true, force: true }) }
}
function callback(authorize: string, clientId = 'oaiapp_test') {
  const authorization = new URL(authorize)
  return new URL(`http://127.0.0.1:1455/auth/callback?${new URLSearchParams({ state: authorization.searchParams.get('state')!, code: 'test-code', client_id: clientId })}`)
}
test('initial OAuth uses PKCE, host ID and issued client for token exchange; protects storage', async () => fixture(async (session, directory, calls) => {
  const url = session.authorize('http://127.0.0.1:1455/auth/callback')
  const auth = new URL(url)
  assert.equal(auth.searchParams.get('client_id'), 'dynamic_agent_client')
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256')
  assert.match(auth.searchParams.get('ext_agent_host_id')!, /^urn:uuid:/)
  assert.ok(auth.searchParams.get('scope')?.includes('chatgpt.tokens.use.direct'))
  const result = await session.callback(callback(url))
  assert.equal(result.planEnabled, true)
  assert.equal(calls[0].body.get('client_id'), 'oaiapp_test')
  assert.equal(calls[0].body.get('redirect_uri'), 'http://127.0.0.1:1455/auth/callback')
  assert.equal(calls[0].body.has('client_secret'), false)
  assert.equal((await stat(join(directory, 'session.json'))).mode & 0o777, 0o600)
  assert.equal((await stat(directory)).mode & 0o777, 0o700)
  assert.equal(JSON.stringify(session.status()).includes('test-access'), false)
  await assert.rejects(() => session.callback(callback(url)), /state/)
}))
test('state and issued client mismatch stop before token exchange', async () => fixture(async (session, _dir, calls) => {
  const url = callback(session.authorize('http://127.0.0.1:1455/auth/callback'))
  url.searchParams.set('state', 'wrong')
  await assert.rejects(() => session.callback(url), /state/)
  assert.equal(calls.length, 0)
  await assert.rejects(() => session.callback(callback(session.authorize('http://127.0.0.1:1455/auth/callback'), 'dynamic_agent_client')), /registration/)
  assert.equal(calls.length, 0)
}))
test('denied consent and missing plan permission never authorize inference', async () => fixture(async (session) => {
  const denied = callback(session.authorize('http://127.0.0.1:1455/auth/callback')); denied.searchParams.set('error', 'access_denied')
  await assert.rejects(() => session.callback(denied), /declined/)
  await session.callback(callback(session.authorize('http://127.0.0.1:1455/auth/callback')))
  assert.equal(session.status().planEnabled, false)
  await assert.rejects(() => session.access(), /grant ChatGPT plan/)
}, { permission: false }))
test('returning registration reuses issued client and rejects substituted ID', async () => fixture(async session => {
  await session.callback(callback(session.authorize('http://127.0.0.1:1455/auth/callback')))
  const returning = session.authorize('http://127.0.0.1:4567/auth/callback', 'oaiapp_test')
  assert.equal(new URL(returning).searchParams.get('client_id'), 'oaiapp_test')
  assert.equal(new URL(returning).searchParams.has('agent_name_hint'), false)
  await assert.rejects(() => session.callback(callback(returning, 'oaiapp_other')), /did not match/)
}))
test('refresh is single-flight and sign-out revokes then clears local tokens', async () => fixture(async (session, directory, calls) => {
  await session.callback(callback(session.authorize('http://127.0.0.1:1455/auth/callback')))
  await Promise.all([session.access(), session.access()])
  assert.equal(calls.filter(call => call.body.get('grant_type') === 'refresh_token').length, 1)
  const result = await session.signOut()
  assert.equal(result.revocationConfirmed, true)
  const stored = await readFile(join(directory, 'session.json'), 'utf8')
  assert.equal(stored.includes('test-access'), false)
  assert.equal(stored.includes('test-refresh'), false)
  assert.equal(stored.includes('oaiapp_test'), true)
}, { expiry: 1 }))
