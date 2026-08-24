import { EPISTEMIC_DOMAINS, buildDomainRegistry } from '@/lib/epistemic-pilots'
import { getPublicEpistemicDomainRecords } from '@/lib/public-epistemic-releases'

type RouteContext = { params: Promise<{ kind: string }> }

export const dynamicParams = false
export function generateStaticParams() { return EPISTEMIC_DOMAINS.map((domain) => ({ kind: domain.slug })) }

export async function GET(_request: Request, { params }: RouteContext) {
  const kind = (await params).kind
  const registry = buildDomainRegistry(kind, await getPublicEpistemicDomainRecords(kind))
  if (!registry) return Response.json({ error: 'Domain not found' }, { status: 404 })
  return Response.json(registry, {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  })
}
