import { verifyCelestialEvidenceBundle } from '@/lib/celestial-evidence'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 2_000_000

function headers() {
  return {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  }
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return Response.json({ error: 'Content-Type must be application/json.' }, { status: 415, headers: headers() })
  }
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
    return Response.json({ error: 'Evidence bundle exceeds the 2 MB verification limit.' }, { status: 413, headers: headers() })
  }

  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) {
    return Response.json({ error: 'Evidence bundle exceeds the 2 MB verification limit.' }, { status: 413, headers: headers() })
  }
  let bundle: unknown
  try {
    bundle = JSON.parse(raw)
  } catch {
    return Response.json({ error: 'Evidence bundle is not valid JSON.' }, { status: 400, headers: headers() })
  }

  const verification = verifyCelestialEvidenceBundle(bundle)
  return Response.json({ verification }, { status: verification.status === 'invalid' ? 422 : 200, headers: headers() })
}

