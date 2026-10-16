import { retiredProductResponse } from '@/lib/x402/retired-offers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10

export function GET() { return retiredProductResponse('/api/v1/books/the-imagined-life/edition') }
export const POST = GET
export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
