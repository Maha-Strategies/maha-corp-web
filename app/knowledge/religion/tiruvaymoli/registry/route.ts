import { NextResponse } from 'next/server'

import { TIRUVAYMOLI_ATLAS_PUBLIC_REGISTRY, TIRUVAYMOLI_ATLAS_REGISTRY_DIGEST } from '@/lib/tiruvaymoli-passage-atlas'

export const dynamic = 'force-static'

export async function GET() {
  return NextResponse.json({ ...TIRUVAYMOLI_ATLAS_PUBLIC_REGISTRY, registryDigest: TIRUVAYMOLI_ATLAS_REGISTRY_DIGEST }, { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } })
}
