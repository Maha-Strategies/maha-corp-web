import assert from 'node:assert/strict'
import test from 'node:test'

import { decodeJwt, exportJWK, generateKeyPair } from 'jose'

import { createCdpFacilitatorAuthHeaders } from '../lib/x402/cdp-auth.ts'

test('CDP facilitator JWTs are short-lived and bound to each request path', async () => {
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true })
  const privateJwk = await exportJWK(pair.privateKey)
  const publicJwk = await exportJWK(pair.publicKey)
  const secret = Buffer.concat([
    Buffer.from(privateJwk.d!, 'base64url'),
    Buffer.from(publicJwk.x!, 'base64url'),
  ]).toString('base64')

  const headers = await createCdpFacilitatorAuthHeaders(
    'https://api.cdp.coinbase.com/platform/v2/x402',
    { apiKeyId: 'organizations/org/apiKeys/key', apiKeySecret: secret },
  )

  for (const [operation, method] of [['verify', 'POST'], ['settle', 'POST'], ['supported', 'GET']] as const) {
    const token = headers[operation].Authorization.replace(/^Bearer /, '')
    const claims = decodeJwt(token)
    assert.equal(claims.iss, 'cdp')
    assert.equal(claims.sub, 'organizations/org/apiKeys/key')
    assert.deepEqual(claims.uris, [`${method} api.cdp.coinbase.com/platform/v2/x402/${operation}`])
    assert.equal(Number(claims.exp) - Number(claims.nbf), 120)
  }
})
