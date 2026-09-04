import { MAYON_PUBLIC_REGISTRY, MAYON_PUBLIC_REGISTRY_DIGEST } from '@/lib/mayon-topics'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(
    { ...MAYON_PUBLIC_REGISTRY, digest: MAYON_PUBLIC_REGISTRY_DIGEST },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400', 'X-Content-Type-Options': 'nosniff', ETag: `"${MAYON_PUBLIC_REGISTRY_DIGEST}"` } },
  )
}
