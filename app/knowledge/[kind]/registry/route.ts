import { EPISTEMIC_DOMAINS, buildDomainRegistry } from '@/lib/epistemic-pilots'

type RouteContext = { params: Promise<{ kind: string }> }

export const dynamicParams = false
export function generateStaticParams() { return EPISTEMIC_DOMAINS.map((domain) => ({ kind: domain.slug })) }

export async function GET(_request: Request, { params }: RouteContext) {
  const registry = buildDomainRegistry((await params).kind)
  if (!registry) return Response.json({ error: 'Domain not found' }, { status: 404 })
  return Response.json(registry, {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  })
}
