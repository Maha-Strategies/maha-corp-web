type SiteverifyResponse = { success?: unknown; hostname?: unknown; action?: unknown }

function remoteIp(request: Request): string | undefined {
  const value = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-forwarded-for')
  const parsed = value?.split(',')[0]?.trim()
  return parsed && parsed.length <= 64 ? parsed : undefined
}

export async function verifyContactTurnstile(token: unknown, request: Request): Promise<{ accepted: boolean; configured: boolean }> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { accepted: true, configured: false }
  if (typeof token !== 'string' || token.length < 20 || token.length > 2_048) return { accepted: false, configured: true }

  const body = new FormData()
  body.set('secret', secret)
  body.set('response', token)
  const ip = remoteIp(request)
  if (ip) body.set('remoteip', ip)
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(8_000) })
    const result = await response.json() as SiteverifyResponse
    const expectedHostname = process.env.TURNSTILE_EXPECTED_HOSTNAME
    const hostnameMatches = !expectedHostname || result.hostname === expectedHostname
    return { accepted: response.ok && result.success === true && result.action === 'contact_inquiry' && hostnameMatches, configured: true }
  } catch {
    return { accepted: false, configured: true }
  }
}
