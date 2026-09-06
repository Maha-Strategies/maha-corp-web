import { bookEditionPost } from '@/lib/x402/book-edition-route'
import { IMAGINED_LIFE_EDITION_OFFER } from '@/lib/x402/offers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10

export const POST = bookEditionPost('the-imagined-life', IMAGINED_LIFE_EDITION_OFFER)
export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
