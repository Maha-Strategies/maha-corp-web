import { getPublicX402TrustEvidence } from '../../../../../lib/x402/trust-replay.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-static'

type Context = { params: Promise<{ decision: string }> }

export async function GET(_request: Request, context: Context) {
  const { decision } = await context.params
  const download = getPublicX402TrustEvidence(decision)
  if (!download) {
    return Response.json(
      { error: { code: 'not_found', message: 'No such frozen x402 Trust decision fixture.' } },
      { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
    )
  }
  return new Response(`${JSON.stringify(download, null, 2)}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="maha-x402-trust-${decision}-evidence-v1.json"`,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'X-Maha-Evidence-SHA256': download.evidenceSha256,
    },
  })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'public, max-age=86400' } })
}
