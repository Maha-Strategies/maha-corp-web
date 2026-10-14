import { domainMcp } from '@/lib/api-v1/mcp'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15
export async function POST(request: Request, context: { params: Promise<{ domain: string }> }) { return domainMcp(request, (await context.params).domain) }
export function GET() { return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } }) }
