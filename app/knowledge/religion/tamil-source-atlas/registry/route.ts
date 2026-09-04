import { NextResponse } from 'next/server'

import { TAMIL_SOURCE_ATLAS_PUBLIC_REGISTRY, TAMIL_SOURCE_ATLAS_REGISTRY_DIGEST } from '@/lib/tamil-source-atlas'

export const dynamic = 'force-static'

export async function GET() {
  return NextResponse.json(
    { ...TAMIL_SOURCE_ATLAS_PUBLIC_REGISTRY, registryDigest: TAMIL_SOURCE_ATLAS_REGISTRY_DIGEST },
    { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } },
  )
}
