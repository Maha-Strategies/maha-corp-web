import { NextResponse } from 'next/server'

import { API_CORS_HEADERS } from '@/lib/api-proxy-policy'
import { COMPATIBILITY_PACK_SAMPLE_REPORT } from '@/lib/agent-infrastructure-compatibility-pack'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(COMPATIBILITY_PACK_SAMPLE_REPORT, {
    headers: { ...API_CORS_HEADERS, 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
  })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...API_CORS_HEADERS, Allow: 'GET, OPTIONS' } })
}
