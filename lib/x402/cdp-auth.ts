import { SignJWT, importJWK, importPKCS8 } from 'jose'

export type CdpApiCredentials = {
  apiKeyId: string
  apiKeySecret: string
}

type CdpRequest = {
  method: 'GET' | 'POST'
  host: string
  path: string
}

function nonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function normalizeSecret(secret: string): string {
  const trimmed = secret.trim()
  return trimmed.includes('BEGIN ') ? trimmed.replace(/\\n/g, '\n') : trimmed
}

/** Generate Coinbase CDP's short-lived, request-bound API JWT. */
export async function generateCdpJwt(
  credentials: CdpApiCredentials,
  request: CdpRequest,
  now = Math.floor(Date.now() / 1_000),
): Promise<string> {
  const apiKeyId = credentials.apiKeyId.trim()
  const apiKeySecret = normalizeSecret(credentials.apiKeySecret)
  if (!apiKeyId || !apiKeySecret) throw new Error('CDP API credentials are incomplete.')

  let algorithm: 'ES256' | 'EdDSA'
  let key: Awaited<ReturnType<typeof importPKCS8>> | Awaited<ReturnType<typeof importJWK>>
  if (apiKeySecret.startsWith('-----BEGIN')) {
    algorithm = 'ES256'
    key = await importPKCS8(apiKeySecret, 'ES256')
  } else {
    const decoded = Buffer.from(apiKeySecret, 'base64')
    if (decoded.length !== 64) throw new Error('CDP_API_KEY_SECRET must be a PKCS8 ES256 key or a 64-byte base64 Ed25519 key.')
    algorithm = 'EdDSA'
    key = await importJWK({
      kty: 'OKP',
      crv: 'Ed25519',
      d: decoded.subarray(0, 32).toString('base64url'),
      x: decoded.subarray(32).toString('base64url'),
    }, 'EdDSA')
  }

  return new SignJWT({
    sub: apiKeyId,
    iss: 'cdp',
    uris: [`${request.method} ${request.host}${request.path}`],
  })
    .setProtectedHeader({ alg: algorithm, kid: apiKeyId, typ: 'JWT', nonce: nonce() })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + 120)
    .sign(key)
}

/**
 * The x402 HTTP client asks for a path-keyed header map. Each token is bound to
 * its own method, host and path; a token for `/verify` cannot authenticate
 * `/settle`.
 */
export async function createCdpFacilitatorAuthHeaders(
  facilitatorUrl: string,
  credentials: CdpApiCredentials,
): Promise<Record<'verify' | 'settle' | 'supported', Record<string, string>>> {
  const url = new URL(facilitatorUrl)
  const basePath = url.pathname.replace(/\/+$/, '')
  const authorization = async (method: 'GET' | 'POST', operation: string) => ({
    Authorization: `Bearer ${await generateCdpJwt(credentials, {
      method,
      host: url.host,
      path: `${basePath}/${operation}`,
    })}`,
  })

  return {
    verify: await authorization('POST', 'verify'),
    settle: await authorization('POST', 'settle'),
    supported: await authorization('GET', 'supported'),
  }
}
