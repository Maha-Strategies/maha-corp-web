import { NextResponse } from 'next/server'

import { TAMIL_CLASSICAL_PUBLIC_REGISTRY, TAMIL_CLASSICAL_REGISTRY_DIGEST } from '@/lib/tamil-classical-traditions'

export const dynamic = 'force-static'

export function GET() {
  return NextResponse.json({ ...TAMIL_CLASSICAL_PUBLIC_REGISTRY, digest: TAMIL_CLASSICAL_REGISTRY_DIGEST }, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' } })
}
